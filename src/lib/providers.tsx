"use client";

import { ReactNode, useEffect } from "react";
import { SessionProvider } from "next-auth/react";
import { Toaster } from "@/components/ui/toaster";
import { SettingsProvider } from "./contexts/settings-context";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Create a client
const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 1000 * 60, // 1 minute
            cacheTime: 1000 * 60 * 10, // 10 minutes
            retry: 1,
            refetchOnWindowFocus: false,
        },
    },
});

interface ProvidersProps {
    children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
    // Add global error handler for NextAuth's fetch errors
    useEffect(() => {
        const originalError = console.error;

        // Replace console.error to filter out specific NextAuth errors
        console.error = function (...args) {
            // Check if this is the specific NextAuth error
            const errorMsg = args[0]?.toString() || '';
            if (
                errorMsg.includes('[next-auth][error][CLIENT_FETCH_ERROR]') &&
                (args[1]?.toString()?.includes('Cannot convert undefined or null to object') ||
                    args[1] === 'Cannot convert undefined or null to object')
            ) {
                // Log a friendly message instead
                console.log('[Auth] Suppressed known NextAuth error during state transitions');
                return; // Don't forward to console.error
            }

            // Forward all other errors to the original console.error 
            try {
                // First check if args is valid before using apply
                if (!args || args.length === 0) {
                    // If args is empty or invalid, just call the original error directly
                    originalError.call(console, '[Error Handler] Empty or invalid error arguments');
                    return;
                }

                // Make sure args is an array-like object that can be used with apply
                const safeArgs = Array.isArray(args) ? args : Array.from(args);

                // Copy args to a new array to avoid potential issues with array-like objects
                const argsCopy = [...safeArgs];

                // Then try with apply, which is safer for variable arguments
                if (typeof originalError.apply === 'function') {
                    originalError.apply(console, argsCopy);
                } else {
                    // Fallback if apply is not available
                    originalError.call(console, ...argsCopy);
                }
            } catch (applyError) {
                // Log the apply error for debugging
                console.log('[Error Handler] Error using apply:', applyError);

                // Fallback: try to use call with individual arguments
                try {
                    // First try with the main error message
                    if (args && args.length > 0) {
                        // Try to get a string representation of the first argument
                        const firstArg = args[0] ? String(args[0]) : 'undefined error';
                        originalError.call(console, '[Error Handler] Error forwarding:', firstArg);
                    } else {
                        originalError.call(console, '[Error Handler] Error forwarding, but no details available');
                    }
                } catch (callError) {
                    // Last resort: log with native console.log
                    console.log('[Error Handler] Failed to forward error through original handler');
                }
            }
        };

        // Cleanup
        return () => {
            console.error = originalError;
        };
    }, []);

    return (
        <QueryClientProvider client={queryClient}>
            <SessionProvider
                refetchInterval={0}
                refetchOnWindowFocus={false}
                refetchWhenOffline={false}
                onUnauthenticated={() => {
                    // Handle unauthenticated state gracefully
                    console.log('[SessionProvider] Session is unauthenticated');
                }}
            >
                <SettingsProvider>
                    {children}
                    <Toaster />
                </SettingsProvider>
            </SessionProvider>
        </QueryClientProvider>
    );
} 