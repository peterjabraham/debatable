'use client';

import React from 'react';

interface EnvDebugProps {
    className?: string;
}

export const EnvDebug: React.FC<EnvDebugProps> = ({ className = '' }) => {
    // Only show in development
    if (process.env.NODE_ENV !== 'development') {
        return null;
    }

    return (
        <div className={`fixed bottom-4 right-4 bg-black/80 text-white p-4 rounded-lg text-sm font-mono ${className}`}>
            <h3 className="font-bold mb-2">Environment Variables:</h3>
            <pre className="whitespace-pre-wrap">
                {JSON.stringify({
                    NEXT_PUBLIC_USE_REAL_API: process.env.NEXT_PUBLIC_USE_REAL_API,
                    NODE_ENV: process.env.NODE_ENV,
                    PERPLEXITY_API_KEY: process.env.PERPLEXITY_API_KEY ? 'Present' : 'Missing',
                    API_SERVER_ENABLED: process.env.API_SERVER_ENABLED,
                    MOCK_API: process.env.MOCK_API,
                    USE_MOCK_DATA: process.env.USE_MOCK_DATA,
                    DISABLE_API_TESTING: process.env.DISABLE_API_TESTING
                }, null, 2)}
            </pre>
        </div>
    );
}; 