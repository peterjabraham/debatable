"use client";

import React from 'react';
import { ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Expert } from '@/types/expert';

interface ReadingListItemProps {
    reading: {
        id: string;
        title: string;
        url: string;
        snippet: string;
        published_date?: string;
    };
    expert: Expert;
}

// Helper function to get stance color (match the MessageBubble component colors)
const getStanceColor = (stance: string) => {
    switch (stance?.toLowerCase()) {
        case 'pro':
            return 'border-green-300 dark:border-green-800';
        case 'con':
            return 'border-red-300 dark:border-red-800';
        default:
            return 'border-gray-300 dark:border-gray-700';
    }
};

export function ReadingListItem({ reading, expert }: ReadingListItemProps) {
    return (
        <a
            key={reading.id}
            href={reading.url}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
                "block p-4 border-2 rounded-lg transition-colors",
                "hover:bg-accent/50",
                // Match border color to expert stance
                getStanceColor(expert.stance || ''),
                // Light background for readability with slight coloring
                expert.stance?.toLowerCase() === 'pro'
                    ? 'bg-green-50/80 dark:bg-green-950/30'
                    : expert.stance?.toLowerCase() === 'con'
                        ? 'bg-red-50/80 dark:bg-red-950/30'
                        : 'bg-gray-50/80 dark:bg-gray-900/30',
                "backdrop-blur-sm"
            )}
        >
            <div className="flex items-start gap-2">
                <ExternalLink className="h-4 w-4 mt-1 flex-shrink-0" />
                <div>
                    <p className="font-medium">{reading.title}</p>
                    <p className="text-sm text-muted-foreground line-clamp-3">{reading.snippet}</p>
                    {reading.published_date && (
                        <p className="text-xs text-muted-foreground mt-1">
                            Published: {new Date(reading.published_date).toLocaleDateString()}
                        </p>
                    )}
                </div>
            </div>
        </a>
    );
} 