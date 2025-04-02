"use client";

import React from 'react';
import { usePerplexity } from '@/lib/contexts/perplexity-context';
import { Loader2 } from 'lucide-react';

export function PerplexityStatus() {
    // Safely access the Perplexity context
    const { isLoading } = usePerplexity();

    if (!isLoading) return null;

    return (
        <div className="fixed bottom-5 right-5 z-50">
            <div className="bg-primary/10 backdrop-blur-sm rounded-full p-3 shadow-lg border border-primary/20 flex items-center justify-center space-x-2">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <span className="text-xs text-primary">Loading insights...</span>
            </div>
        </div>
    );
} 