"use client";

import React, { createContext, useContext, useState, ReactNode } from 'react';

interface PerplexityContextType {
    isLoading: boolean;
    setLoading: (loading: boolean) => void;
    recentMessageIds: string[];
    addMessageId: (messageId: string) => void;
    clearMessageIds: () => void;
}

// Create a default context value for safer fallback
const defaultContextValue: PerplexityContextType = {
    isLoading: false,
    setLoading: () => { },
    recentMessageIds: [],
    addMessageId: () => { },
    clearMessageIds: () => { },
};

const PerplexityContext = createContext<PerplexityContextType>(defaultContextValue);

export function PerplexityProvider({ children }: { children: ReactNode }) {
    const [isLoading, setIsLoading] = useState(false);
    const [recentMessageIds, setRecentMessageIds] = useState<string[]>([]);

    const setLoading = (loading: boolean) => {
        setIsLoading(loading);
    };

    const addMessageId = (messageId: string) => {
        setRecentMessageIds(prev => {
            // Keep only the most recent 5 message IDs
            const newIds = [messageId, ...prev].slice(0, 5);
            return newIds;
        });
    };

    const clearMessageIds = () => {
        setRecentMessageIds([]);
    };

    return (
        <PerplexityContext.Provider
            value={{
                isLoading,
                setLoading,
                recentMessageIds,
                addMessageId,
                clearMessageIds
            }}
        >
            {children}
        </PerplexityContext.Provider>
    );
}

export function usePerplexity() {
    // Use a try-catch to safely handle missing context
    try {
        const context = useContext(PerplexityContext);
        return context;
    } catch (error) {
        console.warn('Perplexity context not available, using default values', error);
        return defaultContextValue;
    }
} 