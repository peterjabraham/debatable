import { NextRequest, NextResponse } from 'next/server';
import { vercelMonitoring } from '@/lib/vercel/monitoring';

export async function GET(request: NextRequest) {
    // Extract query parameters
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'latest';

    try {
        // Validate that the request has proper authorization
        // In a real app, you'd implement proper auth checks here
        // This is a simple example using an API key approach
        const apiKey = request.headers.get('x-api-key');
        const validApiKey = process.env.MONITORING_API_KEY;

        if (!apiKey || apiKey !== validApiKey) {
            return NextResponse.json(
                { error: 'Unauthorized access' },
                { status: 401 }
            );
        }

        // Handle different monitoring actions
        switch (action) {
            case 'latest':
                const latestDeployment = await vercelMonitoring.getLatestDeployment();
                return NextResponse.json({ deployment: latestDeployment });

            case 'logs':
                const deploymentId = searchParams.get('deploymentId');
                if (!deploymentId) {
                    return NextResponse.json(
                        { error: 'deploymentId is required' },
                        { status: 400 }
                    );
                }
                const logs = await vercelMonitoring.getDeploymentLogs(deploymentId);
                return NextResponse.json({ logs });

            case 'deployments':
                const limit = parseInt(searchParams.get('limit') || '10', 10);
                const deployments = await vercelMonitoring.getDeployments(limit);
                return NextResponse.json({ deployments });

            case 'project':
                const projectDetails = await vercelMonitoring.getProjectDetails();
                return NextResponse.json({ project: projectDetails });

            case 'metrics':
                const metrics = await vercelMonitoring.getFunctionsMetrics();
                return NextResponse.json({ metrics });

            case 'domains':
                const domains = await vercelMonitoring.getDomains();
                return NextResponse.json({ domains });

            default:
                return NextResponse.json(
                    { error: 'Invalid action' },
                    { status: 400 }
                );
        }
    } catch (error) {
        console.error('Monitoring API error:', error);

        const errorMessage = error instanceof Error
            ? error.message
            : 'An unknown error occurred';

        return NextResponse.json(
            { error: errorMessage },
            { status: 500 }
        );
    }
} 