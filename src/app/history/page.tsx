"use client";

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AppHeader } from '@/components/AppHeader';
import { Button } from '@/components/ui/button';
import {
    Clock,
    BookOpen,
    ChevronRight,
    Search,
    XCircle,
    RefreshCw,
    Trash2
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { SavedDebate } from '@/lib/db/models/debate';
import { useToast } from '@/components/ui/use-toast';

export default function HistoryPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const { toast } = useToast();
    const [debates, setDebates] = useState<SavedDebate[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [isDeleting, setIsDeleting] = useState<string | null>(null);

    // Format date for display
    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return new Intl.DateTimeFormat('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }).format(date);
    };

    // Function to fetch user's debate history
    const fetchDebateHistory = async () => {
        if (status !== 'authenticated' || !session?.user?.id) {
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const response = await fetch(`/api/debate/history?userId=${session.user.id}`);

            if (!response.ok) {
                throw new Error(`Failed to fetch debate history: ${response.status}`);
            }

            const data = await response.json();
            setDebates(data.debates || []);
        } catch (err) {
            console.error('Error fetching debate history:', err);
            setError(err instanceof Error ? err.message : 'Failed to fetch debate history');
            toast({
                title: "Error",
                description: "Failed to load your debate history. Please try again.",
                variant: "destructive",
            });
        } finally {
            setIsLoading(false);
        }
    };

    // Function to delete a debate
    const deleteDebate = async (debateId: string) => {
        if (!debateId) return;

        setIsDeleting(debateId);

        try {
            const response = await fetch(`/api/debate/${debateId}`, {
                method: 'DELETE',
            });

            if (!response.ok) {
                throw new Error(`Failed to delete debate: ${response.status}`);
            }

            // Remove the deleted debate from state
            setDebates(prev => prev.filter(debate => debate.id !== debateId));

            toast({
                title: "Success",
                description: "Debate deleted successfully",
            });
        } catch (err) {
            console.error('Error deleting debate:', err);
            toast({
                title: "Error",
                description: "Failed to delete the debate. Please try again.",
                variant: "destructive",
            });
        } finally {
            setIsDeleting(null);
        }
    };

    // Filter debates based on search term
    const filteredDebates = debates.filter(debate =>
        debate.topic.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (debate.tags && debate.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase())))
    );

    // Fetch debate history when session is available
    useEffect(() => {
        if (status === 'authenticated') {
            fetchDebateHistory();
        } else if (status === 'unauthenticated') {
            // Redirect to login if not authenticated
            router.push('/');
        }
    }, [status, session]);

    return (
        <>
            <AppHeader currentPage="history" />
            <div className="container mx-auto py-8 px-4">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
                    <h1 className="text-3xl font-bold mb-4 md:mb-0">Debate History</h1>

                    <div className="w-full md:w-auto flex flex-col md:flex-row gap-4">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 dark:text-gray-400 h-4 w-4" />
                            <Input
                                type="text"
                                placeholder="Search debates..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-10 w-full md:w-60"
                            />
                            {searchTerm && (
                                <button
                                    onClick={() => setSearchTerm('')}
                                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 dark:text-gray-400"
                                >
                                    <XCircle className="h-4 w-4" />
                                </button>
                            )}
                        </div>

                        <Button
                            variant="outline"
                            size="icon"
                            onClick={fetchDebateHistory}
                            disabled={isLoading}
                        >
                            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                        </Button>
                    </div>
                </div>

                {isLoading ? (
                    <div className="space-y-4">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="p-6 rounded-lg border bg-card animate-pulse">
                                <div className="h-6 bg-gray-300 dark:bg-gray-700 rounded w-1/3 mb-4"></div>
                                <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-1/2 mb-2"></div>
                                <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-1/4"></div>
                            </div>
                        ))}
                    </div>
                ) : error ? (
                    <div className="p-6 rounded-lg border bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200">
                        <p className="mb-2 font-semibold">Error loading debates</p>
                        <p className="text-sm">{error}</p>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={fetchDebateHistory}
                            className="mt-4"
                        >
                            Try Again
                        </Button>
                    </div>
                ) : filteredDebates.length === 0 ? (
                    <div className="p-8 rounded-lg border bg-card text-center">
                        {searchTerm ? (
                            <>
                                <p className="text-lg font-semibold mb-2">No debates matching "{searchTerm}"</p>
                                <p className="text-sm text-muted-foreground mb-4">Try a different search term or clear your search</p>
                                <Button variant="outline" onClick={() => setSearchTerm('')}>Clear Search</Button>
                            </>
                        ) : (
                            <>
                                <p className="text-lg font-semibold mb-2">No debates yet</p>
                                <p className="text-sm text-muted-foreground mb-4">Start your first debate to see it here</p>
                                <Button asChild>
                                    <Link href="/app/debate">Start a Debate</Link>
                                </Button>
                            </>
                        )}
                    </div>
                ) : (
                    <div className="space-y-4">
                        {filteredDebates.map((debate) => (
                            <div
                                key={debate.id}
                                className="p-6 rounded-lg border bg-card hover:bg-accent hover:text-accent-foreground transition-colors"
                            >
                                <div className="flex flex-col md:flex-row justify-between md:items-center">
                                    <div className="flex-1">
                                        <h3 className="text-xl font-semibold mb-2">{debate.topic}</h3>
                                        <div className="flex flex-wrap gap-2 mb-2">
                                            <div className="flex items-center text-xs text-muted-foreground">
                                                <Clock className="h-3 w-3 mr-1" />
                                                {formatDate(debate.createdAt)}
                                            </div>
                                            <div className="flex items-center text-xs text-muted-foreground">
                                                <BookOpen className="h-3 w-3 mr-1" />
                                                {debate.expertType === 'historical' ? 'Historical Figures' : 'Domain Experts'}
                                            </div>
                                        </div>

                                        {debate.tags && debate.tags.length > 0 && (
                                            <div className="flex flex-wrap gap-1 mt-2">
                                                {debate.tags.map((tag, index) => (
                                                    <span
                                                        key={index}
                                                        className="px-2 py-1 text-xs rounded-full bg-primary/10 text-primary"
                                                    >
                                                        {tag}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex items-center mt-4 md:mt-0 space-x-2">
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                deleteDebate(debate.id);
                                            }}
                                            disabled={isDeleting === debate.id}
                                            className="h-8 w-8"
                                        >
                                            {isDeleting === debate.id ? (
                                                <RefreshCw className="h-4 w-4 animate-spin" />
                                            ) : (
                                                <Trash2 className="h-4 w-4" />
                                            )}
                                        </Button>

                                        <Button asChild>
                                            <Link href={`/app/debate/${debate.id}`}>
                                                Continue
                                                <ChevronRight className="ml-1 h-4 w-4" />
                                            </Link>
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </>
    );
} 