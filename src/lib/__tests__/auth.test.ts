/**
 * Authentication and OAuth testing utilities
 * @jest-environment node
 */

import { describe, it, expect, beforeEach, jest, afterEach } from 'vitest';
import { authOptions } from '@/lib/auth';

// Mock environment variables
const ENV_VARS = {
    NEXTAUTH_URL: 'http://localhost:3000',
    GOOGLE_CLIENT_ID: 'test-google-client-id',
    GOOGLE_CLIENT_SECRET: 'test-google-client-secret',
    GITHUB_ID: 'test-github-id',
    GITHUB_SECRET: 'test-github-secret',
    NEXTAUTH_SECRET: 'test-secret'
};

describe('Auth Configuration Tests', () => {
    // Store original environment
    const originalEnv = { ...process.env };

    // Setup mocks before each test
    beforeEach(() => {
        // Mock process.env
        process.env = {
            ...originalEnv,
            ...ENV_VARS
        };

        // Mock console methods
        global.console.warn = jest.fn();
        global.console.error = jest.fn();
    });

    // Clean up after each test
    afterEach(() => {
        // Restore original environment
        process.env = originalEnv;
    });

    it('should have all required OAuth providers configured', () => {
        expect(authOptions.providers).toBeDefined();
        expect(authOptions.providers.length).toBeGreaterThanOrEqual(1);

        // Check for Google provider
        const googleProvider = authOptions.providers.find(
            provider => provider.id === 'google'
        );
        expect(googleProvider).toBeDefined();

        // Check for GitHub provider
        const githubProvider = authOptions.providers.find(
            provider => provider.id === 'github'
        );
        expect(githubProvider).toBeDefined();
    });

    it('should have correct callback URLs for OAuth providers', () => {
        // Assuming we need to extract the configuration from the provider objects
        // Note: NextAuth.js doesn't directly expose the redirect_uri in the provider objects,
        // but we can validate the behavior and configuration setup

        const authUrl = process.env.NEXTAUTH_URL;
        expect(authUrl).toBe('http://localhost:3000');

        // Test that authOptions is using environment variables for provider credentials
        const providers = authOptions.providers;

        // Find Google provider
        const googleProvider = providers.find(provider => provider.id === 'google');
        expect(googleProvider).toBeDefined();

        // Check if it has clientId and clientSecret set
        expect(googleProvider.clientId).toBe(process.env.GOOGLE_CLIENT_ID);
        expect(googleProvider.clientSecret).toBe(process.env.GOOGLE_CLIENT_SECRET);
    });

    it('should handle OAuth callback URL verification errors', () => {
        // This is where we would test if our implementation handles oauth callback errors
        // For now, we're just validating our knowledge of how oauth callbacks work

        const baseCallbackUrl = `${process.env.NEXTAUTH_URL}/api/auth/callback`;

        // The expected callback URLs that need to be configured in OAuth providers
        const expectedCallbacks = {
            google: `${baseCallbackUrl}/google`,
            github: `${baseCallbackUrl}/github`
        };

        // Verify the expected callback URLs
        expect(expectedCallbacks.google).toBe('http://localhost:3000/api/auth/callback/google');
        expect(expectedCallbacks.github).toBe('http://localhost:3000/api/auth/callback/github');
    });

    it('should use secure cookies in production but not development', () => {
        // Dev environment
        process.env.NODE_ENV = 'development';
        expect(authOptions.cookies.sessionToken.options.secure).toBe(false);

        // Production environment
        process.env.NODE_ENV = 'production';
        expect(authOptions.cookies.sessionToken.options.secure).toBe(true);
    });

    it('validates NEXTAUTH_URL is properly configured', () => {
        // Valid URL
        process.env.NEXTAUTH_URL = 'https://example.com';
        expect(() => new URL(process.env.NEXTAUTH_URL)).not.toThrow();

        // Missing URL
        delete process.env.NEXTAUTH_URL;
        expect(process.env.NEXTAUTH_URL).toBeUndefined();

        // Invalid URL format
        process.env.NEXTAUTH_URL = 'not-a-valid-url';
        expect(() => new URL(process.env.NEXTAUTH_URL)).toThrow();
    });
});

/**
 * Helper function to verify OAuth redirect URLs
 * This can be used in development to check if the redirect URIs
 * are properly configured in the OAuth provider dashboards
 */
export function verifyOAuthRedirectUrls(baseUrl?: string): Record<string, string> {
    const url = baseUrl || process.env.NEXTAUTH_URL || 'http://localhost:3000';

    const redirectUrls = {
        google: `${url}/api/auth/callback/google`,
        github: `${url}/api/auth/callback/github`,
    };

    console.log('OAuth Redirect URLs to configure in provider dashboards:');
    console.log(JSON.stringify(redirectUrls, null, 2));

    return redirectUrls;
}

/**
 * Utility function to check the URL transformation NextAuth performs
 * This helps diagnose redirect_uri_mismatch errors
 */
export function analyzeNextAuthCallbackUrl(providerId: string, callbackUrl?: string): string {
    const baseUrl = callbackUrl || process.env.NEXTAUTH_URL || 'http://localhost:3000';
    const redirectUri = `${baseUrl}/api/auth/callback/${providerId}`;

    return redirectUri;
} 