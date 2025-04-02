'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Message } from '@/types/message';
import { Expert } from '@/types/expert';
import { Button } from '@/components/ui/button';
import { Volume2, Loader2, Info, StopCircle } from 'lucide-react';
import { useDebateStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import { CitationFooter } from './CitationFooter';
import { processCitationMarkers } from '@/lib/utils/citation-processor';
import { useToast } from '@/lib/hooks/useToast';
import { MVP_CONFIG } from '@/lib/config';

interface MessageBubbleProps {
    message: Message;
    experts: Expert[];
    audioRef?: React.RefObject<HTMLAudioElement | null>;
    showCitations?: boolean; // Control whether to show citations (default: true)
}

export function MessageBubble({
    message,
    experts,
    audioRef: externalAudioRef,
    showCitations = true
}: MessageBubbleProps) {
    const [isPlaying, setIsPlaying] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
    const internalAudioRef = useRef<HTMLAudioElement | null>(null);
    const { useVoiceSynthesis } = useDebateStore();
    const { showWarning, showError } = useToast();

    // Find the expert based on the message's speaker
    const expert = message.speaker ? experts.find(e => e.name === message.speaker) : undefined;

    // Process citations if needed
    useEffect(() => {
        if (
            !message.hasProcessedCitations &&
            message.role === 'assistant' &&
            expert?.backgroundKnowledge &&
            !message.citations
        ) {
            // Find sources for this expert
            const sources = expert.sourceReferences || [];
            if (sources.length > 0) {
                const { processedText, citations } = processCitationMarkers(message.content, sources);
                message.content = processedText;
                message.citations = citations;
                message.hasProcessedCitations = true;
            }
        }
    }, [message, expert]);

    const stopAudio = () => {
        const audioRef = externalAudioRef?.current || internalAudioRef.current;
        if (audioRef) {
            audioRef.pause();
            audioRef.currentTime = 0;
            setIsPlaying(false);
            if (!externalAudioRef) {
                internalAudioRef.current = null;
            }
        }
    };

    const handlePlayVoice = async () => {
        try {
            // Skip API calls if server is unavailable
            if (!MVP_CONFIG.apiServerAvailable) {
                console.log('API server unavailable, cannot synthesize voice');
                showWarning('Voice unavailable', 'Voice synthesis is unavailable while the API server is offline.');
                return;
            }

            // First, stop any currently playing audio
            stopAudio();

            // Generate audio if not already cached
            if (!audioBlob) {
                setIsLoading(true);
                const response = await fetch('/api/voice', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        text: message.content,
                        voiceId: expert?.voiceId || 'default'
                    })
                });

                if (!response.ok) {
                    throw new Error('Failed to generate voice');
                }

                const blob = await response.blob();
                setAudioBlob(blob);
            }

            // Create new audio element from blob
            const audio = new Audio(URL.createObjectURL(audioBlob || new Blob()));

            if (externalAudioRef) {
                externalAudioRef.current = audio;
            }

            internalAudioRef.current = audio;

            // Set up event handlers
            audio.addEventListener('ended', () => {
                setIsPlaying(false);
            });

            audio.addEventListener('error', () => {
                setIsPlaying(false);
                setIsLoading(false);
                showError('Audio Error', 'Failed to play the audio');
            });

            // Play the audio
            audio.play();
            setIsPlaying(true);
            setIsLoading(false);
        } catch (error) {
            setIsPlaying(false);
            setIsLoading(false);
            console.error('Voice synthesis error:', error);
            showError('Voice Error', 'Failed to synthesize voice');
        }
    };

    // Cleanup on unmount
    React.useEffect(() => {
        return () => {
            if (!externalAudioRef && internalAudioRef.current) {
                internalAudioRef.current.pause();
                internalAudioRef.current = null;
            }
        };
    }, [externalAudioRef]);

    // Skip rendering for system messages
    if (message.role === 'system') {
        return null;
    }

    // For user messages
    if (message.role === 'user') {
        return (
            <div className="rounded-lg p-4 bg-primary/10 dark:bg-primary/20">
                <div className="flex items-start gap-2 mb-2">
                    <h3 className="font-semibold text-foreground">You</h3>
                </div>
                <p className="text-sm whitespace-pre-wrap">{message.content}</p>
            </div>
        );
    }

    // For assistant messages (experts)
    const getStanceColor = (stance: string) => {
        switch (stance?.toLowerCase()) {
            case 'pro':
                return 'bg-green-100 dark:bg-green-900/50';
            case 'con':
                return 'bg-red-100 dark:bg-red-900/50';
            default:
                return 'bg-gray-100 dark:bg-gray-800/50';
        }
    };

    const getStanceText = (stance: string) => {
        switch (stance?.toLowerCase()) {
            case 'pro':
                return 'Supporting';
            case 'con':
                return 'Opposing';
            default:
                return '';
        }
    };

    return (
        <div className={cn(
            "rounded-lg p-4",
            "transition-colors duration-200",
            getStanceColor(expert?.stance || '')
        )}>
            <div className="flex items-start gap-2 mb-2">
                <div className="flex-1">
                    <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-foreground">
                            {expert?.name || 'Unknown Expert'}
                            {expert && (
                                <span className="ml-2 text-sm font-normal text-muted-foreground">
                                    ({getStanceText(expert.stance)})
                                </span>
                            )}
                        </h3>
                        {message.usage && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground" title="Token usage and cost">
                                <Info className="h-3 w-3" />
                                <span>{message.usage.tokens} tokens</span>
                                <span className="text-destructive">
                                    (${typeof message.usage.cost === 'number' ? message.usage.cost.toFixed(4) : '0.0000'})
                                </span>
                            </div>
                        )}
                    </div>
                    {expert?.expertise && Array.isArray(expert.expertise) && expert.expertise.length > 0 ? (
                        <p className="text-xs text-muted-foreground">
                            {expert.expertise.join(', ')}
                        </p>
                    ) : expert?.expertise ? (
                        <p className="text-xs text-muted-foreground">
                            {String(expert.expertise)}
                        </p>
                    ) : null}
                </div>
                {useVoiceSynthesis && expert?.voiceId && (
                    <div className="flex items-center gap-2">
                        {isLoading && (
                            <p className="text-xs text-muted-foreground">
                                Generating voice (30s)...
                            </p>
                        )}
                        <div className="flex gap-1">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={handlePlayVoice}
                                disabled={isLoading || isPlaying}
                                className="shrink-0"
                                title="Play voice"
                            >
                                {isLoading ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <Volume2 className="h-4 w-4" />
                                )}
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={stopAudio}
                                disabled={!isPlaying}
                                className={cn(
                                    "shrink-0",
                                    !isPlaying && "opacity-50"
                                )}
                                title="Stop voice"
                            >
                                <StopCircle className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                )}
            </div>
            <p className="text-sm whitespace-pre-wrap">{message.content}</p>

            {/* Add citation footer if citations exist and showCitations is true */}
            {showCitations && message.citations && message.citations.length > 0 && (
                <CitationFooter citations={message.citations} />
            )}
        </div>
    );
} 