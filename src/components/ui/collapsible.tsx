"use client"

import React from 'react';
import { cn } from '@/lib/utils';

interface CollapsibleProps extends React.HTMLAttributes<HTMLDivElement> {
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
}

export const Collapsible = React.forwardRef<HTMLDivElement, CollapsibleProps>(
    ({ className, children, open, onOpenChange, ...props }, ref) => {
        return (
            <div ref={ref} className={cn("w-full", className)} {...props}>
                {children}
            </div>
        );
    }
);
Collapsible.displayName = "Collapsible";

export const CollapsibleTrigger = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(
    ({ className, children, ...props }, ref) => {
        return (
            <button
                ref={ref}
                className={cn(
                    "flex w-full items-center justify-between rounded-md px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
                    className
                )}
                {...props}
            >
                {children}
            </button>
        );
    }
);
CollapsibleTrigger.displayName = "CollapsibleTrigger";

export const CollapsibleContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
    ({ className, children, ...props }, ref) => {
        return (
            <div
                ref={ref}
                className={cn(
                    "overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down",
                    className
                )}
                {...props}
            >
                {children}
            </div>
        );
    }
);
CollapsibleContent.displayName = "CollapsibleContent"; 