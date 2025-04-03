import { NextRequest, NextResponse } from 'next/server';

// Helper to determine if the request needs to be mocked
function shouldMockRequest(url: URL): boolean {
    const path = url.pathname;

    // Skip paths we've already handled with dedicated handlers
    if (path.startsWith('/api/voice') ||
        path.startsWith('/api/auth/session') ||
        path.startsWith('/api/auth/_log') ||
        path.startsWith('/api/debate')) {
        return false;
    }

    return true;
}

// Generate mock topics for document processing endpoints
function generateMockTopics(path: string) {
    // Only include topics for content processing endpoints
    if (path.includes('/api/content/')) {
        return {
            topics: [
                {
                    title: "Climate Change Solutions",
                    confidence: 0.92,
                    arguments: [
                        {
                            claim: "Renewable energy transition",
                            evidence: "Shifting to renewable energy sources like solar and wind can significantly reduce carbon emissions."
                        },
                        {
                            claim: "Carbon pricing mechanisms",
                            evidence: "Implementing carbon taxes or cap-and-trade systems can incentivize emission reductions."
                        }
                    ]
                },
                {
                    title: "Artificial Intelligence Impact",
                    confidence: 0.87,
                    arguments: [
                        {
                            claim: "Economic transformation",
                            evidence: "AI will fundamentally change job markets and create new economic opportunities."
                        },
                        {
                            claim: "Ethical considerations",
                            evidence: "Developing responsible AI requires addressing bias, privacy, and safety concerns."
                        }
                    ]
                }
            ]
        };
    }

    // For other endpoints, return no topics
    return {};
}

export async function GET(request: NextRequest) {
    try {
        const url = new URL(request.url);

        if (!shouldMockRequest(url)) {
            return NextResponse.next();
        }

        console.log(`[Catch-all API] Handling GET request for: ${url.pathname}`);

        // Return a response with mock topics for content endpoints
        const mockTopics = generateMockTopics(url.pathname);

        return NextResponse.json({
            success: true,
            message: 'Mock API response (API server unavailable)',
            path: url.pathname,
            mock: true,
            ...mockTopics
        });

    } catch (error) {
        console.error('[Catch-all API] Error:', error);
        return NextResponse.json(
            { error: 'Internal server error', message: 'Mock API failed' },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const url = new URL(request.url);

        if (!shouldMockRequest(url)) {
            return NextResponse.next();
        }

        console.log(`[Catch-all API] Handling POST request for: ${url.pathname}`);

        // Return a response with mock topics for content endpoints
        const mockTopics = generateMockTopics(url.pathname);

        return NextResponse.json({
            success: true,
            message: 'Mock API response (API server unavailable)',
            path: url.pathname,
            mock: true,
            ...mockTopics
        });

    } catch (error) {
        console.error('[Catch-all API] Error:', error);
        return NextResponse.json(
            { error: 'Internal server error', message: 'Mock API failed' },
            { status: 500 }
        );
    }
}

// Add PUT, DELETE, etc. methods with the same pattern as needed 