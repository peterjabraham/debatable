"use client";

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/components/ui/use-toast';
import { useDebateStore } from '@/lib/store';
import { ContentProcessingResponse, ContentProcessingError, DebateTopic } from '@/types/content';
import {
    FileText,
    Youtube,
    Headphones,
    Upload,
    CheckCircle,
    AlertCircle,
    ChevronDown,
    ChevronUp,
    Sparkles
} from 'lucide-react';

interface ContentUploaderProps {
    fileStatus: {
        message: string;
        className: string;
    };
}

interface ProcessingState {
    isProcessing: boolean;
    currentStep: string;
    error: string | null;
    contentId: string | null;
    extractedTopics: DebateTopic[];
    selectedTopicIndex: number | null;
    isExpanded: boolean;
}

export function ContentUploader({ fileStatus }: ContentUploaderProps) {
    const [activeTab, setActiveTab] = useState('document');
    const [file, setFile] = useState<File | null>(null);
    const [url, setUrl] = useState('');
    const [processing, setProcessing] = useState<ProcessingState>({
        isProcessing: false,
        currentStep: '',
        error: null,
        contentId: null,
        extractedTopics: [],
        selectedTopicIndex: null,
        isExpanded: false
    });

    const { toast } = useToast();
    const {
        setTopic,
        setTopicContext,
        setAvailableTopics,
        setProcessedContent
    } = useDebateStore();

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        setFile(selectedFile || null);
    };

    const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setUrl(e.target.value);
    };

    const handleTabChange = (value: string) => {
        console.log(`[ContentUploader] Tab changed from ${activeTab} to ${value}`);
        setActiveTab(value);
        // Reset form state when switching tabs
        setFile(null);
        setUrl('');
        setProcessing(prev => ({
            ...prev,
            error: null,
            extractedTopics: [],
            selectedTopicIndex: null
        }));
        // Force a small delay to ensure state is updated
        setTimeout(() => {
            console.log(`[ContentUploader] Tab change complete, activeTab is now: ${value}`);
        }, 100);
    };

    const validateContentInput = (currentTab: string): string | null => {
        console.log(`[ContentUploader] Validating input for tab: ${currentTab}`);
        console.log(`[ContentUploader] Current state:`, {
            currentTab,
            activeTab,
            hasFile: !!file,
            fileName: file?.name,
            hasUrl: !!url?.trim(),
            url: url?.substring(0, 50)
        });

        if (currentTab === 'document') {
            if (!file) return 'Please select a PDF file to upload.';
            if (!file.name.toLowerCase().endsWith('.pdf')) {
                return 'Please select a valid PDF file.';
            }
            if (file.size > 50 * 1024 * 1024) {
                return 'File size must be less than 50MB.';
            }
        } else if (currentTab === 'youtube') {
            if (!url.trim()) return 'Please enter a YouTube URL.';
            const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
            if (!youtubeRegex.test(url)) {
                return 'Please enter a valid YouTube URL.';
            }
        } else if (currentTab === 'podcast') {
            if (!url.trim()) return 'Please enter a podcast RSS feed URL.';
            try {
                new URL(url);
            } catch {
                return 'Please enter a valid URL.';
            }
        }

        console.log(`[ContentUploader] Validation passed for ${currentTab}`);
        return null;
    };

    const handleContentProcessing = async () => {
        // Capture the current tab at the time of processing
        const currentTab = activeTab;
        console.log(`[ContentUploader] PROCESSING STARTED - activeTab: ${activeTab}, currentTab: ${currentTab}`);
        console.log(`[ContentUploader] Current form state:`, {
            file: file?.name || 'none',
            url: url || 'none',
            activeTab,
            currentTab
        });

        const validationError = validateContentInput(currentTab);
        if (validationError) {
            console.error(`[ContentUploader] Validation failed for tab ${currentTab}:`, validationError);
            toast({
                title: 'Validation Error',
                description: validationError,
                variant: 'destructive',
            });
            return;
        }

        setProcessing(prev => ({
            ...prev,
            isProcessing: true,
            currentStep: 'Preparing content...',
            error: null,
            extractedTopics: [],
            selectedTopicIndex: null
        }));

        try {
            const formData = new FormData();

            // Ensure we're using the correct source type based on current tab
            const sourceType = currentTab === 'document' ? 'pdf' : currentTab;
            formData.append('sourceType', sourceType);

            console.log(`[ContentUploader] Using sourceType: ${sourceType} for tab: ${currentTab}`);

            if (currentTab === 'document' && file) {
                formData.append('file', file);
                setProcessing(prev => ({ ...prev, currentStep: 'Uploading PDF...' }));
            } else if ((currentTab === 'youtube' || currentTab === 'podcast') && url) {
                formData.append('url', url);
                setProcessing(prev => ({
                    ...prev,
                    currentStep: currentTab === 'youtube'
                        ? 'Fetching YouTube transcript...'
                        : 'Processing podcast audio...'
                }));
            } else {
                throw new Error(`Invalid state: currentTab=${currentTab}, hasFile=${!!file}, hasUrl=${!!url}`);
            }

            console.log(`[ContentUploader] Processing ${sourceType} content`);

            const response = await fetch('/api/content/process-source', {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                const errorData: ContentProcessingError = await response.json();
                throw new Error(errorData.details || errorData.error || 'Processing failed');
            }

            setProcessing(prev => ({ ...prev, currentStep: 'Extracting debate topics...' }));

            const result: ContentProcessingResponse = await response.json();

            console.log('[ContentUploader] Processing completed:', result);

            // Update the store with processed content
            const contentContext = {
                title: result.debateTopics[0]?.title || 'Unknown Topic',
                description: result.debateTopics[0]?.summary,
                contentId: result.contentId,
                sourceType: sourceType as 'pdf' | 'youtube' | 'podcast',
                confidence: result.debateTopics[0]?.confidence
            };

            setAvailableTopics(result.debateTopics);

            setProcessing(prev => ({
                ...prev,
                isProcessing: false,
                currentStep: '',
                contentId: result.contentId,
                extractedTopics: result.debateTopics,
                isExpanded: true
            }));

            toast({
                title: 'Content Processed Successfully',
                description: `Found ${result.debateTopics.length} debate topics. Select one to start debating!`,
            });

        } catch (error: any) {
            console.error('[ContentUploader] Processing error:', error);

            setProcessing(prev => ({
                ...prev,
                isProcessing: false,
                currentStep: '',
                error: error.message
            }));

            toast({
                title: 'Processing Failed',
                description: error.message,
                variant: 'destructive',
            });
        }
    };

    const handleSelectTopic = (index: number) => {
        const topic = processing.extractedTopics[index];
        if (!topic) return;

        // Update the store with selected topic and context
        const contentContext = {
            title: topic.title,
            description: topic.summary,
            contentId: processing.contentId,
            sourceType: activeTab === 'document' ? 'pdf' as const : activeTab as 'youtube' | 'podcast',
            confidence: topic.confidence
        };

        setTopicContext(contentContext);
        setProcessing(prev => ({ ...prev, selectedTopicIndex: index }));

        toast({
            title: 'Topic Selected',
            description: `Ready to debate: "${topic.title}"`,
        });
    };

    const handleStartDebate = () => {
        if (processing.selectedTopicIndex === null) {
            toast({
                title: 'No Topic Selected',
                description: 'Please select a topic first.',
                variant: 'destructive',
            });
            return;
        }

        const selectedTopic = processing.extractedTopics[processing.selectedTopicIndex];

        // Navigate to debate - this would typically be handled by your routing system
        window.location.href = `/app/debate?topic=${encodeURIComponent(selectedTopic.title)}`;
    };

    const getStepIcon = () => {
        if (processing.error) return <AlertCircle className="h-4 w-4 text-red-500" />;
        if (processing.isProcessing) return <Spinner className="h-4 w-4" />;
        if (processing.extractedTopics.length > 0) return <CheckCircle className="h-4 w-4 text-green-500" />;
        return null;
    };

    const handleToggleExpanded = () => {
        setProcessing(prev => ({ ...prev, isExpanded: !prev.isExpanded }));
    };

    const handleLoadSampleTopics = () => {
        const sampleTopics: DebateTopic[] = [
            {
                title: "AI Impact on Job Market",
                summary: "Exploring whether artificial intelligence will create more jobs than it eliminates, and how society should prepare for workforce transformation.",
                confidence: 0.9
            },
            {
                title: "Universal Basic Income Effectiveness",
                summary: "Debating the potential benefits and drawbacks of implementing UBI as a solution to technological unemployment and economic inequality.",
                confidence: 0.85
            },
            {
                title: "Climate Change Policy Priorities",
                summary: "Examining different approaches to climate action: carbon pricing, green technology investment, or regulatory mandates.",
                confidence: 0.88
            }
        ];

        setProcessing(prev => ({
            ...prev,
            extractedTopics: sampleTopics,
            isExpanded: true,
            contentId: 'sample-content'
        }));

        setAvailableTopics(sampleTopics);

        toast({
            title: 'Sample Topics Loaded',
            description: 'Try out the debate system with these sample topics!',
        });
    };

    return (
        <div className="w-full max-w-4xl mx-auto space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-blue-500" />
                        Content Processing & Debate Topics
                    </CardTitle>
                    <CardDescription>
                        Upload a PDF, share a YouTube video, or add a podcast to automatically generate debate topics
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {/* Custom Tab Implementation */}
                    <div className="w-full">
                        {/* Tab Headers */}
                        <div className="inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground w-full">
                            <button
                                className={`inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 flex-1 ${activeTab === 'document'
                                    ? 'bg-background text-foreground shadow-sm'
                                    : 'hover:bg-background/50'
                                    }`}
                                onClick={() => handleTabChange('document')}
                            >
                                <FileText className="h-4 w-4 mr-2" />
                                Document
                            </button>
                            <button
                                className={`inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 flex-1 ${activeTab === 'youtube'
                                    ? 'bg-background text-foreground shadow-sm'
                                    : 'hover:bg-background/50'
                                    }`}
                                onClick={() => handleTabChange('youtube')}
                            >
                                <Youtube className="h-4 w-4 mr-2" />
                                YouTube
                            </button>
                            <button
                                className={`inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 flex-1 ${activeTab === 'podcast'
                                    ? 'bg-background text-foreground shadow-sm'
                                    : 'hover:bg-background/50'
                                    }`}
                                onClick={() => handleTabChange('podcast')}
                            >
                                <Headphones className="h-4 w-4 mr-2" />
                                Podcast
                            </button>
                        </div>

                        {/* Tab Content */}
                        <div className="mt-6">
                            {activeTab === 'document' && (
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Upload PDF Document</label>
                                        <div className="flex items-center gap-2">
                                            <Input
                                                type="file"
                                                accept=".pdf"
                                                onChange={handleFileChange}
                                                className="flex-1"
                                            />
                                            {file && (
                                                <Badge variant="secondary" className="flex items-center gap-1">
                                                    <FileText className="h-3 w-3" />
                                                    {file.name}
                                                </Badge>
                                            )}
                                        </div>
                                        <p className="text-xs text-gray-500">
                                            Supports PDF files up to 50MB. Text will be extracted automatically.
                                        </p>
                                    </div>

                                    <div className="flex items-center gap-2 pt-2">
                                        <Button
                                            onClick={handleContentProcessing}
                                            disabled={processing.isProcessing || !file}
                                            className="flex items-center gap-2"
                                        >
                                            {processing.isProcessing ? (
                                                <Spinner className="h-4 w-4" />
                                            ) : (
                                                <Upload className="h-4 w-4" />
                                            )}
                                            {processing.isProcessing ? 'Processing PDF...' : 'Process PDF'}
                                        </Button>

                                        {processing.currentStep && activeTab === 'document' && (
                                            <div className="flex items-center gap-2 text-sm text-gray-600">
                                                {getStepIcon()}
                                                {processing.currentStep}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {activeTab === 'youtube' && (
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">YouTube Video URL</label>
                                        <Input
                                            type="url"
                                            placeholder="https://www.youtube.com/watch?v=..."
                                            value={url}
                                            onChange={handleUrlChange}
                                            className="w-full"
                                        />
                                        <p className="text-xs text-gray-500">
                                            We'll automatically fetch the video transcript for topic generation.
                                        </p>
                                    </div>

                                    <div className="flex items-center gap-2 pt-2">
                                        <Button
                                            onClick={handleContentProcessing}
                                            disabled={processing.isProcessing || !url.trim()}
                                            className="flex items-center gap-2"
                                        >
                                            {processing.isProcessing ? (
                                                <Spinner className="h-4 w-4" />
                                            ) : (
                                                <Youtube className="h-4 w-4" />
                                            )}
                                            {processing.isProcessing ? 'Processing Video...' : 'Process YouTube Video'}
                                        </Button>

                                        {processing.currentStep && activeTab === 'youtube' && (
                                            <div className="flex items-center gap-2 text-sm text-gray-600">
                                                {getStepIcon()}
                                                {processing.currentStep}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {activeTab === 'podcast' && (
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Podcast RSS Feed URL</label>
                                        <Input
                                            type="url"
                                            placeholder="https://example.com/podcast-feed.xml"
                                            value={url}
                                            onChange={handleUrlChange}
                                            className="w-full"
                                        />
                                        <p className="text-xs text-gray-500">
                                            We'll download and transcribe the latest episode for analysis.
                                        </p>
                                    </div>

                                    <div className="flex items-center gap-2 pt-2">
                                        <Button
                                            onClick={handleContentProcessing}
                                            disabled={processing.isProcessing || !url.trim()}
                                            className="flex items-center gap-2"
                                        >
                                            {processing.isProcessing ? (
                                                <Spinner className="h-4 w-4" />
                                            ) : (
                                                <Headphones className="h-4 w-4" />
                                            )}
                                            {processing.isProcessing ? 'Processing Podcast...' : 'Process Podcast'}
                                        </Button>

                                        {processing.currentStep && activeTab === 'podcast' && (
                                            <div className="flex items-center gap-2 text-sm text-gray-600">
                                                {getStepIcon()}
                                                {processing.currentStep}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="flex items-center gap-4 pt-4 border-t">
                            <Button
                                variant="outline"
                                onClick={handleLoadSampleTopics}
                                className="flex items-center gap-2"
                            >
                                <Sparkles className="h-4 w-4" />
                                Try Sample Topics
                            </Button>

                            {processing.extractedTopics.length > 0 && (
                                <div className="flex items-center gap-2 text-sm text-green-600">
                                    <CheckCircle className="h-4 w-4" />
                                    {processing.extractedTopics.length} topics generated
                                </div>
                            )}

                            {/* Debug Info - Remove this after fixing */}
                            {process.env.NODE_ENV === 'development' && (
                                <div className="bg-yellow-100 border border-yellow-300 p-3 rounded-lg text-sm">
                                    <div className="font-medium text-yellow-800 mb-1">Debug Info:</div>
                                    <div className="text-yellow-700 space-y-1">
                                        <div>Active Tab: <span className="font-mono bg-yellow-200 px-1 rounded">{activeTab}</span></div>
                                        <div>File: <span className="font-mono bg-yellow-200 px-1 rounded">{file?.name || 'none'}</span></div>
                                        <div>URL: <span className="font-mono bg-yellow-200 px-1 rounded">{url?.substring(0, 40) || 'none'}</span></div>
                                        <div>Processing: <span className="font-mono bg-yellow-200 px-1 rounded">{processing.isProcessing ? 'Yes' : 'No'}</span></div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Processing Status and Error Display */}
            {processing.error && (
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{processing.error}</AlertDescription>
                </Alert>
            )}

            {/* Extracted Topics Display */}
            {processing.extractedTopics.length > 0 && (
                <Card>
                    <CardHeader className="cursor-pointer" onClick={handleToggleExpanded}>
                        <div className="flex items-center justify-between">
                            <CardTitle className="flex items-center gap-2">
                                <CheckCircle className="h-5 w-5 text-green-500" />
                                Generated Debate Topics ({processing.extractedTopics.length})
                            </CardTitle>
                            {processing.isExpanded ? (
                                <ChevronUp className="h-4 w-4" />
                            ) : (
                                <ChevronDown className="h-4 w-4" />
                            )}
                        </div>
                        <CardDescription>
                            Select a topic to start your debate
                        </CardDescription>
                    </CardHeader>

                    {processing.isExpanded && (
                        <CardContent className="space-y-4">
                            {processing.extractedTopics.map((topic, index) => (
                                <div
                                    key={index}
                                    className={`p-4 border rounded-lg cursor-pointer transition-colors ${processing.selectedTopicIndex === index
                                        ? 'border-blue-500 bg-blue-50'
                                        : 'border-gray-200 hover:border-gray-300'
                                        }`}
                                    onClick={() => handleSelectTopic(index)}
                                >
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            <h3 className="font-semibold text-lg mb-2">{topic.title}</h3>
                                            <p className="text-gray-600 text-sm mb-3">{topic.summary}</p>
                                            <div className="flex items-center gap-2">
                                                <Badge variant="secondary" className="text-xs">
                                                    {Math.round((topic.confidence || 0) * 100)}% confidence
                                                </Badge>
                                                {processing.selectedTopicIndex === index && (
                                                    <Badge variant="default" className="text-xs">
                                                        Selected
                                                    </Badge>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}

                            {processing.selectedTopicIndex !== null && (
                                <div className="pt-4 border-t">
                                    <Button
                                        onClick={handleStartDebate}
                                        className="w-full flex items-center gap-2"
                                        size="lg"
                                    >
                                        <Sparkles className="h-4 w-4" />
                                        Start Debate with Selected Topic
                                    </Button>
                                </div>
                            )}
                        </CardContent>
                    )}
                </Card>
            )}

            {/* File Status Display */}
            {fileStatus.message && (
                <Alert className={fileStatus.className}>
                    <AlertDescription>{fileStatus.message}</AlertDescription>
                </Alert>
            )}
        </div>
    );
} 