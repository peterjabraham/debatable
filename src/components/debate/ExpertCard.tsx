import React from 'react';
import { Expert } from '@/types/expert';
import { Avatar } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { useTheme } from 'next-themes';
import { Brain } from 'lucide-react';

interface ExpertCardProps {
    expert: Expert;
    className?: string;
}

export function ExpertCard({ expert, className }: ExpertCardProps) {
    const { theme } = useTheme();
    const isAiExpert = expert.type === 'ai';

    // Get background color based on stance
    const getStanceColor = () => {
        switch (expert.stance?.toLowerCase()) {
            case 'pro':
                return 'bg-green-100 dark:bg-green-900/50 border-green-200 dark:border-green-800';
            case 'con':
                return 'bg-red-100 dark:bg-red-900/50 border-red-200 dark:border-red-800';
            default:
                return 'bg-gray-100 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700';
        }
    };

    return (
        <div
            className={cn(
                'flex flex-col items-center p-4 rounded-lg transition-colors duration-200',
                theme === 'light' ? 'hover:bg-accent/30' : 'hover:bg-accent/30',
                isAiExpert && 'border-primary/30',
                className
            )}
        >
            <Avatar className="h-16 w-16 mb-2">
                {isAiExpert ? (
                    <div className={cn(
                        'w-full h-full flex items-center justify-center',
                        'bg-primary/10 text-primary'
                    )}>
                        <Brain className="h-8 w-8" />
                    </div>
                ) : (
                    <div className={cn(
                        'w-full h-full flex items-center justify-center text-lg font-semibold',
                        'bg-muted text-muted-foreground'
                    )}>
                        {expert.name.charAt(0)}
                    </div>
                )}
            </Avatar>

            <h3 className="text-lg font-semibold text-foreground">{expert.name}</h3>

            {isAiExpert && expert.identifier && (
                <div className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary mb-2 font-mono">
                    {expert.identifier}
                </div>
            )}

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
                {expert.expertise && Array.isArray(expert.expertise) && expert.expertise.map((area, index) => (
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