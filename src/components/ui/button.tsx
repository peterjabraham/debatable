"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: "default" | "secondary" | "ghost" | "link" | "success" | "destructive" | "outline";
    size?: "default" | "sm" | "lg" | "icon";
    isLoading?: boolean;
}

// Add the buttonVariants function that's used by alert-dialog.tsx
export const buttonVariants = ({
    variant = "default",
    size = "default",
    className,
}: {
    variant?: ButtonProps["variant"];
    size?: ButtonProps["size"];
    className?: string;
} = {}) => {
    const baseStyles = "inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-background";

    const variants = {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "underline-offset-4 hover:underline text-primary",
        success: "bg-green-600 text-white hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600",
        destructive: "bg-red-600 text-white hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600",
    };

    const sizes = {
        default: "h-10 py-2 px-4",
        sm: "h-9 px-3 rounded-md",
        lg: "h-11 px-8 rounded-md",
        icon: "h-10 w-10",
    };

    return cn(
        baseStyles,
        variants[variant],
        sizes[size],
        className
    );
};

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant = "default", size = "default", isLoading, children, ...props }, ref) => {
        return (
            <button
                className={cn(
                    buttonVariants({ variant, size }),
                    isLoading && "opacity-50 cursor-wait",
                    className
                )}
                ref={ref}
                disabled={isLoading}
                {...props}
            >
                {isLoading ? (
                    <span className="mr-2 animate-spin">⏳</span>
                ) : null}
                {children}
            </button>
        );
    }
);
Button.displayName = "Button";

export { Button }; 