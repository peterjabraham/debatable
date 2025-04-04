'use client';

import { useState } from 'react';
import { signOut } from 'next-auth/react';
import { LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface LogoutButtonProps {
    className?: string;
    variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
    size?: 'default' | 'sm' | 'lg' | 'icon';
    showIcon?: boolean;
    text?: string;
}

export const LogoutButton = ({
    className = '',
    variant = 'destructive',
    size = 'default',
    showIcon = true,
    text = 'Sign Out'
}: LogoutButtonProps) => {
    const [isLoggingOut, setIsLoggingOut] = useState(false);
    const [logoutError, setLogoutError] = useState<string | null>(null);

    const handleLogout = async () => {
        setIsLoggingOut(true);
        setLogoutError(null);

        try {
            // First try the normal NextAuth signOut method
            await signOut({ callbackUrl: '/', redirect: true });

            // If we're still here after 1 second, something went wrong with the redirect
            // so we'll try the force logout endpoint as a fallback
            setTimeout(async () => {
                try {
                    // Force logout by calling our custom endpoint
                    const response = await fetch('/api/auth/logout', {
                        method: 'POST',
                        credentials: 'include',
                    });

                    if (response.ok) {
                        // If successful, redirect manually
                        window.location.href = '/';
                    } else {
                        console.error('Force logout failed:', await response.text());
                        setLogoutError('Error signing out. Try clearing cookies or refreshing the page.');
                    }
                } catch (error) {
                    console.error('Force logout error:', error);
                    setLogoutError('Network error during sign out.');
                } finally {
                    setIsLoggingOut(false);
                }
            }, 1000);

        } catch (error) {
            console.error('Normal logout error:', error);

            // Try force logout immediately if normal logout fails
            try {
                const response = await fetch('/api/auth/logout', {
                    method: 'POST',
                    credentials: 'include',
                });

                if (response.ok) {
                    window.location.href = '/';
                } else {
                    console.error('Force logout failed after normal logout error');
                    setLogoutError('Error signing out. Try clearing cookies or refreshing the page.');
                }
            } catch (forceError) {
                console.error('Force logout error after normal logout error:', forceError);
                setLogoutError('Multiple errors during sign out. Please try again or clear browser cookies.');
            } finally {
                setIsLoggingOut(false);
            }
        }
    };

    return (
        <div className="flex flex-col">
            <Button
                variant={variant}
                size={size}
                onClick={handleLogout}
                disabled={isLoggingOut}
                className={className}
            >
                {isLoggingOut ? 'Signing out...' : text}
                {showIcon && <LogOut className="ml-2 h-4 w-4" />}
            </Button>

            {logoutError && (
                <p className="text-xs text-red-500 mt-1">{logoutError}</p>
            )}
        </div>
    );
}; 