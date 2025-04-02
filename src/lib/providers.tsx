"use client";

import { ReactNode } from "react";
import { SessionProvider } from "next-auth/react";
import { Toaster } from "@/components/ui/toaster";
import { SettingsProvider } from "./contexts/settings-context";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PerplexityProvider } from "./contexts/perplexity-context";
import { PerplexityStatus } from "@/components/ui/PerplexityStatus";
import { ThemeProvider } from "@/components/ThemeProvider";

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
    return (
        <QueryClientProvider client={queryClient}>
            <SessionProvider>
                <ThemeProvider
                    attribute="class"
                    defaultTheme="dark"
                    enableSystem
                    disableTransitionOnChange
                >
                    <SettingsProvider>
                        <PerplexityProvider>
                            {children}
                            <PerplexityStatus />
                            <Toaster />
                        </PerplexityProvider>
                    </SettingsProvider>
                </ThemeProvider>
            </SessionProvider>
        </QueryClientProvider>
    );
} 