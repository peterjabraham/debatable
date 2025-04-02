"use client";

import React from 'react';
import { ExpertProfile as ExpertProfileType } from '@/lib/openai';
import { Avatar } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { useTheme } from 'next-themes';

interface ExpertProfileProps {
    expert: ExpertProfileType;
    isActive?: boolean;
    className?: string;
}

export function ExpertProfile({ expert, isActive, className }: ExpertProfileProps) {
    const { theme } = useTheme();

    return (
        <div
            className={cn(
                'flex flex-col items-center p-4 rounded-lg border transition-colors duration-200',
                isActive && 'border-primary bg-primary/5',
                !isActive && 'border-[hsl(var(--border))]',
                theme === 'light' ? 'hover:bg-accent/50' : 'hover:bg-accent/50',
                className
            )}
        >
            <Avatar className="h-16 w-16 mb-2">
                <div className={cn(
                    'w-full h-full flex items-center justify-center text-lg font-semibold',
                    'bg-muted text-muted-foreground'
                )}>
                    {expert.name.charAt(0)}
                </div>
            </Avatar>
            <h3 className="text-lg font-semibold text-foreground">{expert.name}</h3>
            <p className={cn(
                'text-sm text-center mb-2',
                expert.stance === 'pro'
                    ? 'text-[hsl(142,76%,36%)]'
                    : 'text-destructive',
                theme === 'dark' && (
                    expert.stance === 'pro'
                        ? 'text-[hsl(142,76%,42%)]'
                        : 'text-destructive/90'
                )
            )}>
                {expert.stance === 'pro' ? 'Supporting' : 'Opposing'}
            </p>
            <p className="text-sm text-center mb-2 text-muted-foreground">{expert.background}</p>
            <div className="flex flex-wrap gap-1 justify-center">
                {Array.isArray(expert.expertise) && expert.expertise.map((area, index) => (
                    <span
                        key={index}
                        className={cn(
                            'text-xs px-2 py-1 rounded-full',
                            'bg-secondary text-secondary-foreground'
                        )}
                    >
                        {area}
                    </span>
                ))}
            </div>
        </div>
    );
} 