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
    LogIn,
    LifeBuoy
} from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
    DropdownMenuGroup
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { LogoutButton } from '@/components/auth';

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

    const userInitials = session?.user?.name ? session.user.name.split(' ').map(n => n[0]).join('') : '';

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
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                            <Avatar className="h-8 w-8">
                                <AvatarImage src={session?.user?.image || undefined} alt={session?.user?.name || "User"} />
                                <AvatarFallback>{userInitials}</AvatarFallback>
                            </Avatar>
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-56" align="end" forceMount>
                        <DropdownMenuLabel className="font-normal">
                            <div className="flex flex-col space-y-1">
                                <p className="text-sm font-medium leading-none">{session?.user?.name}</p>
                                <p className="text-xs leading-none text-muted-foreground">
                                    {session?.user?.email}
                                </p>
                            </div>
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuGroup>
                            <DropdownMenuItem asChild>
                                <Link href="/profile">
                                    <User className="mr-2 h-4 w-4" />
                                    <span>Profile</span>
                                </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                                <Link href="/settings">
                                    <Settings className="mr-2 h-4 w-4" />
                                    <span>Settings</span>
                                </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                                <Link href="/debug/auth">
                                    <LifeBuoy className="mr-2 h-4 w-4" />
                                    <span>Auth Debug</span>
                                </Link>
                            </DropdownMenuItem>
                        </DropdownMenuGroup>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem asChild>
                            <LogoutButton
                                variant="ghost"
                                className="w-full cursor-default flex items-center px-2 py-1.5 text-sm"
                                showIcon={false}
                                text={
                                    <div className="flex items-center">
                                        <LogOut className="mr-2 h-4 w-4" />
                                        <span>Log out</span>
                                    </div>
                                }
                            />
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