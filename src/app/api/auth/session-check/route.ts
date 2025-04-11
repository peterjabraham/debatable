/**
 * Endpoint to diagnose authentication and session issues
 */
import { getServerSession } from 'next-auth/next';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';

export async function GET(request: Request) {
    // Get the current authentication state
    const session = await getServerSession(authOptions);

    // Get headers to check cookie state
    const cookies = request.headers.get('cookie') || '';

    // Parse cookies to identify session cookie
    const parsedCookies = cookies.split(';').reduce((obj, cookie) => {
        const [key, value] = cookie.trim().split('=');
        obj[key] = value;
        return obj;
    }, {} as Record<string, string>);

    // Check for NextAuth session cookie
    const hasSessionCookie = Object.keys(parsedCookies).some(key =>
        key.includes('next-auth.session-token')
    );

    // Determine auth status
    const isAuthenticated = !!session?.user;

    // Check token expiration if available
    let tokenExpired = false;
    if (session?.expires) {
        tokenExpired = new Date(session.expires) < new Date();
    }

    return NextResponse.json({
        authenticated: isAuthenticated,
        sessionExists: !!session,
        hasSessionCookie,
        tokenExpired,
        sessionData: session ? {
            expires: session.expires,
            // Strip sensitive data but keep structure for debugging
            user: session.user ? {
                id: session.user.id,
                name: session.user.name ? "✓" : "✗",
                email: session.user.email ? "✓" : "✗",
                image: session.user.image ? "✓" : "✗"
            } : null
        } : null,
        cookieCount: Object.keys(parsedCookies).length,
        // Show cookie names but not values for security
        cookieNames: Object.keys(parsedCookies),
        requestHeaders: {
            host: request.headers.get('host'),
            referer: request.headers.get('referer'),
            userAgent: request.headers.get('user-agent')?.substring(0, 50) + '...'
        }
    });
} 