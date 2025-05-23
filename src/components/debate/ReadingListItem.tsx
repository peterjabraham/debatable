"use client";

import React from 'react';
import { ExternalLink, BookText, Clock, CheckCircle, AlertTriangle, HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Expert } from '@/types/expert';

interface ReadingListItemProps {
    reading: {
        id: string;
        title: string;
        url: string;
        snippet: string;
        published_date?: string;
        source?: string;
        year?: string;
        isPrimarySource?: boolean;
        isValidUrl?: boolean;
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

// Helper function to get URL validation indicator
const getUrlValidationIcon = (isValidUrl?: boolean) => {
    if (isValidUrl === true) {
        return <CheckCircle className="h-3 w-3 text-green-400" title="URL verified as working" />;
    } else if (isValidUrl === false) {
        return <AlertTriangle className="h-3 w-3 text-yellow-400" title="URL may not be accessible" />;
    } else {
        return <HelpCircle className="h-3 w-3 text-gray-400" title="URL not verified" />;
    }
};

export function ReadingListItem({ reading, expert }: ReadingListItemProps) {
    const isHistoricalExpert = expert.type === 'historical';
    const isPrimarySource = reading.isPrimarySource || false;

    return (
        <a
            key={reading.id}
            href={reading.url}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
                "block p-4 rounded-lg transition-colors",
                "hover:bg-gray-900",
                getStanceColor(expert.stance || ''),
                reading.isValidUrl === false && "border-yellow-500/50"
            )}
        >
            <div className="flex items-start gap-2">
                <div className="flex items-center gap-1 mt-1 flex-shrink-0">
                    <ExternalLink className="h-4 w-4 text-white" />
                    {getUrlValidationIcon(reading.isValidUrl)}
                </div>
                <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <p className="font-medium text-white">{reading.title}</p>

                        {/* Source type badge */}
                        {reading.source && (
                            <span className={cn(
                                "px-2 py-0.5 text-xs rounded-full",
                                isPrimarySource
                                    ? "bg-amber-700 text-amber-100"
                                    : "bg-gray-700 text-gray-200"
                            )}>
                                {reading.source}
                                {isPrimarySource && " (Primary)"}
                            </span>
                        )}

                        {/* Primary source indicator for historical experts */}
                        {isHistoricalExpert && isPrimarySource && (
                            <span className="px-2 py-0.5 text-xs rounded-full bg-amber-600 text-amber-100 flex items-center gap-1">
                                <BookText className="h-3 w-3" />
                                By {expert.name}
                            </span>
                        )}

                        {/* URL status indicator */}
                        {reading.isValidUrl === false && (
                            <span className="px-2 py-0.5 text-xs rounded-full bg-yellow-700 text-yellow-100 flex items-center gap-1">
                                <AlertTriangle className="h-3 w-3" />
                                Link may not work
                            </span>
                        )}
                    </div>

                    <p className="text-sm text-gray-300">{reading.snippet}</p>

                    {/* Date information - prefer year for historical sources */}
                    {(reading.year || reading.published_date) && (
                        <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {reading.year
                                ? `Published: ${reading.year}`
                                : `Published: ${new Date(reading.published_date!).toLocaleDateString()}`
                            }
                        </p>
                    )}

                    {/* URL validation disclaimer for invalid URLs */}
                    {reading.isValidUrl === false && (
                        <p className="text-xs text-yellow-300 mt-2 flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            This link could not be verified. It may have moved or be temporarily unavailable.
                        </p>
                    )}
                </div>
            </div>
        </a>
    );
} 