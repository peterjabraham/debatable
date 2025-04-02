"use client";

import React, { useState, useEffect } from 'react';
import { Message } from '@/types/message';
import { Expert } from '@/types/expert';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { BookOpen, BrainCircuit, MessageSquareQuote, ListChecks, ExternalLink } from 'lucide-react';
import { getMockExpertRecommendedReading, getMultiExpertRecommendedReading } from '@/lib/api/perplexity';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown } from 'lucide-react';
import { EnvDebug } from '@/components/debug';

interface DebateSummaryProps {
    topic: string;
    experts: Expert[];
    messages: Message[];
    className?: string;
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
    const [readingError, setReadingError] = useState<string | null>(null);

    // Fetch recommended readings when component mounts
    useEffect(() => {
        const fetchRecommendedReadings = async () => {
            if (!topic || !experts || experts.length === 0) {
                console.log('Missing required data for fetching readings:', { topic, experts });
                return;
            }

            setIsLoadingReadings(true);
            setReadingError(null);

            try {
                console.log('Fetching recommended readings for:', { topic, experts });
                const results = await getMultiExpertRecommendedReading(
                    experts.map(expert => expert.name),
                    topic
                );
                console.log('Received results:', results);
                setRecommendedReadings(results);
            } catch (error) {
                console.error('Error fetching recommended readings:', error);
                setReadingError('Failed to fetch recommended readings. Please try again later.');
            } finally {
                setIsLoadingReadings(false);
            }
        };

        fetchRecommendedReadings();
    }, [topic, experts]);

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

            {/* Recommended Reading - Updated with Tabs */}
            <div className="space-y-2">
                <h3 className="text-lg font-medium flex items-center gap-2">
                    <BookOpen className="h-4 w-4" />
                    Recommended Reading
                </h3>

                {isLoadingReadings ? (
                    <div className="p-4 text-center">
                        <div className="animate-pulse flex flex-col items-center">
                            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2"></div>
                            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
                        </div>
                    </div>
                ) : readingError ? (
                    <div className="p-4 text-center text-red-500">
                        {readingError}
                    </div>
                ) : (
                    <div className="space-y-4">
                        {experts.map((expert) => (
                            <Collapsible key={expert.name} className="border rounded-lg">
                                <CollapsibleTrigger className="flex items-center justify-between w-full p-4 hover:bg-accent/50">
                                    <div className="space-y-1 text-left">
                                        <h4 className="font-medium">{expert.name}'s Research on {topic} - Key Findings</h4>
                                        <p className="text-sm text-muted-foreground">Comprehensive analysis by {expert.name} examining the implications of {topic}</p>
                                    </div>
                                    <ChevronDown className="h-4 w-4" />
                                </CollapsibleTrigger>

                                <CollapsibleContent>
                                    <div className="p-4 pt-0">
                                        <Tabs defaultValue="perspective" className="w-full">
                                            <TabsList className="grid w-full grid-cols-3">
                                                <TabsTrigger value="perspective">Perspective</TabsTrigger>
                                                <TabsTrigger value="future">Future</TabsTrigger>
                                                <TabsTrigger value="analysis">Analysis</TabsTrigger>
                                            </TabsList>

                                            <TabsContent value="perspective" className="space-y-4">
                                                <div className="space-y-2">
                                                    <h5 className="font-medium">The Future of {topic} is flat: {expert.name}'s Perspective</h5>
                                                    <p className="text-sm text-muted-foreground">
                                                        {expert.name} provides a unique perspective based on years of research.
                                                    </p>
                                                </div>
                                                {recommendedReadings[expert.name]?.map((reading) => (
                                                    <a
                                                        key={reading.id}
                                                        href={reading.url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="block p-4 border rounded-lg hover:bg-accent/50"
                                                    >
                                                        <div className="flex items-start gap-2">
                                                            <ExternalLink className="h-4 w-4 mt-1" />
                                                            <div>
                                                                <p className="font-medium">{reading.title}</p>
                                                                <p className="text-sm text-muted-foreground">{reading.snippet}</p>
                                                            </div>
                                                        </div>
                                                    </a>
                                                ))}
                                            </TabsContent>

                                            <TabsContent value="future" className="space-y-4">
                                                <div className="space-y-2">
                                                    <h5 className="font-medium">Critical Analysis of {topic} and its Future Developments</h5>
                                                    <p className="text-sm text-muted-foreground">
                                                        {expert.name} provides a critical analysis of recent developments in "{topic}" challenging conventional wisdom and proposing alternative perspectives.
                                                    </p>
                                                </div>
                                            </TabsContent>

                                            <TabsContent value="analysis" className="space-y-4">
                                                <div className="space-y-2">
                                                    <h5 className="font-medium">Critical Analysis of Recent Developments</h5>
                                                    <p className="text-sm text-muted-foreground">
                                                        A detailed analysis of recent developments in "{topic}" challenging conventional wisdom.
                                                    </p>
                                                </div>
                                            </TabsContent>
                                        </Tabs>
                                    </div>
                                </CollapsibleContent>
                            </Collapsible>
                        ))}
                    </div>
                )}
            </div>
            <EnvDebug />
        </div>
    );
} 