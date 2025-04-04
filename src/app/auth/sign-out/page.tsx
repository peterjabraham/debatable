"use client";

import { useEffect } from "react";
import { signOut } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function SignOutPage() {
    const router = useRouter();

    useEffect(() => {
        async function handleSignOut() {
            // Store the original fetch function
            const originalFetch = window.fetch;

            try {
                // Patch window.fetch to prevent NextAuth from throwing errors on fetch calls during sign-out
                window.fetch = function (...args) {
                    // If this is a NextAuth session endpoint request during sign-out, return empty session
                    if (args[0] && typeof args[0] === 'string' && args[0].includes('/api/auth/session')) {
                        console.log('[Patched fetch] Intercepting NextAuth session request');
                        return Promise.resolve(new Response(JSON.stringify(null), {
                            status: 200,
                            headers: { 'Content-Type': 'application/json' }
                        }));
                    }
                    // Otherwise, use the original fetch
                    return originalFetch.apply(this, args);
                };

                // Clear any client-side storage related to authentication
                localStorage.removeItem('next-auth.session-token');
                localStorage.removeItem('next-auth.callback-url');
                localStorage.removeItem('next-auth.csrf-token');
                sessionStorage.removeItem('next-auth.session-token');
                sessionStorage.removeItem('next-auth.callback-url');
                sessionStorage.removeItem('next-auth.csrf-token');

                // First try our custom sign-out route
                await fetch('/auth/signout', {
                    method: 'GET',
                    cache: 'no-store',
                    credentials: 'include',
                    headers: {
                        'Cache-Control': 'no-cache, no-store, must-revalidate'
                    }
                });

                // Create a safe default session object to avoid "null to object" errors
                const safeSession = {
                    user: null,
                    expires: new Date(0).toISOString()
                };

                // Call NextAuth signOut with custom options
                try {
                    await signOut({
                        redirect: false,
                        callbackUrl: '/'
                    });
                } catch (signOutError) {
                    console.log('Expected error during signOut, continuing:', signOutError);
                }

                // Short delay to allow cookies to be processed
                await new Promise(resolve => setTimeout(resolve, 100));

                // Navigate with direct location change to ensure complete page reload
                window.location.href = "/?signout=true";

            } catch (error) {
                console.error("Error during sign out:", error);
                // Restore original fetch
                window.fetch = originalFetch;
                // Fallback to direct navigation
                window.location.href = "/?signout=error";
            } finally {
                // Always restore the original fetch function to avoid side effects
                window.fetch = originalFetch;
            }
        }

        handleSignOut();
    }, [router]);

    return (
        <div className="flex min-h-screen flex-col items-center justify-center">
            <h1 className="text-2xl font-semibold mb-4">Signing you out...</h1>
            <p className="text-muted-foreground">Please wait while we sign you out safely.</p>
        </div>
    );
} 