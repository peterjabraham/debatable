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

    const loadMockTopics = () => {
        console.log("Loading mock topics for testing");

        const mockTopics = [
            {
                title: "Climate Change (Mock Data)",
                confidence: 0.95,
                arguments: [
                    {
                        claim: "Climate change mitigation requires immediate global action",
                        evidence: "IPCC reports indicate that delaying action increases both cost and difficulty of mitigation."
                    },
                    {
                        claim: "Renewable energy adoption must accelerate to reduce carbon emissions",
                        evidence: "Studies show renewable energy can replace fossil fuels economically in most markets."
                    },
                    {
                        claim: "Carbon pricing is an effective economic tool for climate action",
                        evidence: "Economic analyses demonstrate that putting a price on carbon creates market incentives for emissions reduction."
                    }
                ]
            },
            {
                title: "AI Regulation (Mock Data)",
                confidence: 0.88,
                arguments: [
                    {
                        claim: "AI development should be subject to international oversight",
                        evidence: "The global impact of AI technologies necessitates coordinated international governance."
                    },
                    {
                        claim: "Self-regulation by tech companies is insufficient for AI safety",
                        evidence: "History of technology regulation shows that industry self-regulation often prioritizes profit over public interest."
                    },
                    {
                        claim: "Transparency in AI decision-making systems should be mandatory",
                        evidence: "Explainable AI is essential for accountability and preventing algorithmic discrimination."
                    }
                ]
            },
            {
                title: "Universal Basic Income (Mock Data)",
                confidence: 0.82,
                arguments: [
                    {
                        claim: "UBI could provide economic security in an increasingly automated economy",
                        evidence: "Automation trends suggest significant job displacement that traditional safety nets may not adequately address."
                    },
                    {
                        claim: "Implementation costs may be offset by reduced bureaucracy",
                        evidence: "Administrative savings from consolidating multiple welfare programs could partially fund UBI programs."
                    },
                    {
                        claim: "Pilot programs show promising results on individual well-being",
                        evidence: "Multiple UBI experiments demonstrate improvements in health outcomes, education, and entrepreneurship."
                    }
                ]
            }
        ];

        setExtractedTopics(mockTopics);
        setError(null);

        // Show notification about using sample topics
        addNotification({
            title: 'Sample Topics Loaded',
            message: 'Using sample topics for testing purposes',
            status: 'info',
            duration: 5000
        });
    };

    return (
        <div className="w-full mb-6">
            <div className="bg-gray-50 dark:bg-gray-900 border rounded-lg shadow-sm">
                <div className="p-4 border-b">
                    <div className="flex justify-between items-center">
                        <div>
                            <h2 className="text-base font-semibold">Content Analyzer</h2>
                            <p className="text-xs text-muted-foreground">
                                Upload content to extract debate topics or enter a topic directly to start a debate between AI experts ...and yourself.
                            </p>
                        </div>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowTopics(!showTopics)}
                            className="h-7 px-2"
                        >
                            {showTopics ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                        </Button>
                    </div>
                </div>

                {showTopics && (
                    <div className="p-4">
                        <div className="space-y-3.5">
                            <div className="flex border-b">
                                <button
                                    className={`px-3.5 py-1.5 text-xs font-bold border-b-2 ${activeTab === 'document'
                                        ? "border-blue-500 text-blue-500"
                                        : "border-transparent text-gray-500 hover:text-blue-500 hover:border-blue-500"
                                        }`}
                                    onClick={() => handleTabChange('document')}
                                >
                                    <FileText
                                        className={`inline-block w-3.5 h-3.5 mr-1.5 ${activeTab === 'document'
                                            ? "text-blue-500"
                                            : "text-gray-400 group-hover:text-blue-500"
                                            }`}
                                    />
                                    <span className="hidden sm:inline">Document</span>
                                </button>
                                <button
                                    className={`px-3.5 py-1.5 text-xs font-bold border-b-2 ${activeTab === 'youtube'
                                        ? "border-red-500 text-red-500"
                                        : "border-transparent text-gray-500 hover:text-red-500 hover:border-red-500"
                                        }`}
                                    onClick={() => handleTabChange('youtube')}
                                >
                                    <Youtube
                                        className={`inline-block w-3.5 h-3.5 mr-1.5 ${activeTab === 'youtube'
                                            ? "text-red-500"
                                            : "text-gray-400 group-hover:text-red-500"
                                            }`}
                                    />
                                    <span className="hidden sm:inline">YouTube</span>
                                </button>
                                <button
                                    className={`px-3.5 py-1.5 text-xs font-bold border-b-2 ${activeTab === 'podcast'
                                        ? "border-green-500 text-green-500"
                                        : "border-transparent text-gray-500 hover:text-green-500 hover:border-green-500"
                                        }`}
                                    onClick={() => handleTabChange('podcast')}
                                >
                                    <Mic
                                        className={`inline-block w-3.5 h-3.5 mr-1.5 ${activeTab === 'podcast'
                                            ? "text-green-500"
                                            : "text-gray-400 group-hover:text-green-500"
                                            }`}
                                    />
                                    <span className="hidden sm:inline">Podcast</span>
                                </button>
                                <button
                                    className={`px-3.5 py-1.5 text-xs font-bold border-b-2 ${activeTab === 'link'
                                        ? "border-blue-700 text-blue-700"
                                        : "border-transparent text-gray-500 hover:text-blue-700 hover:border-blue-700"
                                        }`}
                                    onClick={() => handleTabChange('link')}
                                >
                                    <LinkIcon
                                        className={`inline-block w-3.5 h-3.5 mr-1.5 ${activeTab === 'link'
                                            ? "text-blue-700"
                                            : "text-gray-400 group-hover:text-blue-700"
                                            }`}
                                    />
                                    <span className="hidden sm:inline">Web Link</span>
                                </button>
                            </div>

                            {activeTab === 'document' && (
                                <div className="space-y-3.5">
                                    <div className="grid w-full max-w-sm items-center gap-1.5">
                                        <label htmlFor="document-upload" className="text-xs font-light text-gray-600 dark:text-gray-300">
                                            Upload Document (PDF, DOCX, TXT)
                                        </label>
                                        <div className="flex items-center justify-center w-full">
                                            <label
                                                htmlFor="document-upload"
                                                className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed rounded-lg cursor-pointer bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600 hover:border-blue-500 dark:hover:border-blue-500"
                                            >
                                                <div className="flex flex-col items-center justify-center pt-4 pb-5">
                                                    <Upload className="w-7 h-7 mb-2.5 text-gray-400" />
                                                    <p className="mb-1.5 text-xs font-light text-gray-500 dark:text-gray-400">
                                                        <span className="font-bold">Click to upload</span> or drag and drop
                                                    </p>
                                                    <p className="text-xs font-light text-gray-500 dark:text-gray-400">
                                                        PDF, DOCX, TXT (MAX. 20MB)
                                                    </p>
                                                </div>
                                                <input
                                                    id="document-upload"
                                                    type="file"
                                                    className="hidden"
                                                    onChange={handleFileChange}
                                                    accept=".pdf,.docx,.txt"
                                                />
                                            </label>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'youtube' && (
                                <div className="space-y-3.5">
                                    <div className="grid w-full items-center gap-1.5">
                                        <label htmlFor="youtube-url" className="text-xs font-light text-gray-600 dark:text-gray-300">
                                            YouTube Video URL
                                        </label>
                                        <Input
                                            id="youtube-url"
                                            type="url"
                                            placeholder="https://www.youtube.com/watch?v=..."
                                            value={url}
                                            onChange={handleUrlChange}
                                            disabled={isProcessing}
                                            className="font-light h-8 text-xs"
                                        />
                                    </div>
                                </div>
                            )}

                            {activeTab === 'podcast' && (
                                <div className="space-y-3.5">
                                    <div className="grid w-full items-center gap-1.5">
                                        <label htmlFor="podcast-url" className="text-xs font-light text-gray-600 dark:text-gray-300">
                                            Podcast URL
                                        </label>
                                        <Input
                                            id="podcast-url"
                                            type="url"
                                            placeholder="https://podcasts.example.com/episode..."
                                            value={url}
                                            onChange={handleUrlChange}
                                            disabled={isProcessing}
                                            className="font-light h-8 text-xs"
                                        />
                                    </div>
                                </div>
                            )}

                            {activeTab === 'link' && (
                                <div className="space-y-3.5">
                                    <div className="grid w-full items-center gap-1.5">
                                        <label htmlFor="web-url" className="text-xs font-light text-gray-600 dark:text-gray-300">
                                            Web Page URL
                                        </label>
                                        <Input
                                            id="web-url"
                                            type="url"
                                            placeholder="https://example.com/article..."
                                            value={url}
                                            onChange={handleUrlChange}
                                            disabled={isProcessing}
                                            className="font-light h-8 text-xs"
                                        />
                                    </div>
                                </div>
                            )}

                            {error && (
                                <div className="text-xs text-red-500 mt-2">{error}</div>
                            )}

                            <div className="mt-3.5">
                                <Button
                                    onClick={handleProcessContent}
                                    disabled={isProcessing || (!file && !url)}
                                    className="font-bold h-8 text-xs"
                                >
                                    {isProcessing ? (
                                        <>
                                            <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                                            Processing...
                                        </>
                                    ) : (
                                        'Extract Topics'
                                    )}
                                </Button>
                            </div>
                        </div>

                        {extractedTopics.length > 0 && (
                            <div className="mt-5 space-y-3.5">
                                <h3 className="text-sm font-medium">Extracted Topics</h3>
                                <div className="space-y-2.5">
                                    {extractedTopics.map((topic, index) => (
                                        <div
                                            key={index}
                                            className={`border rounded-md p-2.5 cursor-pointer transition-colors ${selectedTopic === index
                                                ? "border-primary bg-primary/5"
                                                : "hover:bg-muted/50"
                                                }`}
                                            onClick={() => handleSelectTopic(index)}
                                        >
                                            <div className="flex justify-between items-start">
                                                <div className="flex-1">
                                                    <h4 className="text-xs font-medium">{topic.title}</h4>
                                                    <div className="text-xs text-muted-foreground mt-1">
                                                        {topic.arguments.length} key arguments • {Math.round(topic.confidence * 100)}% confidence
                                                    </div>
                                                </div>
                                                {selectedTopic === index && (
                                                    <Check className="h-4 w-4 text-primary" />
                                                )}
                                            </div>

                                            {selectedTopic === index && (
                                                <div className="mt-2.5 space-y-1.5">
                                                    <h5 className="text-xs font-medium">Key Arguments:</h5>
                                                    <ul className="space-y-1.5">
                                                        {topic.arguments.slice(0, 3).map((arg, i) => (
                                                            <li key={i} className="text-xs">
                                                                <span className="font-medium">{arg.claim}</span>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {extractedTopics.length === 0 && !isProcessing && (
                    <div className="p-3.5 border-t flex justify-center">
                        <Button
                            onClick={loadMockTopics}
                            variant="link"
                            className="text-xs text-blue-500 hover:text-blue-400"
                        >
                            Skip & Load Sample Topics
                        </Button>
                    </div>
                )}

                {extractedTopics.length > 0 && selectedTopic !== null && (
                    <div className="p-3.5 border-t flex justify-end">
                        <Button onClick={handleStartDebate} variant="success" className="h-8 text-xs">
                            Take me to the debate
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
} 