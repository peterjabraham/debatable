"use client";

import React, { useState } from 'react';
import { useDebateStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useNotification } from '@/components/ui/notification';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
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
    const [expanded, setExpanded] = useState(true);
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

        console.log(`[ContentUploader] Starting content processing for tab: ${activeTab}`);

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
                    console.log(`[ContentUploader] Uploading document: ${file.name}`);
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
                    console.log(`[ContentUploader] Processing YouTube URL: ${url}`);
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
                    console.log(`[ContentUploader] Processing podcast URL: ${url}`);
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
                    console.log(`[ContentUploader] Processing web URL: ${url}`);
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

            console.log(`[ContentUploader] Sending request to: ${endpoint}`);
            const response = await fetch(endpoint, {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                console.error(`[ContentUploader] API responded with error status: ${response.status}`);
                const errorData = await response.json();
                console.error(`[ContentUploader] Error details:`, errorData);
                throw new Error(errorData.message || errorData.error || 'Failed to process content');
            }

            console.log(`[ContentUploader] Received successful response from API`);
            // Get response body as text first for debugging
            const responseText = await response.text();
            console.log(`[ContentUploader] Raw response:`, responseText);

            // Parse the response text into JSON
            let data;
            try {
                data = JSON.parse(responseText);
                console.log(`[ContentUploader] Parsed response data:`, data);
            } catch (parseError) {
                console.error(`[ContentUploader] Error parsing JSON response:`, parseError);
                setError(`Invalid response format from server: ${parseError.message}. Please try again or contact support.`);

                // Update notification to error
                updateNotification(id, {
                    status: 'error',
                    title: 'Processing Failed',
                    message: 'Server returned an invalid response format',
                    duration: 5000, // Auto-dismiss after 5 seconds
                });
                return; // Exit early after showing error
            }

            // Check if data is valid and has topics
            if (data && data.topics && Array.isArray(data.topics) && data.topics.length > 0) {
                console.log(`[ContentUploader] Extracted ${data.topics.length} topics from content`);

                // Log first topic for debugging
                if (data.topics.length > 0) {
                    console.log(`[ContentUploader] First topic:`, data.topics[0]);

                    // Check for both 'arguments' and 'args' properties to handle backend format variations
                    const hasArguments = !!data.topics[0].arguments;
                    const hasArgs = !!data.topics[0].args;

                    console.log(`[ContentUploader] First topic has arguments: ${hasArguments}, args: ${hasArgs}`);

                    // If the topic has 'args' but not 'arguments', convert the format
                    if (!hasArguments && hasArgs) {
                        console.log(`[ContentUploader] Converting 'args' to 'arguments' format`);
                        data.topics = data.topics.map(topic => ({
                            ...topic,
                            arguments: topic.args
                        }));
                    }

                    console.log(`[ContentUploader] First topic arguments count: ${data.topics[0].arguments?.length || 0}`);
                }

                // Set the extracted topics in state
                setExtractedTopics(data.topics);

                // Update notification to success
                updateNotification(id, {
                    status: 'success',
                    title: 'Processing Complete',
                    message: `Successfully extracted ${data.topics.length} topics from content.`,
                    duration: 5000, // Auto-dismiss after 5 seconds
                });
            } else {
                console.error(`[ContentUploader] No topics found in response or topics is not an array:`,
                    data === null ? 'null' :
                        data === undefined ? 'undefined' :
                            Object.keys(data).length === 0 ? 'empty object {}' :
                                JSON.stringify(data)
                );

                // Try to print out some diagnostics about what we received
                console.log(`[ContentUploader] Response type: ${typeof data}, keys: ${data ? Object.keys(data).join(', ') : 'none'}`);

                // Check for mock API response first
                if (data && data.mock === true) {
                    console.log(`[ContentUploader] Detected mock API response due to server unavailability`);

                    // Load sample topics but with a clear notification about server being unavailable
                    handleLoadSampleTopics();

                    // Show an informative error message
                    setError(`API server is currently unavailable. Using demo topics instead. Please try again later.`);

                    // Update notification
                    updateNotification(id, {
                        status: 'warning',
                        title: 'Server Unavailable',
                        message: 'Using demo topics because the API server is unavailable',
                        duration: 8000, // Show longer
                    });

                    return;
                }

                // Check for error message in the response
                let errorMsg = '';
                if (data && typeof data.error === 'string') {
                    errorMsg = data.error;
                } else if (data && typeof data.message === 'string' && data.message.toLowerCase().includes('error')) {
                    errorMsg = data.message;
                } else {
                    errorMsg = 'No topics could be extracted from the content. Please try different content or check if the file format is supported.';
                }

                setError(errorMsg);

                // Update notification to error
                updateNotification(id, {
                    status: 'error',
                    title: 'No Topics Found',
                    message: errorMsg,
                    duration: 5000, // Auto-dismiss after 5 seconds
                });
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
            console.error(`[ContentUploader] Error processing content:`, err);
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

            // Log the current state to verify if topics were set
            console.log(`[ContentUploader] Final state: ${extractedTopics.length} topics`);
        }
    };

    const handleSelectTopic = (index: number) => {
        setSelectedTopic(index);
    };

    const handleStartDebate = () => {
        if (selectedTopic !== null && extractedTopics[selectedTopic]) {
            try {
                const selectedTopicData = extractedTopics[selectedTopic];

                // Ensure we have valid arguments array
                const topicArguments = Array.isArray(selectedTopicData.arguments) ?
                    selectedTopicData.arguments : [];

                // Ensure arguments have valid structure
                const safeArguments = topicArguments.map(arg => ({
                    claim: arg.claim || 'Unnamed claim',
                    evidence: arg.evidence || 'No evidence provided',
                    counterpoints: arg.counterpoints || []
                }));

                // Pass the full topic information as JSON string to preserve arguments
                setTopic(JSON.stringify({
                    title: selectedTopicData.title || 'Untitled Topic',
                    confidence: selectedTopicData.confidence || 0.7,
                    arguments: safeArguments
                }));

                console.log('[ContentUploader] Starting debate with selected topic:', selectedTopicData.title);
            } catch (err) {
                console.error('[ContentUploader] Error starting debate:', err);
                // Don't throw error, just log it
            }
        }
    };

    const handleToggleExpanded = () => {
        setExpanded(!expanded);
    };

    const handleLoadSampleTopics = () => {
        // Add a sample notification
        addNotification({
            title: 'Demo Topics Loaded',
            message: 'Using demonstration topics for testing purposes only',
            status: 'info',
            duration: 5000
        });

        // Clear any existing error when manually loading demo topics
        setError(null);

        // Set sample topics
        setExtractedTopics([
            {
                title: 'Climate Change Solutions',
                confidence: 0.92,
                arguments: [
                    {
                        claim: 'Renewable energy transition',
                        evidence: 'Shifting to renewable energy sources like solar and wind can significantly reduce carbon emissions.',
                    },
                    {
                        claim: 'Carbon pricing mechanisms',
                        evidence: 'Implementing carbon taxes or cap-and-trade systems can incentivize emission reductions.',
                    },
                    {
                        claim: 'Forest conservation',
                        evidence: 'Protecting and restoring forests helps absorb CO2 from the atmosphere.',
                    }
                ]
            },
            {
                title: 'Artificial Intelligence Regulation',
                confidence: 0.87,
                arguments: [
                    {
                        claim: 'Ethics guidelines for AI',
                        evidence: 'Establishing clear ethical guidelines for AI development ensures responsible innovation.',
                    },
                    {
                        claim: 'Regulatory frameworks',
                        evidence: 'Government oversight can prevent misuse of AI technologies.',
                    },
                    {
                        claim: 'Transparency requirements',
                        evidence: 'Requiring explainability in AI systems helps build trust and accountability.',
                    }
                ]
            }
        ]);
    };

    return (
        <div className="rounded-lg border bg-card shadow-sm">
            <div className="flex flex-col p-4">
                <div className="flex items-center justify-between mb-2">
                    <h3 className="text-lg font-semibold">Content Analyzer</h3>
                    <Button variant="ghost" size="sm" onClick={handleToggleExpanded} className="h-8 w-8 p-0">
                        {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>
                </div>

                {expanded && (
                    <p className="text-sm text-muted-foreground mb-4">
                        Upload content to extract debate topics or enter a topic directly to start a debate between AI experts
                        and yourself.
                    </p>
                )}

                {expanded && (
                    <Tabs defaultValue="document" onValueChange={handleTabChange} className="w-full">
                        <TabsList className="grid grid-cols-4 mb-4">
                            <TabsTrigger value="document" className="flex items-center gap-2">
                                <FileText className="h-4 w-4" />
                                <span>Document</span>
                            </TabsTrigger>
                            <TabsTrigger value="youtube" className="flex items-center gap-2">
                                <Youtube className="h-4 w-4" />
                                <span>YouTube</span>
                            </TabsTrigger>
                            <TabsTrigger value="podcast" className="flex items-center gap-2">
                                <Mic className="h-4 w-4" />
                                <span>Podcast</span>
                            </TabsTrigger>
                            <TabsTrigger value="link" className="flex items-center gap-2">
                                <LinkIcon className="h-4 w-4" />
                                <span>Web Link</span>
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value="document" className="space-y-4">
                            <div className="text-sm">Upload Document (PDF, DOCX, TXT)</div>
                            <div className="border border-dashed rounded-md p-8 text-center flex flex-col items-center justify-center">
                                <Input
                                    type="file"
                                    id="document-upload"
                                    onChange={handleFileChange}
                                    accept=".pdf,.docx,.txt"
                                    className="hidden"
                                />
                                <label
                                    htmlFor="document-upload"
                                    className="cursor-pointer flex flex-col items-center justify-center gap-2"
                                >
                                    <Upload className="h-8 w-8 text-muted-foreground" />
                                    <div className="font-medium">Click to upload</div>
                                    <div className="text-xs text-muted-foreground">
                                        or drag and drop
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                        PDF, DOCX, TXT (MAX. 20MB)
                                    </div>
                                </label>
                                {file && (
                                    <div className="mt-4 text-sm">
                                        Selected file: {file.name}
                                    </div>
                                )}
                            </div>
                            <Button
                                onClick={handleProcessContent}
                                disabled={!file || isProcessing}
                                className="w-full"
                            >
                                {isProcessing ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Processing...
                                    </>
                                ) : (
                                    'Extract Topics'
                                )}
                            </Button>
                        </TabsContent>

                        <TabsContent value="youtube" className="space-y-4">
                            <div className="text-sm">Enter YouTube URL</div>
                            <Input
                                type="url"
                                value={url}
                                onChange={handleUrlChange}
                                placeholder="Enter YouTube URL (e.g. https://www.youtube.com/watch?v=...)"
                                className="w-full"
                            />
                            <Button
                                onClick={handleProcessContent}
                                disabled={!url || isProcessing}
                                className="w-full"
                            >
                                {isProcessing ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Processing...
                                    </>
                                ) : (
                                    'Extract Topics'
                                )}
                            </Button>
                            <p className="text-xs text-muted-foreground">
                                Note: Processing YouTube videos may take several minutes.
                            </p>
                        </TabsContent>

                        <TabsContent value="podcast" className="space-y-4">
                            <div className="text-sm">Enter Podcast URL</div>
                            <Input
                                type="url"
                                value={url}
                                onChange={handleUrlChange}
                                placeholder="Enter podcast URL (direct link to audio file)"
                                className="w-full"
                            />
                            <Button
                                onClick={handleProcessContent}
                                disabled={!url || isProcessing}
                                className="w-full"
                            >
                                {isProcessing ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Processing...
                                    </>
                                ) : (
                                    'Extract Topics'
                                )}
                            </Button>
                            <p className="text-xs text-muted-foreground">
                                Note: Processing podcasts may take several minutes.
                            </p>
                        </TabsContent>

                        <TabsContent value="link" className="space-y-4">
                            <div className="text-sm">Enter Web URL</div>
                            <Input
                                type="url"
                                value={url}
                                onChange={handleUrlChange}
                                placeholder="Enter web URL (e.g. https://example.com/article)"
                                className="w-full"
                            />
                            <Button
                                onClick={handleProcessContent}
                                disabled={!url || isProcessing}
                                className="w-full"
                            >
                                {isProcessing ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Processing...
                                    </>
                                ) : (
                                    'Extract Topics'
                                )}
                            </Button>
                        </TabsContent>
                    </Tabs>
                )}

                {error && (
                    <div className="mt-4 p-3 bg-red-50 text-red-600 rounded-md text-sm">
                        <p className="font-medium mb-1">Error</p>
                        <p>{error}</p>
                        <p className="mt-2 text-xs">Please try again with different content or check your connection.</p>
                    </div>
                )}

                {expanded && (
                    <div className="flex flex-col items-center mt-4">
                        <Button
                            variant="link"
                            className="text-xs flex items-center"
                            onClick={handleLoadSampleTopics}
                        >
                            <span>Load Demo Topics</span>
                            <span className="ml-1 text-xs text-muted-foreground">(for testing only)</span>
                        </Button>
                        <p className="text-xs text-muted-foreground mt-1">No API calls will be made when using demo topics</p>
                    </div>
                )}
            </div>

            {/* Topics Section */}
            {extractedTopics.length > 0 && (
                <div className="mt-4 p-4 border-t">
                    <h3 className="text-lg font-semibold mb-4">Choose a Topic for Debate</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {extractedTopics.map((topic, index) => {
                            // Ensure topic has arguments array
                            const topicArgs = Array.isArray(topic.arguments) ? topic.arguments : [];

                            return (
                                <div
                                    key={index}
                                    className={`p-4 border rounded-lg cursor-pointer transition-all ${selectedTopic === index
                                        ? 'border-primary bg-primary/5 shadow-sm'
                                        : 'hover:border-primary/50'
                                        }`}
                                    onClick={() => handleSelectTopic(index)}
                                >
                                    <div className="flex justify-between items-start">
                                        <h4 className="font-semibold">{topic.title || 'Untitled Topic'}</h4>
                                        {selectedTopic === index && (
                                            <Check className="h-4 w-4 text-primary" />
                                        )}
                                    </div>
                                    <p className="text-sm text-muted-foreground mt-1 mb-2">
                                        {topicArgs.length} key arguments •
                                        {Math.round((topic.confidence || 0) * 100)}% confidence
                                    </p>
                                    <div className="flex flex-wrap gap-2 mb-3">
                                        {topicArgs.slice(0, 3).map((arg, i) => (
                                            <span
                                                key={i}
                                                className="px-2 py-1 bg-secondary rounded-full text-xs"
                                            >
                                                {arg.claim || 'Unnamed claim'}
                                            </span>
                                        ))}
                                    </div>
                                    {selectedTopic === index && topicArgs.length > 0 && (
                                        <div className="mt-3 pt-3 border-t">
                                            <h5 className="font-medium text-sm mb-1">Sample Evidence:</h5>
                                            <p className="text-xs text-muted-foreground">
                                                {topicArgs[0].evidence || 'No evidence provided'}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                    <div className="mt-6 flex justify-end">
                        <Button
                            onClick={handleStartDebate}
                            disabled={selectedTopic === null}
                            className="px-8"
                        >
                            Use Selected Topic
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
} 