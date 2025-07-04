"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Message } from '@/types/message';
import { Expert } from '@/types/expert';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { BookOpen, BrainCircuit, MessageSquareQuote, ListChecks, ExternalLink } from 'lucide-react';
import { getMultiExpertRecommendedReading } from '@/lib/api/perplexity';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown } from 'lucide-react';
import { PerplexityService, type ReadingError } from '@/lib/services/PerplexityService';
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

    const debouncedTopic = useDebounce(topic, 500);

    // Fetch recommended readings when component mounts
    useEffect(() => {
        const fetchRecommendedReadings = async () => {
            if (!debouncedTopic || !experts || experts.length === 0) {
                console.log('Missing required data for fetching readings:', { topic: debouncedTopic, experts });
                return;
            }

            setIsLoadingReadings(true);
            setReadingErrors([]);

            // Use our new dedicated service for Perplexity
            try {
                console.log('Fetching recommended readings for:', { topic: debouncedTopic, experts });

                // Use the PerplexityService singleton
                const perplexityService = PerplexityService.getInstance();

                try {
                    const { results, errors } = await perplexityService.getMultiExpertReadings(experts, debouncedTopic);

                    // Set the readings in state
                    setRecommendedReadings(results);

                    // Handle any errors
                    if (errors.length > 0) {
                        setReadingErrors(errors);
                    }
                } catch (perplexityError) {
                    console.error('Perplexity service error:', perplexityError);
                    setReadingErrors([{
                        expert: 'all',
                        error: 'Reading recommendations are temporarily unavailable.'
                    }]);
                }
            } catch (error) {
                console.error('Error fetching recommended readings:', error);
                setReadingErrors([{
                    expert: 'all',
                    error: 'Unable to load reading recommendations. Please try again later.'
                }]);
            } finally {
                setIsLoadingReadings(false);
            }
        };

        fetchRecommendedReadings();
    }, [debouncedTopic, experts]);

    return (
        <div className={cn("space-y-6 p-6 border rounded-lg", className)}>
            <div className="space-y-2">
                <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                    <BrainCircuit className="h-5 w-5" />
                    Debate Summary
                </h2>
                <p className="text-muted-foreground">
                    Key insights and arguments from the debate on: <span className="font-medium text-foreground">{topic}</span>
                </p>
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
                    <h3 className="text-lg text-white font-medium flex items-center gap-2">
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
                    <h3 className="text-lg text-white font-medium flex items-center gap-2">
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
                <p className="text-sm text-muted-foreground mb-4">
                    Diverse resources to explore this topic from different perspectives and sources
                </p>

                {isLoadingReadings ? (
                    <div className="p-4 text-center">
                        <div className="animate-pulse flex flex-col items-center">
                            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2"></div>
                            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
                            <p className="mt-4 text-sm text-muted-foreground">Fetching reading recommendations from Perplexity API...</p>
                            <p className="mt-1 text-xs text-muted-foreground">This may take a moment to complete</p>
                        </div>
                    </div>
                ) : readingErrors.length > 0 && readingErrors[0].expert === 'all' ? (
                    <div className="p-4 text-center">
                        <p className="text-amber-500 mb-2">{readingErrors[0].error}</p>
                        <p className="text-sm text-muted-foreground">You can still explore this topic further through academic journals and online resources.</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {/* Check if we have any readings at all */}
                        {Object.values(recommendedReadings).some(readings => readings && readings.length > 0) ? (
                            // Display the readings once (not per expert) since they're now topic-based
                            <div className="space-y-4">
                                {/* Find the first expert with readings and use those */}
                                {Object.entries(recommendedReadings).find(([_, readings]) => readings && readings.length > 0)?.[1].map((reading) => (
                                    <ReadingListItem
                                        key={reading.id}
                                        reading={reading}
                                        expert={experts[0]} // Just use the first expert for styling
                                    />
                                ))}
                            </div>
                        ) : (
                            <div className="text-center text-muted-foreground py-4">
                                No reading recommendations available for this topic yet.
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
} 