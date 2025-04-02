"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Message } from '@/types/message';
import { Expert } from '@/types/expert';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { BookOpen, BrainCircuit, MessageSquareQuote, ListChecks, ExternalLink, RefreshCw, ChevronDown, Zap } from 'lucide-react';
import { getMultiExpertRecommendedReading } from '@/lib/api/perplexity';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { EnvDebug } from '@/components/debug/EnvDebug';
import { PerplexityDebug } from '@/components/debug/PerplexityDebug';
import { useToast } from '@/lib/hooks/useToast';
import { usePerplexity } from '@/lib/contexts/perplexity-context';
import { PerplexityLoader } from '@/components/ui/PerplexityLoader';
import { ReadingListItem } from './ReadingListItem';

interface DebateSummaryProps {
    topic: string;
    experts: Expert[];
    messages: Message[];
    className?: string;
}

interface ExpertReadingError {
    expert: string;
    error: string;
}

function useDebounce<T>(value: T, delay: number): T {
    const [debouncedValue, setDebouncedValue] = useState<T>(value);

    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);

        return () => {
            clearTimeout(handler);
        };
    }, [value, delay]);

    return debouncedValue;
}

// Helper function to get stance color (match the MessageBubble component colors)
const getStanceColor = (stance: string) => {
    switch (stance?.toLowerCase()) {
        case 'pro':
            return 'bg-green-100 dark:bg-green-900/50 border-green-200 dark:border-green-800';
        case 'con':
            return 'bg-red-100 dark:bg-red-900/50 border-red-200 dark:border-red-800';
        default:
            return 'bg-gray-100 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700';
    }
};

// Update the helper function to get stance color for the collapsible headers
const getCollapsibleStanceColor = (stance: string) => {
    switch (stance?.toLowerCase()) {
        case 'pro':
            return 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800/60';
        case 'con':
            return 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800/60';
        default:
            return 'bg-gray-50 dark:bg-gray-900/30 border-gray-200 dark:border-gray-700/60';
    }
};

// Add a function to generate the TLDR summary
const generateTLDR = (topic: string, messages: Message[], experts: Expert[]): string => {
    // Default TLDR if we can't generate a better one
    let defaultTLDR = `Learn different perspectives on ${topic} from multiple expert viewpoints.`;

    // If we don't have enough messages, return the default
    if (!messages || messages.length < 2) {
        return defaultTLDR;
    }

    // Get the expert stances to identify key perspectives
    const proExperts = experts.filter(e => e.stance?.toLowerCase() === 'pro').map(e => e.name);
    const conExperts = experts.filter(e => e.stance?.toLowerCase() === 'con').map(e => e.name);

    // Get key concluding messages from each side
    const expertMessages = messages.filter(m => m.role === 'assistant');
    // Get the last message from each expert (their concluding thoughts)
    const conclusions = new Map<string, string>();

    for (const message of expertMessages.reverse()) {
        if (message.speaker && !conclusions.has(message.speaker)) {
            conclusions.set(message.speaker, message.content);
        }
        // Once we have a message from each expert, stop looking
        if (conclusions.size >= experts.length) break;
    }

    // Try to extract key phrases
    const keyTerms = [
        "in conclusion", "ultimately", "the key takeaway", "importantly",
        "to summarize", "in summary", "the main point", "overall"
    ];

    let bestConclusionSentence = "";
    let bestScore = -1;

    // Go through each conclusion and find the best sentence
    for (const [expert, content] of conclusions.entries()) {
        const sentences = content.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 15 && s.length < 150);

        for (const sentence of sentences) {
            let score = 0;
            // Check for presence of key terms
            for (const term of keyTerms) {
                if (sentence.toLowerCase().includes(term)) {
                    score += 2;
                    break; // Only count once per term type
                }
            }

            // Prefer sentences with balanced stance language
            const stanceWords = {
                pro: ["benefit", "advantage", "positive", "opportunity", "support", "progress"],
                con: ["risk", "concern", "negative", "problem", "oppose", "danger", "harmful"]
            };

            let proCount = 0;
            let conCount = 0;

            for (const word of stanceWords.pro) {
                if (sentence.toLowerCase().includes(word)) proCount++;
            }
            for (const word of stanceWords.con) {
                if (sentence.toLowerCase().includes(word)) conCount++;
            }

            // Add points for balanced perspective
            if (proCount > 0 && conCount > 0) {
                score += Math.min(proCount, conCount);
            }

            // Prefer shorter, punchier sentences
            if (sentence.length < 100) score += 1;

            // Update best sentence if this one has a higher score
            if (score > bestScore) {
                bestScore = score;
                bestConclusionSentence = sentence;
            }
        }
    }

    // If we found a good conclusion sentence, use it
    if (bestScore >= 2 && bestConclusionSentence) {
        return bestConclusionSentence;
    }

    // If we have both pro and con experts, create a synthesized TLDR
    if (proExperts.length > 0 && conExperts.length > 0) {
        return `Understand both supporting and opposing perspectives on ${topic}, weighing the benefits and challenges presented by experts.`;
    }

    return defaultTLDR;
};

