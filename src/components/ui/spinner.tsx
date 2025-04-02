"use client";

import { cn } from "@/lib/utils";

interface SpinnerProps {
    size?: "sm" | "md" | "lg";
    className?: string;
}

export function Spinner({ size = "md", className }: SpinnerProps) {
    const sizeClasses = {
        sm: "h-4 w-4 border-2",
        md: "h-8 w-8 border-3",
        lg: "h-12 w-12 border-4",
    };

    return (
        <div
            className={cn(
                "animate-spin rounded-full border-primary border-t-transparent",
                sizeClasses[size],
                className
            )}
        />
    );
}

interface LoadingProps {
    text?: string;
    size?: "sm" | "md" | "lg";
    className?: string;
}

export function Loading({ text = "Loading...", size = "md", className }: LoadingProps) {
    return (
        <div className={cn("flex flex-col items-center justify-center gap-3", className)}>
            <Spinner size={size} />
            {text && <p className="text-muted-foreground text-sm">{text}</p>}
        </div>
    );
} 