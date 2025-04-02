import { NextRequest, NextResponse } from 'next/server';
import { trackApiMetrics } from '@/lib/monitoring/api-metrics';

/**
 * Demo API route that shows how to use the API metrics tracking
 * This demonstrates slow and fast responses, as well as errors
 */
export async function GET(req: NextRequest) {
    return trackApiMetrics(req, '/api/monitoring/demo', async () => {
        // Get the query parameter to simulate different behaviors
        const type = req.nextUrl.searchParams.get('type') || 'normal';

        switch (type) {
            case 'slow':
                // Simulate a slow API response
                await new Promise(resolve => setTimeout(resolve, 1500));
                return NextResponse.json({
                    message: 'This was a slow response (1.5 seconds)',
                    timestamp: new Date().toISOString()
                });

            case 'error':
                // Simulate an API error
                return NextResponse.json(
                    { error: 'This is a simulated error response' },
                    { status: 500 }
                );

            case 'random':
                // Simulate random response times between 100ms and 800ms
                const delay = Math.floor(Math.random() * 700) + 100;
                await new Promise(resolve => setTimeout(resolve, delay));
                return NextResponse.json({
                    message: `Random response time (${delay}ms)`,
                    timestamp: new Date().toISOString()
                });

            default:
                // Normal, fast response
                return NextResponse.json({
                    message: 'This is a normal response',
                    timestamp: new Date().toISOString()
                });
        }
    });
}

export async function POST(req: NextRequest) {
    return trackApiMetrics(req, '/api/monitoring/demo', async () => {
        // Simulate processing a POST request with 200-400ms delay
        await new Promise(resolve => setTimeout(resolve, Math.floor(Math.random() * 200) + 200));

        try {
            const body = await req.json();
            return NextResponse.json({
                message: 'POST request processed successfully',
                received: body,
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            return NextResponse.json(
                { error: 'Invalid JSON in request body' },
                { status: 400 }
            );
        }
    });
} 