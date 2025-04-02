"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useDebateStore } from '@/lib/store';
import { Mic, Send, StopCircle, Loader2, Volume2, VolumeX } from 'lucide-react';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';

interface UserInputProps {
    onSubmit?: (text: string) => void;
    placeholder?: string;
    buttonText?: string;
    disabled?: boolean;
}

export function UserInput({
    onSubmit,
    placeholder = "Enter your message...",
    buttonText = "Send",
    disabled = false
}: UserInputProps) {
    const [input, setInput] = useState('');
    const [isRecording, setIsRecording] = useState(false);
    const [isSpeechSupported, setIsSpeechSupported] = useState(false);
    const recognitionRef = useRef<any>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const {
        setTopic,
        setUserStance,
        isGenerating,
        topic,
        useVoiceSynthesis,
        setUseVoiceSynthesis
    } = useDebateStore();
    const { theme } = useTheme();

    // Initialize speech recognition
    useEffect(() => {
        // Check if browser supports speech recognition
        const browserSpeechRecognition =
            // @ts-ignore - TypeScript doesn't know about these browser-specific APIs
            window.SpeechRecognition || window.webkitSpeechRecognition;

        if (browserSpeechRecognition) {
            setIsSpeechSupported(true);
        }
    }, []);

    // Clean up recognition on unmount
    useEffect(() => {
        return () => {
            if (recognitionRef.current) {
                try {
                    recognitionRef.current.stop();
                } catch (e) {
                    console.log('Error stopping recognition on unmount:', e);
                }
            }
        };
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || disabled || isGenerating) return;

        if (onSubmit) {
            onSubmit(input);
        } else {
            // Default behavior if no onSubmit is provided
            if (!topic) {
                setTopic(input);
            } else {
                setUserStance(input);
            }
        }

        setInput('');
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit(e);
        }
    };

    const toggleRecording = async () => {
        if (!isSpeechSupported) {
            console.error('Speech recognition not supported in this browser');
            return;
        }

        if (!isRecording) {
            try {
                // Create a new recognition instance
                // @ts-ignore - TypeScript doesn't know about these browser-specific APIs
                const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
                recognitionRef.current = new SpeechRecognition();

                const recognition = recognitionRef.current;
                recognition.continuous = true;
                recognition.interimResults = true;
                recognition.lang = 'en-US';

                recognition.onresult = (event: any) => {
                    // Get the latest result
                    const lastResultIndex = event.results.length - 1;
                    const transcript = event.results[lastResultIndex][0].transcript;

                    console.log('Speech recognized:', transcript);

                    // Update the input state with the recognized text
                    setInput(transcript);

                    // Force update the textarea value directly as a fallback
                    if (textareaRef.current) {
                        textareaRef.current.value = transcript;
                    }
                };

                recognition.onerror = (event: any) => {
                    console.error('Speech recognition error', event.error);
                    setIsRecording(false);
                };

                recognition.onend = () => {
                    console.log('Speech recognition ended');
                    setIsRecording(false);
                };

                // Start recording
                recognition.start();
                console.log('Speech recognition started');
                setIsRecording(true);
            } catch (error) {
                console.error('Error starting speech recognition:', error);
                setIsRecording(false);
            }
        } else {
            // Stop recording
            if (recognitionRef.current) {
                recognitionRef.current.stop();
            }
            setIsRecording(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="flex flex-col gap-2 w-full">
            {!topic && !onSubmit && (
                <div className="flex items-center gap-2 mb-2">
                    <Button
                        type="button"
                        variant={useVoiceSynthesis ? "success" : "destructive"}
                        size="sm"
                        onClick={() => setUseVoiceSynthesis(!useVoiceSynthesis)}
                        className="flex items-center gap-1.5 text-xs h-7 px-2"
                    >
                        {useVoiceSynthesis ? (
                            <>
                                <Volume2 className="h-3 w-3" />
                                <span>Voice On</span>
                            </>
                        ) : (
                            <>
                                <VolumeX className="h-3 w-3" />
                                <span>Voice Off</span>
                            </>
                        )}
                    </Button>
                    <p className={cn(
                        "text-xs",
                        useVoiceSynthesis
                            ? "text-[hsl(142,76%,36%)] dark:text-[hsl(142,76%,42%)]"
                            : "text-muted-foreground"
                    )}>
                        {useVoiceSynthesis
                            ? "Experts will respond with voice synthesis (additional cost)"
                            : "Text-only responses (no additional cost)"}
                    </p>
                </div>
            )}
            <div className="flex flex-col gap-2 w-full">
                <div className="w-full relative">
                    <Textarea
                        ref={textareaRef}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={isRecording ? "Listening..." : placeholder}
                        className={cn(
                            "w-full min-h-[60px] max-h-[200px] resize-none",
                            "transition-colors duration-200",
                            "bg-gray-50 dark:bg-gray-900 border-input focus:border-ring",
                            isRecording && "border-red-500"
                        )}
                        disabled={disabled || isGenerating}
                    />
                    {isGenerating && (
                        <div className="absolute right-3 top-3 text-muted-foreground text-sm flex items-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Generating...
                        </div>
                    )}
                    {isRecording && (
                        <div className="absolute right-3 top-3 text-red-500 text-sm flex items-center gap-2">
                            <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse"></div>
                            Recording...
                        </div>
                    )}
                </div>
                <div className="flex justify-end gap-2">
                    <Button
                        type="button"
                        variant={isRecording ? "destructive" : "secondary"}
                        size="icon"
                        onClick={toggleRecording}
                        disabled={disabled || isGenerating || !isSpeechSupported}
                        className="hover:border-red-500 hover:text-red-500 transition-colors duration-200"
                    >
                        {isRecording ?
                            <StopCircle className="h-4 w-4 text-red-500" /> :
                            <Mic className="h-4 w-4" />
                        }
                    </Button>
                    <Button
                        type="submit"
                        variant="success"
                        disabled={!input.trim() || disabled || isGenerating}
                        className="min-w-[80px]"
                    >
                        {isGenerating ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : buttonText ? (
                            buttonText
                        ) : (
                            <Send className="h-4 w-4" />
                        )}
                    </Button>
                </div>
            </div>
        </form>
    );
} 