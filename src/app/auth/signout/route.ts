import { NextResponse } from 'next/server';

export async function GET() {
    // Clear all authentication cookies
    const response = NextResponse.redirect(new URL('/', process.env.NEXTAUTH_URL));

    // Force-clear all auth-related cookies
    response.cookies.delete('next-auth.session-token');
    response.cookies.delete('next-auth.callback-url');
    response.cookies.delete('next-auth.csrf-token');
    response.cookies.delete('__Secure-next-auth.session-token');
    response.cookies.delete('__Host-next-auth.csrf-token');

    // Set a special cookie to indicate the user just signed out
    // This will be used by the session endpoint to avoid creating a mock session
    response.cookies.set('signed-out-timestamp', Date.now().toString(), {
        path: '/',
        maxAge: 60, // 1 minute
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
    });

    // Add cache control headers to prevent caching
    response.headers.set('Cache-Control', 'no-store, max-age=0');

    console.log('Manual sign-out route executed');

    return response;
} 