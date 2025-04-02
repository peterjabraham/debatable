"use client";

import { signIn, signOut } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useState, Suspense } from "react";

function SignInContent() {
    const searchParams = useSearchParams();
    const callbackUrl = searchParams.get("callbackUrl") || "/";
    const [error, setError] = useState("");

    const handleGoogleSignIn = async () => {
        try {
            console.log("Starting Google sign-in process");
            // First sign out to clear any existing sessions
            await signOut({ redirect: false });
            console.log("Signed out successfully");

            // Then sign in with Google
            const result = await signIn("google", {
                callbackUrl,
                redirect: false
            });

            console.log("Sign-in result:", result);

            if (result?.error) {
                setError(`Sign-in error: ${result.error}`);
            }
        } catch (err) {
            console.error("Error during sign-in:", err);
            setError(`Unexpected error: ${err.message}`);
        }
    };

    return (
        <div className="flex min-h-screen flex-col items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
            <div className="w-full max-w-md space-y-8">
                <div className="text-center">
                    <h1 className="text-3xl font-bold">Sign in to Debate-able</h1>
                    <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                        Access your account and saved debates
                    </p>
                </div>

                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                        {error}
                    </div>
                )}

                <div className="mt-8 space-y-6">
                    <div className="space-y-4">
                        <Button
                            className="w-full flex items-center justify-center gap-2"
                            onClick={() => signIn("github", { callbackUrl })}
                        >
                            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                            </svg>
                            Continue with GitHub
                        </Button>

                        <Button
                            className="w-full flex items-center justify-center gap-2 bg-white text-black hover:bg-gray-100 border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:hover:bg-gray-700"
                            onClick={handleGoogleSignIn}
                        >
                            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none">
                                <path d="M21.8055 10.0415H21V10H12V14H17.6515C16.827 16.3285 14.6115 18 12 18C8.6865 18 6 15.3135 6 12C6 8.6865 8.6865 6 12 6C13.5295 6 14.921 6.577 15.9805 7.5195L18.809 4.691C17.023 3.0265 14.634 2 12 2C6.4775 2 2 6.4775 2 12C2 17.5225 6.4775 22 12 22C17.5225 22 22 17.5225 22 12C22 11.3295 21.931 10.675 21.8055 10.0415Z" fill="#FFC107" />
                                <path d="M3.15308 7.3455L6.43858 9.755C7.32758 7.554 9.48058 6 12.0001 6C13.5296 6 14.9211 6.577 15.9806 7.5195L18.8091 4.691C17.0231 3.0265 14.6341 2 12.0001 2C8.15908 2 4.82808 4.1685 3.15308 7.3455Z" fill="#FF3D00" />
                                <path d="M12.0001 22C14.5831 22 16.9301 21.0115 18.7046 19.404L15.6097 16.785C14.5719 17.5742 13.3039 18.001 12.0001 18C9.39915 18 7.19015 16.3415 6.35765 14.027L3.09915 16.5395C4.75265 19.778 8.11415 22 12.0001 22Z" fill="#4CAF50" />
                                <path d="M21.8055 10.0415H21V10H12V14H17.6515C17.2571 15.1082 16.5467 16.0766 15.608 16.7855L15.6095 16.7845L18.7045 19.4035C18.4855 19.6025 22 17 22 12C22 11.3295 21.931 10.675 21.8055 10.0415Z" fill="#1976D2" />
                            </svg>
                            Continue with Google
                        </Button>
                    </div>
                </div>

                <p className="mt-4 text-center text-sm text-gray-600 dark:text-gray-400">
                    By signing in, you agree to our{" "}
                    <Link href="/terms" className="font-medium text-primary hover:text-primary-600">
                        Terms of Service
                    </Link>{" "}
                    and{" "}
                    <Link href="/privacy" className="font-medium text-primary hover:text-primary-600">
                        Privacy Policy
                    </Link>
                </p>
            </div>
        </div>
    );
}

// Loading fallback for Suspense
function SignInLoading() {
    return (
        <div className="flex min-h-screen flex-col items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
            <div className="w-full max-w-md space-y-8 text-center">
                <h2 className="text-3xl font-bold">Loading...</h2>
                <p>Please wait while we prepare the sign-in page</p>
            </div>
        </div>
    );
}

export default function SignIn() {
    return (
        <Suspense fallback={<SignInLoading />}>
            <SignInContent />
        </Suspense>
    );
} 