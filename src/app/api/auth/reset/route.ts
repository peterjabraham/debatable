import { NextRequest, NextResponse } from 'next/server';

/**
 * API route to completely reset the authentication state
 * This is useful when the auth system gets into a bad state
 */
export async function GET(request: NextRequest) {
    try {
        // Create a response that redirects to the home page
        const response = NextResponse.redirect(new URL('/', process.env.NEXTAUTH_URL));

        // Clear all possible auth cookies
        const cookiesToClear = [
            // Standard NextAuth cookies
            'next-auth.session-token',
            'next-auth.callback-url',
            'next-auth.csrf-token',

            // Secure variants
            '__Secure-next-auth.session-token',
            '__Secure-next-auth.callback-url',
            '__Host-next-auth.csrf-token',

            // Other possible variants
            '__Host-next-auth.session-token',
            '__Secure-next-auth.pkce.code_verifier',

            // Our custom cookies
            'signed-out-timestamp'
        ];

        // Clear each cookie with all possible paths and domains
        cookiesToClear.forEach(name => {
            // Clear with default options
            response.cookies.delete(name);

            // Clear with explicit path
            response.cookies.delete(name, { path: '/' });

            // Also set to expired value as a backup strategy
            response.cookies.set(name, '', {
                expires: new Date(0),
                path: '/',
                maxAge: 0
            });
        });

        // Add cache control headers to prevent caching
        response.headers.set('Cache-Control', 'no-store, max-age=0, must-revalidate');
        response.headers.set('Pragma', 'no-cache');
        response.headers.set('Expires', '0');

        console.log('Authentication reset executed');

        return response;
    } catch (error) {
        console.error('Error in auth reset route:', error);
        return NextResponse.json({ error: 'Failed to reset auth state' }, { status: 500 });
    }
} 