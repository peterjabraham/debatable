import { NextRequest, NextResponse } from 'next/server';

// This API key is used to secure the monitoring endpoints
const MONITORING_API_KEY = process.env.MONITORING_API_KEY || 'test-monitoring-key';

/**
 * API endpoint to generate test traffic for metrics monitoring
 * This will make a series of requests to the demo API endpoint with various response types
 */
export async function GET(req: NextRequest) {
    // Check authentication
    const apiKey = req.headers.get('x-api-key');

    if (!apiKey || apiKey !== MONITORING_API_KEY) {
        return NextResponse.json(
            { error: 'Unauthorized' },
            { status: 401 }
        );
    }

    const count = parseInt(req.nextUrl.searchParams.get('count') || '10', 10);
    const result: any = { requests: [] };

    // Get the base URL from the request
    const protocol = req.headers.get('x-forwarded-proto') || 'http';
    const host = req.headers.get('host') || 'localhost:3001';
    const baseUrl = `${protocol}://${host}`;

    try {
        // Make multiple requests to generate metrics
        for (let i = 0; i < count; i++) {
            const type = getRandomRequestType();
            const startTime = performance.now();

            try {
                const response = await fetch(`${baseUrl}/api/monitoring/demo?type=${type}`, {
                    method: 'GET',
                });

                const endTime = performance.now();
                const duration = endTime - startTime;

                result.requests.push({
                    type,
                    status: response.status,
                    duration: Math.round(duration),
                });
            } catch (error) {
                result.requests.push({
                    type,
                    error: 'Request failed',
                });
            }

            // Small delay between requests
            await new Promise(resolve => setTimeout(resolve, 50));
        }

        // Also make a few POST requests
        for (let i = 0; i < Math.ceil(count / 5); i++) {
            try {
                const response = await fetch(`${baseUrl}/api/monitoring/demo`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        test: true,
                        timestamp: new Date().toISOString(),
                    }),
                });

                result.requests.push({
                    type: 'post',
                    status: response.status,
                });
            } catch (error) {
                result.requests.push({
                    type: 'post',
                    error: 'Request failed',
                });
            }
        }

        return NextResponse.json({
            message: `Generated ${result.requests.length} test requests`,
            details: result,
        });
    } catch (error) {
        console.error('Error generating test traffic:', error);
        return NextResponse.json(
            { error: 'Failed to generate test traffic' },
            { status: 500 }
        );
    }
}

/**
 * Helper to get a random request type
 */
function getRandomRequestType(): string {
    const types = ['normal', 'slow', 'error', 'random'];
    const weights = [60, 15, 10, 15]; // Weighted distribution

    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    let random = Math.random() * totalWeight;

    for (let i = 0; i < types.length; i++) {
        if (random < weights[i]) {
            return types[i];
        }
        random -= weights[i];
    }

    return 'normal';
} 