export function DebateSummary({ topic, experts, messages, className }: DebateSummaryProps) {
    // Filter out system messages and group by expert
    const expertMessages = messages.filter(m => m.role === 'assistant').reduce((acc, message) => {
        const expert = experts.find(e => e.name === message.speaker);
        if (expert) {
            if (!acc[expert.stance]) {
                acc[expert.stance] = [];
            }
            acc[expert.stance].push(message);
        }
        return acc;
    }, {} as Record<string, Message[]>);

    // Get user's messages
    const userMessages = messages.filter(m => m.role === 'user');

    // Extract key points from each stance
    const proMessages = expertMessages['pro'] || [];
    const conMessages = expertMessages['con'] || [];

    // Extract key points from all expert messages
    const extractKeyPoints = () => {
        const allExpertMessages = [...(proMessages || []), ...(conMessages || [])];
        const points = new Set<string>();

        allExpertMessages.forEach(message => {
            // Split into sentences and filter out short ones
            const sentences = message.content
                .split(/[.!?]+/)
                .map(s => s.trim())
                .filter(s => s.length > 20 && s.length < 150);

            // Prioritize sentences that contain key phrases
            const keyPhrases = ['importantly', 'key', 'significant', 'crucial', 'essential', 'primary', 'main', 'fundamental'];
            const prioritizedSentences = sentences.sort((a, b) => {
                const aScore = keyPhrases.reduce((score, phrase) =>
                    score + (a.toLowerCase().includes(phrase) ? 1 : 0), 0);
                const bScore = keyPhrases.reduce((score, phrase) =>
                    score + (b.toLowerCase().includes(phrase) ? 1 : 0), 0);
                return bScore - aScore;
            });

            // Take the top sentences
            prioritizedSentences.slice(0, 2).forEach(s => points.add(s));
        });

        return Array.from(points).slice(0, 5);
    };

    const keyPoints = extractKeyPoints();

    // Add state for recommended reading links
    const [recommendedReadings, setRecommendedReadings] = useState<Record<string, any[]>>({});
    const [isLoadingReadings, setIsLoadingReadings] = useState(false);
    const [readingErrors, setReadingErrors] = useState<ExpertReadingError[]>([]);

    // Add these to the component state
    const [retryAfter, setRetryAfter] = useState<number | null>(null);
    const [retryTimeRemaining, setRetryTimeRemaining] = useState<number | null>(null);
    const [retryTimerId, setRetryTimerId] = useState<NodeJS.Timeout | null>(null);

    const debouncedTopic = useDebounce(topic, 500);

    // Add Perplexity context
    const { setLoading: setPerplexityLoading } = usePerplexity();

    // Add a function to handle retry countdown
    const startRetryCountdown = useCallback((seconds: number) => {
        if (retryTimerId) {
            clearInterval(retryTimerId);
        }

        setRetryAfter(seconds);
        setRetryTimeRemaining(seconds);

        const timerId = setInterval(() => {
            setRetryTimeRemaining(prev => {
                const newValue = prev !== null ? prev - 1 : null;
                if (newValue !== null && newValue <= 0) {
                    clearInterval(timerId);
                    setRetryTimerId(null);
                    fetchRecommendedReadings(); // Auto-retry when timer expires
                    return null;
                }
                return newValue;
            });
        }, 1000);

        setRetryTimerId(timerId);

        return () => {
            clearInterval(timerId);
        };
    }, []);

    // Clean up on unmount
    useEffect(() => {
        return () => {
            if (retryTimerId) {
                clearInterval(retryTimerId);
            }
        };
    }, [retryTimerId]);

    // Modify the fetch function to handle 429 responses
    const fetchRecommendedReadings = async () => {
        if (!debouncedTopic || !experts || experts.length === 0) {
            console.log('Missing required data for fetching readings:', { topic: debouncedTopic, experts });
            return;
        }

        setIsLoadingReadings(true);
        setReadingErrors([]);

        // Update Perplexity loading state
        setPerplexityLoading(true);

        try {
            console.log('Fetching recommended readings for:', { topic: debouncedTopic, experts });
            // Format experts for the API
            const expertData = experts.map(expert => ({
                role: expert.name,
                topic: debouncedTopic
            }));

            const response = await fetch('/api/perplexity', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    experts: expertData,
                    topic: debouncedTopic
                })
            });

            // Handle rate limiting specifically
            if (response.status === 429) {
                const data = await response.json();
                const retryAfterHeader = response.headers.get('Retry-After');
                const retrySeconds = retryAfterHeader ? parseInt(retryAfterHeader, 10) : (data.retryAfter || 30);

                console.log(`Rate limited, retry after ${retrySeconds} seconds`);

                setReadingErrors([{
                    expert: 'all',
                    error: `API rate limited. Will retry in ${retrySeconds} seconds. ${data.message || ''}`
                }]);

                // Start the retry countdown
                startRetryCountdown(retrySeconds);

                setIsLoadingReadings(false);
                setPerplexityLoading(false);
                return;
            }

            if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
            }

            const data = await response.json();
            console.log('Received recommended reading results:', data);

            // Process the response
            const readingsRecord: Record<string, any[]> = {};
            const newErrors: ExpertReadingError[] = [];

            // Check if we got the old format or new format
            if (data.results) {
                // New format with separate results object
                data.results.forEach((item: any) => {
                    readingsRecord[item.expert] = item.readings || [];

                    // If this expert had an error, store it
                    if (item.error) {
                        newErrors.push({
                            expert: item.expert,
                            error: item.error
                        });
                    }
                });
            } else {
                // Old format or direct object mapping
                Object.entries(data).forEach(([key, value]) => {
                    // Skip the timestamp or other metadata
                    if (key !== 'timestamp' && key !== 'errors') {
                        readingsRecord[key] = Array.isArray(value) ? value : [];
                    }
                });

                // Check for errors object
                if (data.errors) {
                    Object.entries(data.errors).forEach(([expert, error]) => {
                        newErrors.push({
                            expert,
                            error: String(error)
                        });
                    });
                }
            }

            setRecommendedReadings(readingsRecord);

            if (newErrors.length > 0) {
                setReadingErrors(newErrors);
            }
        } catch (error) {
            console.error('Error fetching recommended readings:', error);
            setReadingErrors([{
                expert: 'all',
                error: error instanceof Error ? error.message : 'Failed to fetch recommended readings'
            }]);
        } finally {
            setIsLoadingReadings(false);
            // Update Perplexity loading state
            setPerplexityLoading(false);
        }
    };

    // Replace the useEffect with our new function
    useEffect(() => {
        fetchRecommendedReadings();
    }, [debouncedTopic, experts, setPerplexityLoading]);

    return (
        <div className={cn("space-y-6 p-6 border rounded-lg", className)}>
            <div className="space-y-2">
                <h2 className="text-xl font-semibold flex items-center gap-2">
                    <BrainCircuit className="h-5 w-5" />
                    Debate Summary
                </h2>
                <p className="text-muted-foreground">
                    Key insights and arguments from the debate on: <span className="font-medium text-foreground">{topic}</span>
                </p>
            </div>

            {/* TLDR Section - Updated with news-style design */}
            <div className="bg-black text-white rounded-lg p-4 mb-2 shadow-lg">
                <div className="flex items-start gap-3">
                    <div className="bg-yellow-400 p-2 rounded-full flex-shrink-0 mt-0.5">
                        <Zap className="h-5 w-5 text-black" />
                    </div>
                    <div className="flex-1">
                        <div className="text-yellow-400 font-bold text-xs mb-1">
                            TLDR INSIGHT
                        </div>
                        <p className="text-base font-medium leading-snug">
                            {generateTLDR(topic, messages, experts)}
                        </p>
                    </div>
                </div>
            </div>

            {/* Key Points Section */}
            {keyPoints.length > 0 && (
                <div className="space-y-3 bg-accent/50 rounded-lg p-4">
                    <h3 className="text-lg font-medium flex items-center gap-2">
                        <ListChecks className="h-4 w-4" />
                        Key Points
                    </h3>
                    <ul className="space-y-2">
                        {keyPoints.map((point, index) => (
                            <li key={index} className="flex gap-2 text-sm">
                                <span className="font-medium text-primary">{index + 1}.</span>
                                <span>{point}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {/* User's Perspective */}
            {userMessages.length > 0 && (
                <div className="space-y-2">
                    <h3 className="text-lg font-medium">Your Perspective</h3>
                    <div className="bg-primary/5 rounded-lg p-4">
                        <p className="text-sm">{userMessages[userMessages.length - 1].content}</p>
                    </div>
                </div>
            )}

            {/* Supporting Arguments */}
            {proMessages.length > 0 && (
                <div className="space-y-2">
                    <h3 className="text-lg font-medium flex items-center gap-2">
                        <MessageSquareQuote className="h-4 w-4 text-[hsl(142,76%,36%)]" />
                        Supporting Arguments
                    </h3>
                    <div className="space-y-2">
                        {proMessages.map((message, index) => (
                            <div key={index} className="bg-green-100 dark:bg-green-900/20 rounded-lg p-4">
                                <p className="text-sm font-medium mb-1">{message.speaker}</p>
                                <p className="text-sm">{message.content}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Opposing Arguments */}
            {conMessages.length > 0 && (
                <div className="space-y-2">
                    <h3 className="text-lg font-medium flex items-center gap-2">
                        <MessageSquareQuote className="h-4 w-4 text-destructive" />
                        Opposing Arguments
                    </h3>
                    <div className="space-y-2">
                        {conMessages.map((message, index) => (
                            <div key={index} className="bg-red-100 dark:bg-red-900/20 rounded-lg p-4">
                                <p className="text-sm font-medium mb-1">{message.speaker}</p>
                                <p className="text-sm">{message.content}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Recommended Reading Section */}
            <div className="space-y-2">
                <h3 className="text-lg font-medium flex items-center gap-2">
                    <BookOpen className="h-4 w-4" />
                    Recommended Reading
                </h3>

                {isLoadingReadings ? (
                    <div className="p-4 border rounded-lg">
                        <PerplexityLoader
                            message="Loading recommended readings"
                            subtitle="Fetching insights from Perplexity"
                        />
                    </div>
                ) : readingErrors.length > 0 && readingErrors[0].expert === 'all' ? (
                    <div className="p-4 text-center rounded-lg border border-red-200 bg-red-50 dark:bg-red-900/10 dark:border-red-900/30">
                        <p className="text-red-500 dark:text-red-400 mb-2">{readingErrors[0].error}</p>

                        {retryTimeRemaining !== null ? (
                            <div className="text-sm text-muted-foreground">
                                Retrying in {retryTimeRemaining} seconds...
                                <div className="w-full bg-gray-200 dark:bg-gray-700 h-1 mt-2 rounded-full overflow-hidden">
                                    <div
                                        className="bg-primary h-full transition-all duration-1000"
                                        style={{
                                            width: `${retryAfter ? (100 - (retryTimeRemaining / retryAfter * 100)) : 0}%`
                                        }}
                                    ></div>
                                </div>
                            </div>
                        ) : (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => fetchRecommendedReadings()}
                                className="mt-2"
                            >
                                Retry Now
                            </Button>
                        )}
                    </div>
                ) : (
                    <div className="space-y-4">
                        {experts.map((expert) => (
                            <Collapsible
                                key={expert.name}
                                className={cn(
                                    "border rounded-lg overflow-hidden transition-colors",
                                    getCollapsibleStanceColor(expert.stance || '')
                                )}
                            >
                                <CollapsibleTrigger className="w-full p-4 flex items-center justify-between">
                                    <div>
                                        <h4 className="font-medium">{expert.name}</h4>
                                        <p className="text-sm text-muted-foreground">
                                            {expert.expertise ? (Array.isArray(expert.expertise) ? expert.expertise.join(', ') : expert.expertise) : 'Expert'}
                                        </p>
                                    </div>
                                    <ChevronDown className="h-4 w-4" />
                                </CollapsibleTrigger>

                                <CollapsibleContent>
                                    <div className="p-4 pt-0 border-t border-border/40">
                                        {recommendedReadings[expert.name]?.length > 0 ? (
                                            <div className="space-y-4">
                                                {recommendedReadings[expert.name].map((reading) => (
                                                    <ReadingListItem
                                                        key={reading.id}
                                                        reading={reading}
                                                        expert={expert}
                                                    />
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="text-center text-muted-foreground py-4">
                                                {readingErrors.find(e => e.expert === expert.name)?.error ||
                                                    'No recommended readings found for this expert.'}
                                            </div>
                                        )}
                                    </div>
                                </CollapsibleContent>
                            </Collapsible>
                        ))}
                    </div>
                )}
            </div>
            <EnvDebug />
            {/* Add Perplexity Debug Component */}
            <div className="mt-6 pt-6 border-t">
                <PerplexityDebug />
            </div>
        </div>
    );
} 