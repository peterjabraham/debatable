'use client';

import React from 'react';
import { useDebateStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { History, Briefcase } from 'lucide-react';

export function ExpertTypeSelector() {
    const { expertType, setExpertType } = useDebateStore();

    return (
        <div className="w-full mb-6">
            <div className="bg-gray-50 dark:bg-gray-900 border rounded-lg shadow-sm">
                <div className="p-4 border-b">
                    <h2 className="text-base font-semibold">Choose Your Debate Participants</h2>
                    <p className="text-xs text-muted-foreground">
                        Select who you want to debate with on your chosen topic
                    </p>
                </div>
                <div className="p-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div
                            className={`border rounded-lg p-4 cursor-pointer transition-all ${expertType === 'historical'
                                    ? 'border-primary bg-primary/5'
                                    : 'hover:border-primary/50'
                                }`}
                            onClick={() => setExpertType('historical')}
                        >
                            <div className="flex items-center gap-3 mb-2">
                                <History className="h-5 w-5 text-primary" />
                                <h3 className="font-medium">Historical Figures</h3>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Debate with notable personalities from history like Einstein, Aristotle,
                                Marie Curie, and others who bring their historical perspectives.
                            </p>
                        </div>

                        <div
                            className={`border rounded-lg p-4 cursor-pointer transition-all ${expertType === 'domain'
                                    ? 'border-primary bg-primary/5'
                                    : 'hover:border-primary/50'
                                }`}
                            onClick={() => setExpertType('domain')}
                        >
                            <div className="flex items-center gap-3 mb-2">
                                <Briefcase className="h-5 w-5 text-primary" />
                                <h3 className="font-medium">Domain Specialists</h3>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Engage with AI-powered domain experts who specialize in specific fields
                                like technology, medicine, economics, and more.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
} 