"use client";

import { useSession, signIn } from 'next-auth/react';
import Link from 'next/link';
import { Button } from './ui/button';
import {
    User,
    LogOut,
    Settings,
    LogIn,
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
    const { data: session, status } = useSession();

    const isAuthenticated = status === 'authenticated' && session?.user;
    const userInitials = session?.user?.name 
        ? session.user.name.split(' ').map(n => n[0]).join('').toUpperCase() 
        : 'U';

    return (
        <div className="flex items-center gap-4">
            <ThemeToggle />

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
            ) : (
                <Button
                    variant="default"
                    size="sm"
                    onClick={() => signIn()}
                    className="flex items-center gap-2"
                >
                    <LogIn className="h-4 w-4" />
                    <span>Sign In</span>
                </Button>
            )}
        </div>
    );
}
