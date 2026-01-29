/**
 * Liveness Check API
 * 
 * GET /api/health/live - Simple liveness probe
 * 
 * This is used by Kubernetes/Railway to check if the app process
 * is still alive. It should be lightweight and fast.
 */

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
    return NextResponse.json(
        {
            alive: true,
            timestamp: new Date().toISOString(),
        },
        {
            status: 200,
            headers: {
                'Cache-Control': 'no-store',
            },
        }
    );
}
