/**
 * Readiness Check API
 * 
 * GET /api/health/ready - Check if app is ready to serve traffic
 * 
 * This is used by Kubernetes/Railway to determine if the app
 * should receive traffic. It performs deeper checks than the
 * basic liveness probe.
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
    const startTime = Date.now();
    let ready = true;
    const details: Record<string, any> = {};

    // Check database with a real query
    try {
        const dbStart = Date.now();
        const result = await prisma.user.count();
        details.database = {
            status: 'ready',
            latency: Date.now() - dbStart,
            userCount: result,
        };
    } catch (error) {
        ready = false;
        details.database = {
            status: 'not_ready',
            error: error instanceof Error ? error.message : 'Connection failed',
        };
    }

    // Check if critical environment variables are set
    const criticalEnvVars = ['DATABASE_URL', 'NEXTAUTH_SECRET'];
    const missingCritical = criticalEnvVars.filter(v => !process.env[v]);
    
    if (missingCritical.length > 0) {
        ready = false;
        details.config = {
            status: 'not_ready',
            missing: missingCritical,
        };
    } else {
        details.config = { status: 'ready' };
    }

    // Memory usage check
    const memUsage = process.memoryUsage();
    const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
    const heapTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);
    const heapPercent = Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100);
    
    details.memory = {
        heapUsedMB,
        heapTotalMB,
        heapPercent,
        status: heapPercent > 90 ? 'warning' : 'healthy',
    };

    const response = {
        ready,
        timestamp: new Date().toISOString(),
        totalLatency: Date.now() - startTime,
        details,
    };

    return NextResponse.json(response, {
        status: ready ? 200 : 503,
        headers: {
            'Cache-Control': 'no-store',
        },
    });
}
