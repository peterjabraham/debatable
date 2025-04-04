"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function AuthResetPage() {
    const router = useRouter();
    const [status, setStatus] = useState("Resetting authentication state...");

    useEffect(() => {
        async function resetAuth() {
            try {
                // Step 1: Clear browser storage
                setStatus("Clearing browser storage...");

                // Clear localStorage
                localStorage.clear();

                // Clear sessionStorage
                sessionStorage.clear();

                // Step 2: Delete all cookies manually using document.cookie
                setStatus("Clearing cookies...");

                // Get all cookies
                const cookies = document.cookie.split(';');

                // Set each cookie to expired
                for (let i = 0; i < cookies.length; i++) {
                    const cookie = cookies[i];
                    const eqPos = cookie.indexOf('=');
                    const name = eqPos > -1 ? cookie.substring(0, eqPos).trim() : cookie.trim();

                    // Skip empty cookie names
                    if (!name) continue;

                    // Expire the cookie with all possible path/domain combinations
                    document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
                    document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT`;
                }

                // Step 3: Call our API route to handle server-side reset
                setStatus("Calling server-side reset...");
                await fetch('/api/auth/reset', {
                    cache: 'no-store',
                    credentials: 'include',
                    headers: {
                        'Cache-Control': 'no-cache'
                    }
                });

                // Step 4: Force a reload of the window to ensure everything is reset
                setStatus("Completing reset...");

                setTimeout(() => {
                    setStatus("Redirecting to home page...");
                    // Use a reset parameter to help clear cache
                    window.location.href = "/?reset=" + Date.now();
                }, 1000);

            } catch (error) {
                console.error("Error during auth reset:", error);
                setStatus("Error occurred during reset. Please try again.");

                // Fallback redirect
                setTimeout(() => {
                    window.location.href = "/?reset-error=true";
                }, 2000);
            }
        }

        resetAuth();
    }, [router]);

    return (
        <div className="flex min-h-screen flex-col items-center justify-center">
            <h1 className="text-2xl font-semibold mb-4">Auth System Reset</h1>
            <div className="flex flex-col items-center justify-center space-y-4">
                <div className="w-16 h-16 border-4 border-primary border-solid rounded-full border-t-transparent animate-spin"></div>
                <p className="text-muted-foreground">{status}</p>
            </div>
        </div>
    );
} 