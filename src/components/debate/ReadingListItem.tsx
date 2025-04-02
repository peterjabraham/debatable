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

// Helper function to get stance color - black background with accent borders
const getStanceColor = (stance: string) => {
    switch (stance?.toLowerCase()) {
        case 'pro':
            return 'bg-black text-white border border-green-500 dark:border-green-400';
        case 'con':
            return 'bg-black text-white border border-red-500 dark:border-red-400';
        default:
            return 'bg-black text-white border border-gray-500 dark:border-gray-400';
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
                "block p-4 rounded-lg transition-colors",
                "hover:bg-gray-900",
                getStanceColor(expert.stance || '')
            )}
        >
            <div className="flex items-start gap-2">
                <ExternalLink className="h-4 w-4 mt-1 flex-shrink-0 text-white" />
                <div>
                    <p className="font-medium text-white">{reading.title}</p>
                    <p className="text-sm text-gray-300">{reading.snippet}</p>
                    {reading.published_date && (
                        <p className="text-xs text-gray-400 mt-1">
                            Published: {new Date(reading.published_date).toLocaleDateString()}
                        </p>
                    )}
                </div>
            </div>
        </a>
    );
} 