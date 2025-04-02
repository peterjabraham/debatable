import { NextRequest, NextResponse } from 'next/server';
import { MVP_CONFIG } from '@/lib/config';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

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
        // Check if the user just signed out (look for our special cookies)
        const hasSessionToken = request.cookies.has('next-auth.session-token');
        const signOutTimestamp = request.cookies.get('signed-out-timestamp')?.value;
        const isRecentSignOut = signOutTimestamp &&
            (Date.now() - parseInt(signOutTimestamp, 10)) < 60000; // Within last minute

        // If user just signed out, don't create a mock session
        if (!hasSessionToken || isRecentSignOut) {
            console.log('[Auth API] No session token or recent sign-out detected');
            return NextResponse.json(null);
        }

        // Attempt to get the real NextAuth session first, regardless of API server availability
        const session = await getServerSession(authOptions);

        if (session) {
            console.log('[Auth API] Using real NextAuth session');
            return NextResponse.json(session);
        }

        // Skip forwarding to the Express server if it's not available
        if (!MVP_CONFIG.apiServerAvailable) {
            console.log('[Auth API] Backend server unavailable, no valid session found');

            // Return null instead of mock session to prevent using mock data
            return NextResponse.json(null);
        }

        // Forward to the Express server if available
        const response = await fetch(`${MVP_CONFIG.apiUrl}/api/auth/session`, {
            method: 'GET',
            headers: request.headers
        });

        if (!response.ok) {
            throw new Error(`Auth API failed with status: ${response.status}`);
        }

        const data = await response.json();
        return NextResponse.json(data);

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

        // Return null instead of mock session
        return NextResponse.json(null);
    }
} 