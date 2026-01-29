/**
 * Health Check API
 * 
 * GET /api/health - Basic health check
 * 
 * Used by Railway and load balancers to check if the app is healthy.
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
    const startTime = Date.now();
    const checks: Record<string, { status: string; latency?: number; error?: string }> = {};
    let healthy = true;

    // Check database connection
    try {
        const dbStart = Date.now();
        await prisma.$queryRaw`SELECT 1`;
        checks.database = {
            status: 'healthy',
            latency: Date.now() - dbStart,
        };
    } catch (error) {
        healthy = false;
        checks.database = {
            status: 'unhealthy',
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }

    // Check environment variables
    const requiredEnvVars = [
        'DATABASE_URL',
        'NEXTAUTH_SECRET',
    ];
    
    const missingEnvVars = requiredEnvVars.filter(v => !process.env[v]);
    
    if (missingEnvVars.length > 0) {
        healthy = false;
        checks.environment = {
            status: 'unhealthy',
            error: `Missing env vars: ${missingEnvVars.join(', ')}`,
        };
    } else {
        checks.environment = { status: 'healthy' };
    }

    // Optional: Check OpenAI API key
    if (process.env.OPENAI_API_KEY) {
        checks.openai = { status: 'configured' };
    } else {
        checks.openai = { status: 'not_configured' };
    }

    // Optional: Check Redis
    if (process.env.UPSTASH_REDIS_REST_URL || process.env.REDIS_URL) {
        checks.redis = { status: 'configured' };
    } else {
        checks.redis = { status: 'not_configured' };
    }

    const response = {
        status: healthy ? 'healthy' : 'unhealthy',
        timestamp: new Date().toISOString(),
        totalLatency: Date.now() - startTime,
        version: process.env.npm_package_version || '1.0.0',
        checks,
    };

    return NextResponse.json(response, {
        status: healthy ? 200 : 503,
        headers: {
            'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
    });
}
