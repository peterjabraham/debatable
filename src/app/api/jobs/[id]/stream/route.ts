/**
 * Job Status Stream API (Server-Sent Events)
 * 
 * GET /api/jobs/[id]/stream - Stream job status updates via SSE
 * 
 * This allows the frontend to receive real-time updates as the job progresses,
 * instead of polling the status endpoint.
 */

import { NextRequest } from 'next/server';
import { getJobStatus } from '@/lib/queue';

export const dynamic = 'force-dynamic';

export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    const { id: jobId } = params;

    if (!jobId) {
        return new Response('Job ID is required', { status: 400 });
    }

    // Create a readable stream for SSE
    const stream = new ReadableStream({
        async start(controller) {
            const encoder = new TextEncoder();
            
            // Send initial status
            const sendEvent = (data: any) => {
                const message = `data: ${JSON.stringify(data)}\n\n`;
                controller.enqueue(encoder.encode(message));
            };

            // Keep-alive interval
            const keepAlive = setInterval(() => {
                controller.enqueue(encoder.encode(': keep-alive\n\n'));
            }, 15000);

            let lastStatus = '';
            let pollCount = 0;
            const maxPolls = 300; // 5 minutes at 1 second intervals
            const pollInterval = 1000;

            // Poll for updates
            const poll = async () => {
                try {
                    const status = await getJobStatus(jobId);
                    
                    if (!status) {
                        sendEvent({ error: 'Job not found', type: 'error' });
                        clearInterval(keepAlive);
                        controller.close();
                        return;
                    }

                    // Send update if status changed
                    const statusKey = `${status.status}-${status.progress}`;
                    if (statusKey !== lastStatus) {
                        lastStatus = statusKey;
                        sendEvent({ ...status, type: 'update' });
                    }

                    // Check if job is complete
                    if (['completed', 'failed', 'cancelled'].includes(status.status)) {
                        sendEvent({ ...status, type: 'complete' });
                        clearInterval(keepAlive);
                        controller.close();
                        return;
                    }

                    // Continue polling if not complete
                    pollCount++;
                    if (pollCount < maxPolls) {
                        setTimeout(poll, pollInterval);
                    } else {
                        sendEvent({ error: 'Timeout waiting for job', type: 'timeout' });
                        clearInterval(keepAlive);
                        controller.close();
                    }

                } catch (error) {
                    console.error('[SSE] Error polling job status:', error);
                    sendEvent({ 
                        error: error instanceof Error ? error.message : 'Unknown error',
                        type: 'error' 
                    });
                    clearInterval(keepAlive);
                    controller.close();
                }
            };

            // Start polling
            poll();
        },
    });

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-transform',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no', // Disable buffering for nginx
        },
    });
}
