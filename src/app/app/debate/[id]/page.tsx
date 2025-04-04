"use client";

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { DebatePanel } from '@/components/debate/DebatePanel';
import { AppHeader } from '@/components/AppHeader';
import { SavedDebate } from '@/lib/db/models/debate';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { NotificationProvider } from '@/components/ui/notification';

export default function ContinueDebatePage({ params }: { params: { id: string } }) {
    const { data: session, status } = useSession();
    const router = useRouter();
    const { toast } = useToast();
    const [debate, setDebate] = useState<SavedDebate | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchDebate = async () => {
        if (!params.id || status !== 'authenticated') return;

        setIsLoading(true);
        setError(null);

        try {
            const response = await fetch(`/api/debate/${params.id}`);

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `Failed to fetch debate: ${response.status}`);
            }

            const data = await response.json();
            setDebate(data.debate);
        } catch (err) {
            console.error('Error fetching debate:', err);
            setError(err instanceof Error ? err.message : 'Failed to fetch debate');
            toast({
                title: "Error",
                description: "Failed to load debate. Please try again.",
                variant: "destructive",
            });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (status === 'authenticated') {
            fetchDebate();
        } else if (status === 'unauthenticated') {
            router.push('/');
        }
    }, [status, params.id]);

    if (status === 'loading' || isLoading) {
        return (
            <NotificationProvider>
                <div className="flex min-h-screen flex-col">
                    <AppHeader currentPage="debate" />
                    <div className="flex flex-col items-center justify-center flex-1 p-4">
                        <div className="flex items-center space-x-2">
                            <RefreshCw className="h-5 w-5 animate-spin" />
                            <p>Loading debate...</p>
                        </div>
                    </div>
                </div>
            </NotificationProvider>
        );
    }

    if (error) {
        return (
            <NotificationProvider>
                <div className="flex min-h-screen flex-col">
                    <AppHeader currentPage="debate" />
                    <div className="flex flex-col items-center justify-center flex-1 p-4">
                        <div className="max-w-md w-full p-6 rounded-lg border bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200">
                            <h2 className="text-xl font-semibold mb-4">Failed to load debate</h2>
                            <p className="mb-4">{error}</p>
                            <div className="flex space-x-4">
                                <Button variant="outline" onClick={fetchDebate}>
                                    Try Again
                                </Button>
                                <Button onClick={() => router.push('/history')}>
                                    Back to History
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            </NotificationProvider>
        );
    }

    if (!debate) {
        return (
            <NotificationProvider>
                <div className="flex min-h-screen flex-col">
                    <AppHeader currentPage="debate" />
                    <div className="flex flex-col items-center justify-center flex-1 p-4">
                        <div className="max-w-md w-full p-6 rounded-lg border">
                            <h2 className="text-xl font-semibold mb-4">Debate not found</h2>
                            <p className="mb-4">The debate you're looking for doesn't exist or you don't have permission to view it.</p>
                            <Button onClick={() => router.push('/history')}>
                                Back to History
                            </Button>
                        </div>
                    </div>
                </div>
            </NotificationProvider>
        );
    }

    return (
        <NotificationProvider>
            <div className="flex min-h-screen flex-col">
                <AppHeader currentPage="debate" />
                <div className="max-w-4xl mx-auto w-full p-4">
                    <div className="mb-6 bg-gray-700 text-white p-6 rounded-lg border border-gray-500">
                        <h2 className="text-lg font-semibold mb-2">Continuing Debate</h2>
                        <p className="text-sm text-gray-300">
                            Topic: {debate.topic}
                        </p>
                    </div>

                    {/* Pass the existing debate data to the DebatePanel */}
                    <DebatePanel existingDebate={debate} />
                </div>
            </div>
        </NotificationProvider>
    );
} 