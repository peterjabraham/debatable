"use client";

import { DebatePanel } from '@/components/debate/DebatePanel';
import { UserNavigation } from '@/components/UserNavigation';
import Link from 'next/link';
import { NotificationProvider } from '@/components/ui/notification';

export default function DebatePage() {
    return (
        <NotificationProvider>
            <div className="flex min-h-screen flex-col">
                <header className="bg-white dark:bg-gray-800 border-b p-4 flex justify-between items-center">
                    <Link href="/" className="text-xl font-bold">Debate-able</Link>
                    <div className="flex items-center gap-4">
                        <nav className="hidden md:flex space-x-6">
                            <Link href="/" className="text-xs font-medium hover:text-primary transition-colors">Home</Link>
                        </nav>
                        <UserNavigation />
                    </div>
                </header>

                <div className="max-w-4xl mx-auto w-full p-4">
                    <div className="mb-6">
                        <h2 className="text-lg font-semibold mb-2">Welcome to Debate-able</h2>
                        <p className="text-sm text-muted-foreground">
                            Upload content to extract debate topics or enter a topic directly to start a debate between AI experts ...and yourself.
                        </p>
                    </div>

                    {/* The DebatePanel component already contains the ContentUploader with all tabs */}
                    <DebatePanel />
                </div>
            </div>
        </NotificationProvider>
    );
} 