"use client";

import React, { useState } from 'react';
import { useDebateStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useNotification } from '@/components/ui/notification';
import {
    Loader2,
    FileText,
    Youtube,
    Mic,
    Link as LinkIcon,
    ChevronDown,
    ChevronUp,
    Check,
    Upload
} from 'lucide-react';

interface Topic {
    title: string;
    confidence: number;
    arguments: {
        claim: string;
        evidence: string;
        counterpoints?: string[];
    }[];
}

export function ContentUploader() {
    const [activeTab, setActiveTab] = useState('document');
    const [isProcessing, setIsProcessing] = useState(false);
    const [processingProgress, setProcessingProgress] = useState<string | null>(null);
    const [file, setFile] = useState<File | null>(null);
    const [url, setUrl] = useState('');
    const [extractedTopics, setExtractedTopics] = useState<Topic[]>([]);
    const [selectedTopic, setSelectedTopic] = useState<number | null>(null);
    const [showTopics, setShowTopics] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [notificationId, setNotificationId] = useState<string | null>(null);

    const { setTopic } = useDebateStore();
    const { addNotification, updateNotification, removeNotification } = useNotification();

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0] || null;
        setFile(selectedFile);
        setError(null);
    };

    const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setUrl(e.target.value);
        setError(null);
    };

    const handleTabChange = (value: string) => {
        setActiveTab(value);
        setFile(null);
        setUrl('');
        setError(null);
    };

    const handleProcessContent = async () => {
        setIsProcessing(true);
        setError(null);
        setExtractedTopics([]);

        // Create initial notification
        const id = addNotification({
            status: 'loading',
            title: 'Processing Content',
            message: 'Starting content processing...',
            duration: 0, // Persistent until complete
        });
        setNotificationId(id);

        try {
            let endpoint = '';
            const formData = new FormData();

            switch (activeTab) {
                case 'document':
                    if (!file) {
                        throw new Error('Please select a file to upload');
                    }
                    updateNotification(id, {
                        message: 'Uploading document...',
                    });
                    endpoint = '/api/content/document';
                    formData.append('file', file);
                    break;

                case 'youtube':
                    if (!url) {
                        throw new Error('Please enter a valid YouTube URL');
                    }
                    updateNotification(id, {
                        message: 'Fetching YouTube video...',
                    });
                    endpoint = '/api/content/media';
                    formData.append('url', url);
                    formData.append('type', activeTab);
                    break;

                case 'podcast':
                    if (!url) {
                        throw new Error('Please enter a valid podcast URL');
                    }
                    updateNotification(id, {
                        message: 'Fetching podcast audio...',
                    });
                    endpoint = '/api/content/media';
                    formData.append('url', url);
                    formData.append('type', activeTab);
                    break;

                case 'link':
                    if (!url) {
                        throw new Error('Please enter a valid URL');
                    }
                    updateNotification(id, {
                        message: 'Fetching web content...',
                    });
                    endpoint = '/api/content/link';
                    formData.append('url', url);
                    break;
            }

            // For YouTube and podcast, warn about longer processing time
            if (activeTab === 'youtube' || activeTab === 'podcast') {
                updateNotification(id, {
                    message: `Processing ${activeTab} content. This may take a few minutes...`,
                });
            }

            const response = await fetch(endpoint, {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to process content');
            }

            const data = await response.json();
            setExtractedTopics(data.topics || []);

            // Update notification to success
            updateNotification(id, {
                status: 'success',
                title: 'Processing Complete',
                message: `Successfully extracted ${data.topics?.length || 0} topics from content.`,
                duration: 5000, // Auto-dismiss after 5 seconds
            });

            // Show notification about using sample topics
            addNotification({
                title: 'Sample Topics Loaded',
                message: 'Using sample topics for testing purposes',
                status: 'info',
                duration: 5000
            });

        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
            setError(errorMessage);

            // Update notification to error
            updateNotification(id, {
                status: 'error',
                title: 'Processing Failed',
                message: errorMessage,
                duration: 5000, // Auto-dismiss after 5 seconds
            });
        } finally {
            setIsProcessing(false);
            setProcessingProgress(null);
            // Clear notification ID
            setNotificationId(null);
        }
    };

    const handleSelectTopic = (index: number) => {
        setSelectedTopic(index);
    };

    const handleStartDebate = () => {
        if (selectedTopic !== null && extractedTopics[selectedTopic]) {
            const selectedTopicData = extractedTopics[selectedTopic];
            // Pass the full topic information as JSON string to preserve arguments
            setTopic(JSON.stringify({
                title: selectedTopicData.title,
                confidence: selectedTopicData.confidence,
                arguments: selectedTopicData.arguments
            }));
        }
    };

    return (
        <div className="w-full max-w-4xl mx-auto p-4">
            <h2 className="text-2xl font-bold mb-4">Content Upload</h2>

            {/* File Upload Section */}
            <div className="mb-8">
                <h3 className="text-xl font-semibold mb-4">Upload Files</h3>
                <div className="flex flex-col gap-4">
                    <div className="flex items-center gap-4">
                        <input
                            type="file"
                            onChange={handleFileChange}
                            accept=".pdf,.doc,.docx,.txt"
                            className="file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-violet-50 file:text-violet-700 hover:file:bg-violet-100"
                        />
                        <Button
                            onClick={handleProcessContent}
                            disabled={!file || isProcessing}
                        >
                            {isProcessing ? 'Processing...' : 'Upload'}
                        </Button>
                    </div>
                    {error && (
                        <p className="text-red-500">{error}</p>
                    )}
                </div>
            </div>

            {/* Web Link Section */}
            <div className="mb-8">
                <h3 className="text-xl font-semibold mb-4">Add Web Link</h3>
                <div className="flex flex-col gap-4">
                    <div className="flex items-center gap-4">
                        <input
                            type="url"
                            value={url}
                            onChange={handleUrlChange}
                            placeholder="Enter web link"
                            className="flex-1 p-2 border rounded"
                        />
                        <Button
                            onClick={handleProcessContent}
                            disabled={!url || isProcessing}
                        >
                            {isProcessing ? 'Processing...' : 'Add Link'}
                        </Button>
                    </div>
                    {error && (
                        <p className="text-red-500">{error}</p>
                    )}
                </div>
            </div>

            {/* Topics Section */}
            {extractedTopics.length > 0 && (
                <div className="mb-8">
                    <h3 className="text-xl font-semibold mb-4">Extracted Topics</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {extractedTopics.map((topic, index) => (
                            <div key={index} className="p-4 border rounded-lg">
                                <h4 className="font-semibold mb-2">{topic.title}</h4>
                                <p className="text-sm text-gray-600 mb-2">{topic.arguments.length} key arguments • {Math.round(topic.confidence * 100)}% confidence</p>
                                <div className="flex flex-wrap gap-2">
                                    {topic.arguments.slice(0, 3).map((arg, i) => (
                                        <span
                                            key={i}
                                            className="px-2 py-1 bg-gray-100 rounded-full text-xs"
                                        >
                                            {arg.claim}
                                        </span>
                                    ))}
                                </div>
                                <div className="mt-4">
                                    <h5 className="font-semibold mb-2">Evidence:</h5>
                                    <p className="text-sm">{topic.arguments[0].evidence}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
} 