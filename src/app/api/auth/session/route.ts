import { NextRequest, NextResponse } from 'next/server';
import { MVP_CONFIG } from '@/lib/config';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

// Function to create a properly structured null session
function getNullSession() {
    return {
        user: null,
        expires: new Date(0).toISOString()
    };
}

// Function to create a properly structured mock session
function getMockSession() {
    return {
        user: {
            id: "mock-user-id",
            name: "Test User",
            email: "test@example.com",
            image: null
        },
        expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    };
}

export async function GET(request: NextRequest) {
    try {
        // Check for signout indicators
        const hasSessionToken = request.cookies.has('next-auth.session-token') ||
            request.cookies.has('__Secure-next-auth.session-token');
        const signOutTimestamp = request.cookies.get('signed-out-timestamp')?.value;
        const hasSignOutParam = request.nextUrl.searchParams.has('signout');
        const isRecentSignOut = signOutTimestamp &&
            (Date.now() - parseInt(signOutTimestamp, 10)) < 60000; // Within last minute

        // If user just signed out or sign-out indicators are present, return null session
        if (!hasSessionToken || isRecentSignOut || hasSignOutParam) {
            console.log('[Auth API] No session token or sign-out detected');

            // Return structured null session instead of null
            const response = NextResponse.json(getNullSession());
            response.headers.set('Cache-Control', 'no-store, max-age=0, must-revalidate');
            return response;
        }

        // Attempt to get the real NextAuth session
        const session = await getServerSession(authOptions);

        if (session) {
            console.log('[Auth API] Using real NextAuth session');
            const response = NextResponse.json(session);
            response.headers.set('Cache-Control', 'private, no-cache, no-store, must-revalidate');
            return response;
        }

        // Skip forwarding to the Express server if it's not available
        if (!MVP_CONFIG.apiServerAvailable) {
            console.log('[Auth API] Backend server unavailable, no valid session found');
            // Return structured null session
            return NextResponse.json(getNullSession());
        }

        // Forward to the Express server if available
        const response = await fetch(`${MVP_CONFIG.apiUrl}/api/auth/session`, {
            method: 'GET',
            headers: {
                ...Object.fromEntries(request.headers),
                'Cache-Control': 'no-cache, no-store, must-revalidate'
            }
        });

        if (!response.ok) {
            throw new Error(`Auth API failed with status: ${response.status}`);
        }

        // Parse the response data
        const data = await response.json();

        // Ensure we're returning a properly structured response
        const responseData = data || getNullSession();

        const apiResponse = NextResponse.json(responseData);
        apiResponse.headers.set('Cache-Control', 'no-store, max-age=0');
        return apiResponse;

    } catch (error) {
        console.error('[Auth API] Error:', error);

        // Try once more to get the real session
        try {
            const session = await getServerSession(authOptions);
            if (session) {
                console.log('[Auth API] Using real NextAuth session after error');
                return NextResponse.json(session);
            }
        } catch (e) {
            console.error('[Auth API] Failed to get session after error:', e);
        }

        // Return structured null session with no-cache headers
        const response = NextResponse.json(getNullSession());
        response.headers.set('Cache-Control', 'no-store, max-age=0, must-revalidate');
        return response;
    }
} 