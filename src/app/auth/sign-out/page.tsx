"use client";

import { useEffect } from "react";
import { signOut } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function SignOutPage() {
    const router = useRouter();

    useEffect(() => {
        async function handleSignOut() {
            try {
                // First try our custom sign-out route
                await fetch('/auth/signout');

                // Then use the NextAuth signOut method as a fallback
                await signOut({ redirect: false });

                // Redirect to home page after a short delay
                setTimeout(() => {
                    router.push("/");
                    // Force a full page reload as a last resort
                    setTimeout(() => {
                        window.location.href = "/";
                    }, 500);
                }, 500);
            } catch (error) {
                console.error("Error during sign out:", error);
                // Fallback to direct navigation
                window.location.href = "/";
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