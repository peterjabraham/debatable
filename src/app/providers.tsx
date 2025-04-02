"use client";

// Re-export the Providers from lib/providers
export { Providers } from '@/lib/providers';

import { ThemeProvider } from "@/components/ThemeProvider";
import { NotificationProvider } from "@/components/ui/notification";

export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <ThemeProvider
            attribute="class"
            defaultTheme="dark"
            enableSystem
            disableTransitionOnChange
        >
            <NotificationProvider>
                {children}
            </NotificationProvider>
        </ThemeProvider>
    );
} 