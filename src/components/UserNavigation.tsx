"use client";

import { useState } from 'react';
import { useSession, signIn, signOut } from 'next-auth/react';
import Link from 'next/link';
import { Button } from './ui/button';
import {
    User,
    LogOut,
    Settings,
    History,
    Heart,
    PlusCircle
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
    const { data: session, status } = useSession();
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    return (
        <div className="flex items-center gap-4">
            <ThemeToggle />

            {status === 'loading' ? (
                <div className="h-9 w-9 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse" />
            ) : session ? (
                <DropdownMenu open={isMenuOpen} onOpenChange={setIsMenuOpen}>
                    <DropdownMenuTrigger asChild>
                        <Button
                            variant="ghost"
                            className="relative h-9 w-9 rounded-full"
                            aria-label="User menu"
                        >
                            {session.user?.image ? (
                                <img
                                    src={session.user.image}
                                    alt={session.user.name || 'User'}
                                    className="h-full w-full rounded-full object-cover"
                                />
                            ) : (
                                <User className="h-5 w-5" />
                            )}
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                        <DropdownMenuLabel>
                            <div className="flex flex-col space-y-1">
                                <p className="text-sm font-medium">{session.user?.name}</p>
                                <p className="text-xs text-muted-foreground">{session.user?.email}</p>
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
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                            className="flex items-center gap-2 cursor-pointer"
                            onClick={() => {
                                setIsMenuOpen(false);
                                // Use the dedicated sign-out page instead of the direct route
                                window.location.href = '/auth/sign-out';
                            }}
                        >
                            <LogOut className="h-4 w-4" />
                            <span>Sign Out</span>
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            ) : (
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => signIn()}
                >
                    Sign In
                </Button>
            )}
        </div>
    );
} 