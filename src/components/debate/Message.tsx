"use client";

import React from 'react';
import { DebateMessage } from '@/lib/openai';
import { cn } from '@/lib/utils';
import { Play, Pause } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useDebateStore } from '@/lib/store';
import { useTheme } from 'next-themes';

interface MessageProps {
    message: DebateMessage;
    isPlaying?: boolean;
    onPlayPause?: () => void;
    className?: string;
}

export function Message({ message, isPlaying, onPlayPause, className }: MessageProps) {
    const { currentSpeaker } = useDebateStore();
    const { theme } = useTheme();
    const isUser = message.role === 'user';
    const isActive = currentSpeaker === message.name;

    return (
        <div
            className={cn(
                'flex gap-4 p-4 rounded-lg transition-colors duration-200',
                isUser ? 'flex-row-reverse' : 'flex-row',
                isActive && 'bg-accent/10',
                className
            )}
        >
            <div className="flex flex-col items-center gap-2">
                {!isUser && message.name && onPlayPause && (
                    <Button
                        variant={isPlaying ? "destructive" : "success"}
                        size="icon"
                        onClick={onPlayPause}
                        className="h-8 w-8"
                    >
                        {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    </Button>
                )}
            </div>
            <div
                className={cn(
                    'flex flex-col flex-1 gap-2 rounded-lg p-4',
                    isUser
                        ? 'bg-primary text-primary-foreground'
                        : theme === 'light'
                            ? 'bg-secondary text-secondary-foreground'
                            : 'bg-secondary text-secondary-foreground'
                )}
            >
                {message.name && (
                    <div className="text-sm font-semibold">
                        {message.name}
                    </div>
                )}
                <div className="text-sm whitespace-pre-wrap">{message.content}</div>
            </div>
        </div>
    );
} 