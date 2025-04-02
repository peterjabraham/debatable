import React from 'react';
import { cn } from '@/lib/utils';

interface PerplexityLoaderProps {
    message?: string;
    subtitle?: string;
    size?: 'sm' | 'md' | 'lg';
    className?: string;
}

export function PerplexityLoader({
    message = "Loading content",
    subtitle = "Fetching insights from Perplexity",
    size = 'md',
    className
}: PerplexityLoaderProps) {
    const iconSizes = {
        sm: 24,
        md: 40,
        lg: 56
    };

    const textSizes = {
        sm: 'text-xs',
        md: 'text-sm',
        lg: 'text-base'
    };

    return (
        <div className={cn(
            "flex flex-col items-center justify-center py-4",
            className
        )}>
            <div className="mb-3">
                <svg
                    width={iconSizes[size]}
                    height={iconSizes[size]}
                    viewBox="0 0 38 38"
                    className="animate-pulse"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                >
                    <path d="M19 5.46154L29.6923 12.2308V25.7692L19 32.5385L8.30769 25.7692V12.2308L19 5.46154Z" stroke="currentColor" strokeWidth="2" />
                    <path d="M19 32.5385V19M19 19L29.6923 12.2308M19 19L8.30769 12.2308" stroke="currentColor" strokeWidth="2" />
                </svg>
            </div>
            <p className={cn("font-medium", textSizes[size])}>{message}</p>
            {subtitle && (
                <p className={cn("text-muted-foreground mt-1", size === 'lg' ? 'text-sm' : 'text-xs')}>{subtitle}</p>
            )}
            <div className="mt-3 flex space-x-2">
                <div className={cn("rounded-full bg-primary animate-bounce",
                    size === 'sm' ? 'w-1.5 h-1.5' : size === 'lg' ? 'w-2.5 h-2.5' : 'w-2 h-2'
                )} style={{ animationDelay: '0ms' }}></div>
                <div className={cn("rounded-full bg-primary animate-bounce",
                    size === 'sm' ? 'w-1.5 h-1.5' : size === 'lg' ? 'w-2.5 h-2.5' : 'w-2 h-2'
                )} style={{ animationDelay: '150ms' }}></div>
                <div className={cn("rounded-full bg-primary animate-bounce",
                    size === 'sm' ? 'w-1.5 h-1.5' : size === 'lg' ? 'w-2.5 h-2.5' : 'w-2 h-2'
                )} style={{ animationDelay: '300ms' }}></div>
            </div>
        </div>
    );
} 