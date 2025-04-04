"use client";

import { useState, useEffect } from 'react';
import { useSession, signIn } from 'next-auth/react';
import Link from 'next/link';
import { Button } from './ui/button';
import {
    User,
    LogOut,
    Settings,
    History,
    Heart,
    PlusCircle,
    RefreshCcw,
    AlertTriangle,
    LogIn
} from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export function UserNavigation() {
    const { data: session, status, update } = useSession();
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [authError, setAuthError] = useState(false);
    const [showAuthResetComplete, setShowAuthResetComplete] = useState(false);

    // Check if coming back from auth reset
    useEffect(() => {
        if (window.location.search.includes('reset=')) {
            setShowAuthResetComplete(true);
            // Hide the message after 5 seconds
            setTimeout(() => {
                setShowAuthResetComplete(false);
            }, 5000);
        }
    }, []);

    // Effect to handle authentication state properly
    useEffect(() => {
        // Check for error conditions in the session
        const hasValidSession = status === 'authenticated' &&
            session &&
            session.user &&
            session.user.id &&
            session.user.id !== 'anonymous' &&
            session.user.id !== 'error';

        // If status is authenticated but session isn't valid, we have an error
        const hasAuthError = status === 'authenticated' && !hasValidSession;

        setIsAuthenticated(hasValidSession);
        setAuthError(hasAuthError);

        console.log('Auth state:', { status, hasValidSession, hasAuthError });
    }, [session, status]);

    // Handle manual refresh of session
    const handleRefreshSession = async () => {
        try {
            await update();
            window.location.reload();
        } catch (error) {
            console.error('Error refreshing session:', error);
        }
    };

    // Handle sign in with force-reload
    const handleSignIn = () => {
        signIn(undefined, { callbackUrl: window.location.href });
    };

    return (
        <div className="flex items-center gap-4">
            <ThemeToggle />

            {showAuthResetComplete && (
                <div className="bg-green-500 text-white px-3 py-1 rounded-md text-sm flex items-center gap-1">
                    <span>Auth reset complete!</span>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleSignIn}
                        className="text-white hover:bg-green-600 px-2 py-0 h-6"
                    >
                        Sign In Now
                    </Button>
                </div>
            )}

            {status === 'loading' ? (
                <div className="h-10 w-10 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse" />
            ) : isAuthenticated ? (
                <DropdownMenu open={isMenuOpen} onOpenChange={setIsMenuOpen}>
                    <DropdownMenuTrigger asChild>
                        <Button
                            variant="ghost"
                            className="relative h-11 w-11 rounded-full border-2 border-primary p-0 overflow-hidden hover:bg-accent hover:text-accent-foreground"
                            aria-label="User menu"
                        >
                            {session?.user?.image ? (
                                <img
                                    src={session.user.image}
                                    alt={session.user.name || 'User'}
                                    className="h-full w-full rounded-full object-cover"
                                />
                            ) : (
                                <User className="h-6 w-6" />
                            )}
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-64">
                        <DropdownMenuLabel>
                            <div className="flex items-center gap-3 py-1">
                                <div className="h-10 w-10 rounded-full overflow-hidden flex-shrink-0">
                                    {session?.user?.image ? (
                                        <img
                                            src={session.user.image}
                                            alt={session.user.name || 'User'}
                                            className="h-full w-full object-cover"
                                        />
                                    ) : (
                                        <div className="h-full w-full bg-primary/10 flex items-center justify-center">
                                            <User className="h-5 w-5" />
                                        </div>
                                    )}
                                </div>
                                <div className="flex flex-col space-y-1">
                                    <p className="text-sm font-medium">{session?.user?.name}</p>
                                    <p className="text-xs text-muted-foreground">{session?.user?.email}</p>
                                </div>
                            </div>
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem asChild>
                            <Link
                                href="/app/debate"
                                onClick={() => setIsMenuOpen(false)}
                                className="flex items-center gap-2 cursor-pointer"
                            >
                                <PlusCircle className="h-4 w-4" />
                                <span>New Debate</span>
                            </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                            <Link
                                href="/history"
                                onClick={() => setIsMenuOpen(false)}
                                className="flex items-center gap-2 cursor-pointer"
                            >
                                <History className="h-4 w-4" />
                                <span>Debate History</span>
                            </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                            <Link
                                href="/favorites"
                                onClick={() => setIsMenuOpen(false)}
                                className="flex items-center gap-2 cursor-pointer"
                            >
                                <Heart className="h-4 w-4" />
                                <span>Favorites</span>
                            </Link>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem asChild>
                            <Link
                                href="/profile"
                                onClick={() => setIsMenuOpen(false)}
                                className="flex items-center gap-2 cursor-pointer"
                            >
                                <Settings className="h-4 w-4" />
                                <span>Profile Settings</span>
                            </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            onClick={() => {
                                setIsMenuOpen(false);
                                handleRefreshSession();
                            }}
                            className="flex items-center gap-2 cursor-pointer"
                        >
                            <RefreshCcw className="h-4 w-4" />
                            <span>Refresh Session</span>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                            className="flex items-center gap-2 cursor-pointer"
                            onClick={() => {
                                setIsMenuOpen(false);
                                window.location.href = '/auth/sign-out';
                            }}
                        >
                            <LogOut className="h-4 w-4" />
                            <span>Sign Out</span>
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            ) : authError ? (
                <div className="flex gap-2">
                    <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => {
                            window.location.href = '/auth/reset';
                        }}
                        className="flex items-center gap-1"
                    >
                        <AlertTriangle className="h-4 w-4" />
                        <span>Fix Auth</span>
                    </Button>
                </div>
            ) : (
                <Button
                    variant="default"
                    size="sm"
                    onClick={handleSignIn}
                    className="bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-1 min-w-24"
                >
                    <LogIn className="h-4 w-4" />
                    <span>Sign In</span>
                </Button>
            )}
        </div>
    );
} 