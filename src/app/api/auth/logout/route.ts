/**
 * Force logout endpoint for handling problematic authentication states
 * This endpoint clears all NextAuth-related cookies to ensure a clean logout
 */
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    // Define all possible NextAuth cookie names to ensure comprehensive cleanup
    const authCookies = [
        'next-auth.session-token',
        'next-auth.callback-url',
        'next-auth.csrf-token',
        '__Secure-next-auth.session-token',
        '__Secure-next-auth.callback-url',
        '__Secure-next-auth.csrf-token',
        '__Host-next-auth.csrf-token'
    ];

    // Create response with redirect to home page
    const response = NextResponse.redirect(new URL('/', request.url));

    // Clear all NextAuth cookies
    for (const cookieName of authCookies) {
        // Delete cookie with various path and domain combinations
        response.cookies.delete({
            name: cookieName,
            path: '/',
        });

        // Also try with Secure flag options for production environments
        response.cookies.delete({
            name: cookieName,
            path: '/',
            secure: true
        });
    }

    return response;
} 