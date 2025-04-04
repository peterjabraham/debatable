"use client";

import { DebatePanel } from '@/components/debate';
import { NotificationProvider } from '@/components/ui';
import { AppHeader, UserNavigation } from '@/components';

export default function DebatePage() {
    return (
        <NotificationProvider>
            <div className="flex min-h-screen flex-col">
                <AppHeader currentPage="debate" />

                <div className="max-w-4xl mx-auto w-full p-4">
                    <div className="mb-6 bg-gray-700 text-white p-6 rounded-lg border border-gray-500">
                        <h2 className="text-lg font-semibold mb-2">Welcome to Debate-able</h2>
                        <p className="text-sm text-gray-300">
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