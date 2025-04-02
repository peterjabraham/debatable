"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AppPage() {
    const router = useRouter();

    useEffect(() => {
        // Redirect to the debate page
        router.push('/app/debate');
    }, [router]);

    return (
        <div className="flex min-h-screen flex-col items-center justify-center">
            <div className="animate-pulse text-center">
                <h1 className="text-2xl font-bold mb-3">Loading Debate-able...</h1>
                <p className="text-muted-foreground">Preparing your intellectual experience...</p>
            </div>
        </div>
    );
} 