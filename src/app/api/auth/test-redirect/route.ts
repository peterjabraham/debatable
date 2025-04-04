/**
 * Test endpoint for verifying OAuth redirect URL configurations
 * Only accessible in development mode for security reasons
 */

import { NextResponse } from 'next/server';

/**
 * GET handler to check OAuth redirect URLs
 */
export async function GET(request: Request) {
    // Only allow in development or with a special debug token
    const isDev = process.env.NODE_ENV === 'development';
    const url = new URL(request.url);
    const debugToken = url.searchParams.get('debug_token');
    const hasValidDebugToken = debugToken === process.env.AUTH_DEBUG_TOKEN;

    if (!isDev && !hasValidDebugToken) {
        return NextResponse.json(
            { error: 'This endpoint is only available in development mode or with a valid debug token' },
            { status: 403 }
        );
    }

    // Get the NEXTAUTH_URL from environment
    const nextAuthUrl = process.env.NEXTAUTH_URL;

    // Get configured authentication providers
    const providers = ['google', 'github']; // Add more as needed

    // Generate the expected callback URLs
    const callbackUrls = providers.map((provider) => ({
        provider,
        callbackUrl: `${nextAuthUrl}/api/auth/callback/${provider}`,
    }));

    // Host information for determining potential URL mismatches
    const requestUrl = request.url;
    const requestHost = url.host;
    const nextAuthHost = nextAuthUrl ? new URL(nextAuthUrl).host : 'not-configured';

    // Check if there might be a host mismatch
    const possibleMismatch = requestHost !== nextAuthHost;

    return NextResponse.json({
        environment: process.env.NODE_ENV,
        nextAuthUrl,
        callbackUrls,
        requestInfo: {
            url: requestUrl,
            host: requestHost,
        },
        possibleMismatch,
        diagnosisMessage: possibleMismatch
            ? `Possible redirect_uri_mismatch detected: Your NEXTAUTH_URL (${nextAuthUrl}) has a different host than your current request (${requestHost}).`
            : 'No obvious host mismatch detected.',
        recommendations: [
            'Ensure your NEXTAUTH_URL exactly matches the deployed URL',
            'Check that the OAuth provider has ALL callback URLs registered correctly',
            'For Google, verify authorized redirect URIs in the Google Cloud Console',
            'For GitHub, verify callback URLs in the GitHub OAuth App settings',
            'For production, use the fully qualified domain name with https://'
        ]
    });
} 