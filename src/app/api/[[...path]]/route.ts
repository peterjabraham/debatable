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

export async function GET(request: NextRequest) {
    try {
        const url = new URL(request.url);

        if (!shouldMockRequest(url)) {
            return NextResponse.next();
        }

        console.log(`[Catch-all API] Handling GET request for: ${url.pathname}`);

        // Return a generic success response
        return NextResponse.json({
            success: true,
            message: 'Mock API response (API server unavailable)',
            path: url.pathname,
            mock: true
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

        // Return a generic success response
        return NextResponse.json({
            success: true,
            message: 'Mock API response (API server unavailable)',
            path: url.pathname,
            mock: true
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