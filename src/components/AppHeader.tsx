"use client";

import Link from 'next/link';
import { UserNavigation } from './UserNavigation';

interface AppHeaderProps {
    showNav?: boolean;
    currentPage?: 'home' | 'debate' | 'profile' | 'history' | 'favorites';
}

export function AppHeader({ showNav = true, currentPage = 'home' }: AppHeaderProps) {
    return (
        <header className="bg-black border-b border-gray-800 p-4 flex justify-between items-center sticky top-0 z-10">
            <Link href="/" className="text-xl font-bold text-white">Debate-able</Link>

            <div className="flex items-center gap-4">
                {showNav && (
                    <nav className="hidden md:flex space-x-6">
                        <Link
                            href="/"
                            className={`text-xs font-medium ${currentPage === 'home' ? 'text-primary' : 'text-gray-300 hover:text-primary'} transition-colors`}
                        >
                            Home
                        </Link>
                        <Link
                            href="/app/debate"
                            className={`text-xs font-medium ${currentPage === 'debate' ? 'text-primary' : 'text-gray-300 hover:text-primary'} transition-colors`}
                        >
                            New Debate
                        </Link>
                        <Link
                            href="/history"
                            className={`text-xs font-medium ${currentPage === 'history' ? 'text-primary' : 'text-gray-300 hover:text-primary'} transition-colors`}
                        >
                            History
                        </Link>
                        <Link
                            href="/profile"
                            className={`text-xs font-medium ${currentPage === 'profile' ? 'text-primary' : 'text-gray-300 hover:text-primary'} transition-colors`}
                        >
                            Profile
                        </Link>
                    </nav>
                )}
                <UserNavigation />
            </div>
        </header>
    );
} 