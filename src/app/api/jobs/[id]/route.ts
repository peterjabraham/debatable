/**
 * Job Status API
 * 
 * GET /api/jobs/[id] - Get job status and result
 * DELETE /api/jobs/[id] - Cancel a pending job
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getJobStatus, cancelJob } from '@/lib/queue';

export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const { id: jobId } = params;
        
        if (!jobId) {
            return NextResponse.json(
                { error: 'Job ID is required' },
                { status: 400 }
            );
        }

        const status = await getJobStatus(jobId);
        
        if (!status) {
            return NextResponse.json(
                { error: 'Job not found' },
                { status: 404 }
            );
        }

        return NextResponse.json(status);

    } catch (error) {
        console.error('[Jobs API] Error getting job status:', error);
        return NextResponse.json(
            { error: 'Failed to get job status' },
            { status: 500 }
        );
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = await getServerSession(authOptions);
        
        if (!session?.user?.id) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const { id: jobId } = params;
        
        if (!jobId) {
            return NextResponse.json(
                { error: 'Job ID is required' },
                { status: 400 }
            );
        }

        const success = await cancelJob(jobId);
        
        if (!success) {
            return NextResponse.json(
                { error: 'Failed to cancel job' },
                { status: 500 }
            );
        }

        return NextResponse.json({ 
            success: true, 
            message: 'Job cancelled' 
        });

    } catch (error) {
        console.error('[Jobs API] Error cancelling job:', error);
        return NextResponse.json(
            { error: 'Failed to cancel job' },
            { status: 500 }
        );
    }
}
