"use client";

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useDebateStore } from '@/lib/store';
import { assignVoiceToExpert } from '@/lib/elevenlabs';
import { Message } from '@/types/message';
import { Expert } from '@/types/expert';
import { MessageBubble } from './MessageBubble';
import { ExpertCard } from './ExpertCard';
import { UserInput } from './UserInput';
import { DebateSummary } from './DebateSummary';
import { Loader2, ChevronDown, ChevronUp, Upload, XCircle, BookOpen, BrainCircuit, ArrowLeft, Youtube, Mic } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { v4 as uuidv4 } from 'uuid';
import { cn } from '@/lib/utils';
import { useErrorHandler } from '@/lib/hooks/useErrorHandler';
import { useToast } from '@/lib/hooks/useToast';
import { createError } from '@/lib/errors/types';
import { get, post, initRequestManager, API_CONFIG } from '@/lib/api/requestManager';
import { generateExpertResponses, ExpertResponses } from '@/lib/responseGenerator';
import { MVP_CONFIG } from '@/lib/config';
import { ContentUploader } from '@/components/content-processing/ContentUploader';

// Flag to completely disable API testing in MVP mode - ALWAYS TRUE FOR MVP
const DISABLE_API_TESTING = true;

// Flag to disable debug logs in MVP mode - ALWAYS TRUE FOR MVP
const DISABLE_DEBUG_LOGS = true;

// Add a flag to indicate if the backend API server is running
const API_SERVER_AVAILABLE = true; // Change this to true to enable real API calls

// Conditionally log based on debug setting
const debugLog = (...args: any[]) => {
    // Only log if debug mode is enabled in the API config
    if (API_CONFIG?.debug) {
        console.log('[DEBATE]', ...args);
    }
};

// Initialize the request manager with our settings - cast to any to avoid typing issues
initRequestManager({
    baseUrl: MVP_CONFIG.apiUrl,
    debug: !MVP_CONFIG.disableDebugLogs,
    throttleWindow: 5000 // 5 seconds throttling window
} as any);

// Global request tracker 
// This persists across component re-renders but will be reset on full page reload
const requestTracker = {
    recentRequests: new Map<string, number>(),
    cleanupInterval: null as NodeJS.Timeout | null,

    // Start periodic cleanup to prevent memory leaks
    startCleanup() {
        if (!this.cleanupInterval) {
            this.cleanupInterval = setInterval(() => {
                const now = Date.now();
                for (const [key, timestamp] of this.recentRequests.entries()) {
                    // Remove entries older than 30 seconds in MVP mode
                    if (now - timestamp > MVP_CONFIG.throttleWindow) {
                        this.recentRequests.delete(key);
                    }
                }
            }, 10000);
        }
    },

    // Stop cleanup when no longer needed
    stopCleanup() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
    }
};

// Ensure cleanup starts
requestTracker.startCleanup();

// Loading state types
type LoadingState = {
    state: 'idle' | 'loading' | 'success' | 'error';
    message?: string;
};

type StepState = {
    expertSelection: LoadingState;
    topicInitialization: LoadingState;
    expertLoading: LoadingState;
    responseGeneration: LoadingState;
    voiceSynthesis: LoadingState;
};

// Debug helper for test-driven approach
const debugTest = {
    testExpertLoading: (experts: Expert[], loading: boolean, selected: boolean) => {
        console.log('TEST: Expert Loading');
        console.log('- Experts array:', experts);
        console.log('- Loading state:', loading);
        console.log('- Selected state:', selected);
        console.log('- Test result:', experts.length > 0 ? 'PASS ✅' : 'FAIL ❌');
        return experts.length > 0;
    },
    testMockExpertFallback: (apiError: boolean, mockExperts: Expert[]) => {
        console.log('TEST: Mock Expert Fallback');
        console.log('- API Error occurred:', apiError);
        console.log('- Mock experts available:', mockExperts.length > 0);
        console.log('- Test result:', apiError && mockExperts.length > 0 ? 'PASS ✅' : 'FAIL ❌');
        return apiError && mockExperts.length > 0;
    }
};

// Mock expert data to ensure we always have fallback
const mockExperts: Expert[] = [
    {
        id: 'exp_mock_1',
        name: 'AI Climate Science Expert',
        type: 'ai' as const,
        background: 'Specializes in environmental science with expertise in climate change research and sustainability initiatives.',
        expertise: ['Climate change', 'Biodiversity', 'Sustainability'],
        stance: 'pro' as const,
        perspective: 'I believe this is an important area that deserves our attention.',
        identifier: 'AI-CSE4321',
        voiceId: 'mock-voice-1'
    } as Expert,
    {
        id: 'exp_mock_2',
        name: 'AI Economics Expert',
        type: 'ai' as const,
        background: 'Specializes in economic policy analysis with a focus on resource allocation and market effects.',
        expertise: ['Economic policy', 'Resource allocation', 'Market analysis'],
        stance: 'con' as const,
        perspective: 'I think we need to carefully examine the assumptions being made in this discussion.',
        identifier: 'AI-ECO9876',
        voiceId: 'mock-voice-2'
    } as Expert,
    {
        id: 'exp_mock_3',
        name: 'Eleanor Roosevelt',
        type: 'historical' as const,
        background: 'Eleanor Roosevelt was an American political figure, diplomat, and activist who served as the First Lady of the United States from 1933 to 1945.',
        expertise: ['Human rights', 'Diplomacy', 'Social reform'],
        stance: 'pro' as const,
        perspective: 'I believe this is an important area that deserves our attention.',
        voiceId: 'mock-voice-3'
    } as Expert,
    {
        id: 'exp_mock_4',
        name: 'Winston Churchill',
        type: 'historical' as const,
        background: 'Sir Winston Churchill was a British statesman, soldier, and writer who served as Prime Minister of the United Kingdom from 1940 to 1945.',
        expertise: ['Leadership', 'Wartime strategy', 'International relations'],
        stance: 'con' as const,
        perspective: 'I think we need to carefully examine the assumptions being made in this discussion.',
        voiceId: 'mock-voice-4'
    } as Expert
];

// Test implementation of expert API for development mode
const testGenerateExperts = async (topic: string, expertType: string): Promise<Expert[]> => {
    console.log('TEST GENERATING EXPERTS for topic:', topic, 'type:', expertType);

    // Simulate API processing time
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Generate expert for the specific topic to simulate real API functionality
    const filteredMockExperts = mockExperts.filter((expert: Expert) => expert.type === expertType);

    // Customize experts to the topic
    const customizedExperts = filteredMockExperts.slice(0, 2).map(expert => {
        const topicName = typeof topic === 'string'
            ? (topic.startsWith('{') ? JSON.parse(topic).title : topic)
            : 'the topic';

        // Generate a unique ID
        const uniqueId = `exp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

        return {
            ...expert,
            id: uniqueId,
            // Customize perspective based on topic
            perspective: expert.stance === 'pro'
                ? `As someone who supports action on ${topicName}, I believe this is an important area that deserves our attention.`
                : `I have reservations about some aspects of ${topicName} and think we need to carefully examine the assumptions being made.`
        };
    });

    return customizedExperts;
};

export function DebatePanel({ existingDebate }: { existingDebate?: any }) {
    const {
        topic,
        experts,
        messages,
        isGenerating,
        useVoiceSynthesis,
        useCitations,
        expertType,
        debateId,
        error: storeError,
        setTopic,
        setExperts,
        addMessage,
        setIsGenerating,
        setUseCitations,
        setExpertType,
        initializeDebate,
        setError,
        reset,
        setMessages
    } = useDebateStore();

    // Initialize error handling and toast hooks
    const { handleError, clearError, retry, canRetry } = useErrorHandler({
        maxRetries: 3,
        onError: (error) => {
            showError(error);
        },
    });
    // Extract toast functions only once
    const { showError, showSuccess, showWarning, showInfo } = useToast();

    const [showSummary, setShowSummary] = useState(false);
    const [userTopic, setUserTopic] = useState('');
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [loadingState, setLoadingState] = useState<string>('');
    const [expertsSelected, setExpertsSelected] = useState(false);
    const [showExpertSelection, setShowExpertSelection] = useState(false);
    const [expertsLoading, setExpertsLoading] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [selectedParticipantType, setSelectedParticipantType] = useState<'historical' | 'ai' | null>(null);
    const [extractedTopics, setExtractedTopics] = useState<Array<{
        title: string;
        confidence: number;
        arguments: string[];
    }>>([]);
    const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
    const [isContentAnalyzerOpen, setIsContentAnalyzerOpen] = useState(true);
    const [steps, setSteps] = useState<StepState>({
        expertSelection: { state: 'idle' },
        topicInitialization: { state: 'idle' },
        expertLoading: { state: 'idle' },
        responseGeneration: { state: 'idle' },
        voiceSynthesis: { state: 'idle' }
    });

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Function to get topicTitle regardless of which state it's in
    const getTopicTitle = useCallback((): string => {
        if (typeof topic === 'string') {
            if (topic.startsWith('{') && topic.includes('title')) {
                try {
                    return JSON.parse(topic).title;
                } catch (e) {
                    return topic;
                }
            }
            return topic;
        }
        return selectedTopic || '';
    }, [topic, selectedTopic]);

    // Request utility using the request manager
    const makeApiRequest = useCallback(async (
        endpoint: string,
        method: 'GET' | 'POST',
        data?: any,
        throttleKey?: string
    ) => {
        // If API server is not available, don't even try to make the request
        if (!MVP_CONFIG.apiServerAvailable) {
            console.log(`API server not available, skipping request to ${endpoint}`);
            // Return mock successful response
            return { success: true, mock: true, data: {} };
        }

        try {
            if (method === 'GET') {
                const response = await get(endpoint, data, {
                    throttleKey,
                    cache: true,
                    throttle: true
                });
                return response.data;
            } else {
                const response = await post(endpoint, data, {
                    throttleKey,
                    cache: true,
                    throttle: true
                });
                return response.data;
            }
        } catch (error) {
            console.error(`API request failed: ${error}`);
            throw error;
        }
    }, []);

    // Update step state helper
    const updateStepState = (
        step: keyof StepState,
        state: LoadingState['state'],
        message?: string
    ) => {
        setSteps(prev => ({
            ...prev,
            [step]: { state, message }
        }));
    };

    // Generate expert responses locally using OpenAI
    const generateLocalExpertResponses = useCallback(async (currentExperts: Expert[], currentMessages: Message[] = []): Promise<any[]> => {
        console.log('Generating local expert responses...');

        // Set loading state
        updateStepState('responseGeneration', 'loading', 'Generating expert responses...');

        try {
            // Format messages for API
            const lastUserMessage = currentMessages.length > 0
                ? currentMessages[currentMessages.length - 1].content
                : '';

            console.log(`Starting response generation for ${currentExperts.length} experts`);

            // Since we're in a client component, use the API route
            const responses = await Promise.all(currentExperts.map(async (expert, index) => {
                try {
                    // Extract topic title and arguments
                    let topicTitle = topic;
                    let topicArguments: any[] = [];

                    // Parse topic JSON if needed
                    if (topic && topic.startsWith('{') && topic.includes('title')) {
                        try {
                            const parsedTopic = JSON.parse(topic);
                            topicTitle = parsedTopic.title;

                            if (parsedTopic.data && parsedTopic.data.arguments) {
                                topicArguments = parsedTopic.data.arguments;
                            }
                        } catch (e) {
                            console.error('Failed to parse topic data:', e);
                        }
                    }

                    console.log(`Sending API request for expert: ${expert.name}`);

                    // Use Next.js API route to get the OpenAI response
                    const response = await fetch('/api/debate/response', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            expert,
                            messages: [
                                ...currentMessages,
                                ...(!currentMessages.length ? [{
                                    role: 'user',
                                    content: `The topic is: ${topicTitle}. Please provide your initial thoughts.`
                                }] : [])
                            ],
                            topic: topicTitle,
                            topicArguments
                        }),
                    });

                    if (!response.ok) {
                        const errorData = await response.json().catch(() => ({}));
                        console.error(`API error (${response.status}):`, errorData);
                        throw new Error(`API request failed with status ${response.status}: ${errorData.error || 'Unknown error'}`);
                    }

                    const data = await response.json();
                    console.log(`Response received for ${expert.name}:`, data);

                    if (!data.response && !data.content) {
                        console.warn(`No response content received for ${expert.name}`);
                        return {
                            response: `I apologize, but I couldn't generate a response as ${expert.name}. Please try again.`,
                            usage: {
                                tokens: 0,
                                promptTokens: 0,
                                completionTokens: 0,
                                cost: 0
                            },
                            expertName: expert.name,
                            expertId: expert.id
                        };
                    }

                    return {
                        response: data.response || data.content,
                        usage: data.usage || {
                            tokens: 0,
                            promptTokens: 0,
                            completionTokens: 0,
                            cost: 0
                        },
                        expertName: expert.name,
                        expertId: expert.id
                    };
                } catch (error) {
                    console.error(`Error generating response for ${expert.name}:`, error);
                    // Return a fallback response instead of throwing
                    return {
                        response: `I apologize, but there was an error generating my response as ${expert.name}. ${error.message || ''}`,
                        usage: {
                            tokens: 0,
                            promptTokens: 0,
                            completionTokens: 0,
                            cost: 0
                        },
                        expertName: expert.name,
                        expertId: expert.id
                    };
                }
            }));

            console.log('All responses generated:', responses);

            // Check if we received any valid responses
            if (responses.length === 0) {
                throw new Error('No responses were generated');
            }

            // Add responses to the message state
            responses.forEach(respData => {
                if (respData && respData.response) {
                    console.log(`Adding message from ${respData.expertName}: ${respData.response.substring(0, 50)}...`);

                    // Add message to the state
                    setMessages(prevMessages => [
                        ...prevMessages,
                        {
                            id: uuidv4(),
                            role: 'assistant',
                            content: respData.response,
                            speaker: respData.expertName,
                            speakerId: respData.expertId,
                            timestamp: new Date().toISOString()
                        }
                    ]);
                }
            });

            // Update state to show success
            updateStepState('responseGeneration', 'success', 'Expert responses generated!');
            setTimeout(() => updateStepState('responseGeneration', 'idle'), 2000);

            return responses;
        } catch (error) {
            console.error('Error in generateLocalExpertResponses:', error);
            updateStepState('responseGeneration', 'error', 'Failed to generate expert responses');
            throw error;
        }
    }, [topic, updateStepState, setMessages]);

    // Handle expert type selection
    const handleExpertTypeSelect = async (type: 'historical' | 'ai') => {
        try {
            updateStepState('expertSelection', 'loading', 'Preparing expert selection...');
            setExperts([]);
            setExpertType(type);
            setSelectedParticipantType(type);
            clearError();
            setIsLoading(false);
            updateStepState('expertSelection', 'success');
            showSuccess('Expert Type Selected', `${type} experts will be used for the debate`);
        } catch (error) {
            const appError = createError(
                'EXPERT_SELECTION_ERROR',
                'Failed to set expert type',
                'medium',
                true,
                { type }
            );
            handleError(appError);
            updateStepState('expertSelection', 'error', 'Failed to set expert type');
        }
    };

    // Handle topic selection from extracted topics
    const handleTopicSelect = (topicTitle: string, topicData?: any) => {
        console.log('Topic selected:', topicTitle, 'with data:', topicData);

        // Make sure the title is not empty
        if (!topicTitle || topicTitle.trim() === '') {
            console.warn('Empty topic title provided');
            showWarning('Invalid Topic', 'Please select a valid topic');
            return;
        }

        // Update the user topic state
        setUserTopic(topicTitle);

        // Update the selected topic state
        setSelectedTopic(topicTitle);

        // Store the complete topic data in the store, not just the title
        // This ensures arguments are available for expert generation
        if (topicData) {
            // Store as JSON string to preserve all data
            const topicWithData = JSON.stringify({
                title: topicTitle,
                data: topicData
            });
            console.log('Setting topic in store with data:', topicWithData);
            setTopic(topicWithData);
        } else {
            // Fallback to just the title if no data provided
            console.log('Setting topic in store with title only:', topicTitle);
            setTopic(topicTitle);
        }

        // Ensure participant type is set if not already selected
        // Default to 'ai' experts when selecting from Suggested Debate Topics
        if (!selectedParticipantType) {
            console.log('Setting default participant type to ai experts');
            setSelectedParticipantType('ai');
            setExpertType('ai');
        }

        // Always use real API to generate experts regardless of environment
        console.log('Will use API to generate real experts based on topic:', topicTitle);

        // Ensure expert selection is shown after topic is selected
        setShowExpertSelection(true);
        setExpertsLoading(false);

        // For debugging
        setTimeout(() => {
            console.log('After topic selection:');
            console.log('- Topic in store:', topic);
            console.log('- Selected Topic state:', selectedTopic);
            console.log('- User Topic state:', userTopic);
        }, 100);
    };

    // Initialize debate after topic selection
    const initializeDebateWithTopic = async () => {
        console.log('### DEBUG: initializeDebateWithTopic called ###');
        console.log('- Topic from store:', topic);
        console.log('- Selected Topic state:', selectedTopic);
        console.log('- User Topic state:', userTopic);
        console.log('- Participant Type:', selectedParticipantType);
        console.log('- Experts Length:', experts.length);
        console.log('- ExpertsLoading:', expertsLoading);
        console.log('- ExpertsSelected:', expertsSelected);

        // More robust check for topic with multiple fallbacks
        let currentTopic = topic || selectedTopic || userTopic || '';

        // Additional debug to identify the issue
        console.log('Current topic before check:', currentTopic, typeof currentTopic);

        // If the topic is a JSON string, parse it to get the title
        if (typeof currentTopic === 'string' && currentTopic.startsWith('{') && currentTopic.includes('title')) {
            try {
                const parsedTopic = JSON.parse(currentTopic);
                console.log('Parsed topic:', parsedTopic);
                // Make sure we have the title after parsing
                if (parsedTopic && parsedTopic.title) {
                    // Keep the JSON string as currentTopic but log the title
                    console.log('Using parsed title:', parsedTopic.title);
                }
            } catch (e) {
                console.warn('Failed to parse topic JSON:', e);
            }
        }

        if (!currentTopic || currentTopic.trim() === '') {
            console.warn('Cannot initialize debate: missing topic', {
                topic,
                selectedTopic,
                userTopic,
                currentTopic
            });
            showWarning('Missing Topic', 'Please enter a debate topic first');
            return;
        }

        // Ensure the topic is set in the store if needed
        if (!topic && currentTopic) {
            console.log('Setting topic in store:', currentTopic);
            setTopic(currentTopic);
        }

        // Set default participant type if not set
        if (!selectedParticipantType) {
            console.log('Setting default participant type to ai experts');
            setSelectedParticipantType('ai');
            setExpertType('ai');
        }

        console.log('Initializing debate with topic:', currentTopic, 'and participant type:', selectedParticipantType || 'ai');
        const newDebateId = uuidv4();
        updateStepState('topicInitialization', 'loading', 'Initializing debate...');

        try {
            // Initialize directly with the generated debateId
            initializeDebate(newDebateId, currentTopic);
            updateStepState('topicInitialization', 'success', 'Debate initialized!');
            showSuccess('Debate Initialized', 'Generating expert profiles...');

            // If no experts are loaded, force expert generation
            if (experts.length === 0) {
                console.log("No experts found, generating experts for topic:", currentTopic);
                setExpertsLoading(true);

                try {
                    // Call selectExperts to generate experts through the API
                    console.log("Calling selectExperts to generate experts via API");
                    const expertPromise = selectExperts();

                    // Add a timeout to prevent infinite loading
                    const timeoutPromise = new Promise((_, reject) => {
                        setTimeout(() => reject(new Error('Expert generation timed out')), 20000); // 20-second timeout
                    });

                    await Promise.race([expertPromise, timeoutPromise]);

                    // Double-check that experts were loaded after API call completed
                    if (experts.length === 0) {
                        console.log("API call completed but no experts were loaded");
                        // Show error since we don't want to use mock experts
                        showWarning('Expert Generation Failed', 'Please try again or try a different topic');
                    }
                } catch (expertError) {
                    console.error("Error generating experts:", expertError);
                    showWarning('Expert Generation Failed', 'Please try again with a different topic');
                } finally {
                    // Ensure loading state is always cleared
                    setExpertsLoading(false);
                }
            }

            updateStepState('expertLoading', 'success', 'Experts selected successfully!');

        } catch (error) {
            console.error('Error initializing debate:', error);
            // Always clear loading states
            setExpertsLoading(false);

            const appError = createError(
                'DEBATE_INITIALIZATION_ERROR',
                'Failed to initialize debate',
                'high',
                true,
                { topic: currentTopic, expertType: selectedParticipantType || 'ai' }
            );
            handleError(appError);
            updateStepState('topicInitialization', 'error', 'Failed to initialize debate');
        }
    };

    // Update selectExperts to always use the API regardless of environment
    const selectExperts = async () => {
        console.log('### DEBUG: selectExperts called ###');
        console.log('- Topic:', topic);
        console.log('- Selected Topic:', selectedTopic);
        console.log('- Expert Type:', expertType);
        console.log('- Experts Length:', experts.length);
        console.log('- ExpertsLoading:', expertsLoading);
        console.log('- ExpertsSelected:', expertsSelected);

        console.log('Starting selectExperts() function with topic:', topic, 'selectedTopic:', selectedTopic, 'expertType:', expertType);

        // Use either the topic from the store or the selectedTopic local state
        const currentTopic = topic || selectedTopic;

        if (!currentTopic) {
            console.warn('Missing topic, cannot select experts');
            showWarning('Missing Topic', 'Please enter a topic first');
            return;
        }

        // Parse topic data if it's stored as JSON
        let topicTitle = currentTopic;
        let topicArguments = [];

        try {
            // Check if the topic is stored as JSON with additional data
            if (currentTopic.startsWith('{') && currentTopic.includes('title')) {
                const parsedTopic = JSON.parse(currentTopic);
                topicTitle = parsedTopic.title;

                // Extract arguments if available
                if (parsedTopic.data && parsedTopic.data.arguments) {
                    topicArguments = parsedTopic.data.arguments;
                }

                console.log('Parsed topic data:', { topicTitle, topicArguments });
            }
        } catch (e) {
            console.warn('Failed to parse topic data, using as plain text:', e);
            // Continue with topic as plain text
        }

        updateStepState('expertLoading', 'loading', 'Generating expert profiles...');
        setIsLoading(true);
        setExpertsLoading(true);
        clearError();

        try {
            console.log('Generating expert profiles via API for topic:', topicTitle);

            // API endpoints to try in order of preference
            const apiEndpoints = [
                '/api/debate',
                '/api/debate/experts',
                '/api/experts',
                '/api/openai/generate-experts'
            ];

            // Function to check if an API endpoint is accessible
            const testApiEndpoint = async (endpoint: string): Promise<boolean> => {
                try {
                    console.log(`Testing API endpoint availability: ${endpoint}`);
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5-second timeout for test

                    const response = await fetch(`${endpoint}`, {
                        method: 'GET',
                        signal: controller.signal
                    });

                    clearTimeout(timeoutId);
                    console.log(`Endpoint ${endpoint} test result: ${response.status}`);
                    return response.ok;
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : String(error);
                    console.warn(`Endpoint ${endpoint} test failed:`, errorMessage);
                    return false;
                }
            };

            // Check if at least one API endpoint is available
            let apiAvailable = false;
            for (const endpoint of apiEndpoints) {
                apiAvailable = await testApiEndpoint(endpoint);
                if (apiAvailable) {
                    console.log(`Found available API endpoint: ${endpoint}`);
                    break;
                }
            }

            if (!apiAvailable && process.env.NODE_ENV === 'production') {
                console.error('No API endpoints are available');
                throw new Error('API services are currently unavailable. Please try again later.');
            }

            let apiSuccess = false;
            let selectedExperts = [];
            let lastError = null;

            // Try each endpoint until one succeeds, with timeout
            for (const endpoint of apiEndpoints) {
                if (apiSuccess) break;

                try {
                    console.log(`Attempting to select experts via ${endpoint}...`);

                    // Add timeout to prevent infinite waiting for response
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15-second timeout

                    // Get API key from environment
                    const apiKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY || '';

                    console.log(`Using API key: ${apiKey ? 'Available (starting with ' + apiKey.substring(0, 3) + '...)' : 'Not available'}`);

                    const requestBody = {
                        action: 'select-experts',
                        topic: topicTitle,
                        expertType: expertType || 'ai',
                        count: 2,
                        arguments: topicArguments
                    };

                    console.log(`Request body for ${endpoint}:`, JSON.stringify(requestBody));

                    const response = await fetch(`${endpoint}`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${apiKey}`
                        },
                        body: JSON.stringify(requestBody),
                        signal: controller.signal
                    });

                    clearTimeout(timeoutId);

                    console.log(`Response status from ${endpoint}: ${response.status}`);

                    if (response.ok) {
                        let rawText = '';
                        try {
                            rawText = await response.text();
                            console.log(`Raw response from ${endpoint}:`, rawText.substring(0, 200) + '...');
                            const data = JSON.parse(rawText);

                            console.log(`Parsed data from ${endpoint}:`, data);

                            if (data.experts && Array.isArray(data.experts) && data.experts.length > 0) {
                                console.log('Successfully selected experts from API:', data.experts);
                                selectedExperts = data.experts;
                                apiSuccess = true;
                                break;
                            } else {
                                console.warn('API returned valid response but no experts:', data);
                            }
                        } catch (parseError) {
                            console.error(`Error parsing API response from ${endpoint}:`, parseError);
                            console.error('Raw response that failed to parse:', rawText);
                            lastError = new Error(`Parse error: ${parseError.message}`);
                        }
                    } else {
                        console.warn(`API returned error status: ${response.status}`);
                        // Try to get error details
                        try {
                            const errorText = await response.text();
                            console.warn(`API error details from ${endpoint}:`, errorText);
                            lastError = new Error(`HTTP ${response.status}: ${errorText}`);
                        } catch (err) {
                            console.warn('Could not read error response');
                            lastError = new Error(`HTTP ${response.status}`);
                        }
                    }
                } catch (endpointError) {
                    console.error(`Error with endpoint ${endpoint}:`, endpointError);
                    lastError = endpointError;
                    // Continue to next endpoint
                }
            }

            if (apiSuccess && selectedExperts.length > 0) {
                // Use the experts from the API
                if (apiSuccess && selectedExperts.length > 0) {
                    // Use the experts from the API
                    setExperts(selectedExperts);
                    setExpertsSelected(true);
                    updateStepState('expertLoading', 'success', 'Experts selected successfully!');
                    showSuccess('Experts Generated', 'Debate experts have been selected based on your topic');

                    // Clear loading states
                    setExpertsLoading(false);
                    setIsLoading(false);
                    return;
                } else {
                    // If all API endpoints fail in production, show a clear error
                    // and reset loading states to prevent stuck UI
                    console.warn('All API endpoints failed to generate experts');
                    setExpertsLoading(false);
                    setIsLoading(false);

                    // Create proper error object
                    const apiError = createError(
                        'API_ERROR',
                        'Unable to generate experts for this topic. Please try again or try a different topic.',
                        'medium',
                        true,
                        { topic: topicTitle }
                    );
                    showError(apiError);

                    updateStepState('expertLoading', 'error', 'Failed to generate experts');

                    // In production, we should NOT fall back to mock experts
                    // but rather show a clear error state to the user
                    throw new Error('Could not generate experts from API');
                }
            } else {
                // DEVELOPMENT MODE: Use our test implementation for better testing
                console.log('DEVELOPMENT MODE: Using test API implementation');

                try {
                    // Use our test implementation which simulates API behavior but works locally
                    const currentExpertType = expertType || 'ai';

                    // This function simulates the API with topic-specific experts
                    const selectedExperts = await testGenerateExperts(currentTopic, currentExpertType);

                    console.log('Generated test experts:', selectedExperts);
                    setExperts(selectedExperts);
                    setExpertsSelected(true);
                    updateStepState('expertLoading', 'success', 'Experts selected successfully!');
                    showInfo('Using Test API', 'Generated test experts based on your topic (development mode)');

                    // Clear loading states
                    setExpertsLoading(false);
                    setIsLoading(false);
                    return;
                } catch (testError) {
                    console.error('Test API error:', testError);

                    // Fallback to static mock experts
                    console.log('Test API failed, falling back to static mock experts');
                    const currentExpertType = expertType || 'ai';
                    const filteredMockExperts = mockExperts.filter((expert: Expert) => expert.type === currentExpertType);
                    const selectedMockExperts = filteredMockExperts.slice(0, 2);

                    setExperts(selectedMockExperts);
                    setExpertsSelected(true);
                    updateStepState('expertLoading', 'success', 'Experts selected successfully!');
                    showInfo('Using Sample Experts', 'Static mock experts are being displayed (fallback)');

                    // Clear loading states
                    setExpertsLoading(false);
                    setIsLoading(false);
                    return;
                }
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.warn(`Expert selection failed: ${errorMessage}.`);

            // Only use mock expert data as fallback in development mode
            if (process.env.NODE_ENV !== 'production') {
                // Development mode fallback
                console.log('DEVELOPMENT MODE: Using mock experts as fallback');
                const filteredMockExperts = mockExperts.filter((expert: Expert) => expert.type === (expertType || 'ai'));
                const selectedMockExperts = filteredMockExperts.slice(0, 2);
                console.log('Using mock experts as fallback:', selectedMockExperts);
                setExperts(selectedMockExperts);
                setExpertsSelected(true);
                updateStepState('expertLoading', 'success', 'Experts selected successfully!');
                showInfo('Using Sample Experts', 'Mock experts are being used in development mode');
            } else {
                // Production mode - show clear error
                console.error('PRODUCTION MODE: Expert generation failed with no fallback');
                showError(createError(
                    'EXPERT_GENERATION_ERROR',
                    'Failed to generate experts. Our systems encountered an issue processing your topic. Please try again later or try a different topic.',
                    'high',
                    true,
                    { error: errorMessage }
                ));
                updateStepState('expertLoading', 'error', 'Failed to generate experts');
            }

            // Clear loading states
            setExpertsLoading(false);
            setIsLoading(false);
        }
    };

    // New helper function for voice assignment
    const assignVoicesToExperts = async (selectedExperts: Expert[]) => {
        updateStepState('voiceSynthesis', 'loading', 'Assigning voices to experts...');
        try {
            // Skip API calls if server is unavailable
            if (!MVP_CONFIG.apiServerAvailable) {
                console.log('API server unavailable, assigning mock voice IDs');
                // Assign mock voice IDs locally
                const expertsWithVoices = selectedExperts.map((expert, index) => {
                    return {
                        ...expert,
                        voiceId: `mock-voice-${index + 1}`
                    };
                });
                setExperts(expertsWithVoices);
                updateStepState('voiceSynthesis', 'success', 'Mock voices assigned!');
                showSuccess('Mock Voices', 'Voice synthesis is simulated (API unavailable)');
                return;
            }

            const expertsWithVoices = await Promise.all(
                selectedExperts.map(async (expert) => {
                    const voiceResponse = await fetch('/api/voice', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            action: 'assign-voice',
                            expertName: expert.name,
                            expertType: expert.type
                        })
                    });

                    if (!voiceResponse.ok) {
                        throw new Error(`Failed to assign voice for ${expert.name}`);
                    }

                    const voiceData = await voiceResponse.json();
                    return { ...expert, voiceId: voiceData.voiceId };
                })
            );

            setExperts(expertsWithVoices);
            updateStepState('voiceSynthesis', 'success', 'Voices assigned successfully!');
            showSuccess('Voices Assigned', 'Voice synthesis is ready');
        } catch (error) {
            const appError = createError(
                'VOICE_SYNTHESIS_ERROR',
                'Failed to assign voices to experts',
                'medium',
                true
            );
            handleError(appError);
            updateStepState('voiceSynthesis', 'error', 'Failed to assign voices');
        }
    };

    // Add back the handleVoiceSynthesis function
    const handleVoiceSynthesis = async (responses: any[], currentExperts: Expert[]) => {
        // Skip API calls if server is unavailable
        if (!MVP_CONFIG.apiServerAvailable) {
            console.log('API server unavailable, skipping voice synthesis');
            return;
        }

        // For each response, synthesize voice if the expert has a voiceId
        for (const response of responses) {
            try {
                // Extract the expert name and response text
                const expertName = response.expertName || response.speaker;
                const responseText = response.response || response.content;

                // Find the corresponding expert
                const expert = currentExperts.find(e => e.name === expertName);

                if (!expert?.voiceId) {
                    showWarning('Voice Synthesis', `No voice ID found for ${expertName}`);
                    continue;
                }

                const audioResponse = await fetch('/api/voice', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'synthesize',
                        text: responseText,
                        voiceId: expert.voiceId
                    })
                });

                if (!audioResponse.ok) {
                    throw new Error('Failed to synthesize voice');
                }

                const audioBlob = await audioResponse.blob();
                const audio = new Audio(URL.createObjectURL(audioBlob));
                await new Promise(resolve => {
                    audio.onended = resolve;
                    audio.play();
                });
            } catch (error) {
                const speaker = response.expertName || response.speaker || 'Unknown';
                const appError = createError(
                    'VOICE_SYNTHESIS_ERROR',
                    `Failed to synthesize voice for ${speaker}`,
                    'low',
                    true,
                    { speaker }
                );
                handleError(appError);
            }
        }
    };

    // Handle starting the discussion
    const startDiscussion = async () => {
        if (!experts.length || isGenerating) return;

        setIsGenerating(true);
        updateStepState('responseGeneration', 'loading', 'Generating initial responses...');

        console.log('Starting discussion with experts:', experts);

        try {
            // Get the current topic
            const currentTopic = topic || selectedTopic || 'General debate';
            console.log('Using topic for debate:', currentTopic);

            // Create a direct fetch request to the API
            const responses = await Promise.all(experts.map(async (expert) => {
                console.log(`Generating response for ${expert.name}`);

                const response = await fetch('/api/debate/response', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        expert,
                        messages: [{
                            role: 'user',
                            content: `The topic is: ${currentTopic}. Please provide your initial thoughts.`
                        }],
                        topic: currentTopic
                    }),
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    console.error(`API error for ${expert.name}:`, response.status, errorText);
                    throw new Error(`API request failed: ${response.status}`);
                }

                const data = await response.json();
                console.log(`Response for ${expert.name}:`, data);

                return {
                    expertName: expert.name,
                    expertId: expert.id,
                    response: data.response || "No response received"
                };
            }));

            // Now add the responses to the message list
            responses.forEach(resp => {
                const newMessage = {
                    id: uuidv4(),
                    timestamp: new Date().toISOString(),
                    role: 'assistant' as const,
                    content: resp.response,
                    speaker: resp.expertName,
                    speakerId: resp.expertId
                };

                console.log('Adding message to state:', newMessage);

                // Add to messages state
                setMessages(prev => [...prev, newMessage]);
            });

            updateStepState('responseGeneration', 'success', 'Discussion started!');

        } catch (error: any) {
            console.error('Error starting discussion:', error);
            setErrorMessage(`Failed to start the discussion: ${error?.message || 'Unknown error'}`);
            updateStepState('responseGeneration', 'error', 'Failed to start the discussion');
        } finally {
            setIsGenerating(false);
        }
    };

    // Handle user input
    const handleUserInput = async (text: string) => {
        if (text.trim() && !isGenerating && experts.length > 0) {
            // Create user message
            const userMessage: Message = {
                id: `msg_user_${Date.now()}`,
                role: 'user',
                content: text,
                speaker: 'You'
            };

            // Add user message to the messages array
            addMessage(userMessage);
            setIsGenerating(true);
            updateStepState('responseGeneration', 'loading', 'Generating responses...');

            try {
                // Use our local function to generate expert responses
                await generateLocalExpertResponses(experts, [...messages, userMessage]);

                updateStepState('responseGeneration', 'success', 'Responses generated!');
                setTimeout(() => updateStepState('responseGeneration', 'idle'), 2000);
            } catch (error) {
                console.error('Error generating responses:', error);
                setErrorMessage('Failed to generate responses');
                updateStepState('responseGeneration', 'error', 'Failed to generate responses');
            } finally {
                setIsGenerating(false);
            }
        }
    };

    // Update error message when store error changes
    useEffect(() => {
        if (storeError) {
            setErrorMessage(storeError);
            setError(null); // Clear store error after displaying
        }
    }, [storeError, setError]);

    // Scroll to bottom when messages change
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Debug test effect to monitor experts state
    useEffect(() => {
        console.log('Expert state change detected');
        debugTest.testExpertLoading(experts, expertsLoading, expertsSelected);
    }, [experts, expertsLoading, expertsSelected]);

    // Handle file upload
    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        event.preventDefault();

        // Clear previous loading state
        setLoadingState('');

        const file = event.target.files?.[0];
        if (!file) {
            console.warn("No file selected");
            showWarning('No File Selected', 'Please select a valid document file');
            return;
        }

        // Generate a throttle key using the file name and size
        const throttleKey = `document-analyze-${file.name}-${file.size}`;
        const now = Date.now();
        const lastRequestTime = requestTracker.recentRequests.get(throttleKey);

        // Check if this exact file was recently uploaded (global check, not per endpoint)
        if (lastRequestTime && (now - lastRequestTime < 5000)) {
            console.info(`Recent duplicate file detected: ${file.name}`);

            // Update UI to show warning about duplicate
            const fileDisplay = document.getElementById('selected-file-display');
            if (fileDisplay) {
                fileDisplay.textContent = `Recently processed: ${file.name} - using cached results`;
                fileDisplay.classList.remove('text-gray-400', 'text-red-400');
                fileDisplay.classList.add('text-yellow-400');
            }

            showInfo('File Already Processed', 'This file was recently analyzed. Using cached results.');

            // If we already have extracted topics from a previous run, keep using them
            // Otherwise we'll continue to try processing the file
            if (extractedTopics && extractedTopics.length > 0) {
                return;
            }
        }

        // Check file size (max 20MB)
        const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB in bytes
        if (file.size > MAX_FILE_SIZE) {
            console.warn("File too large:", file.size);
            showWarning('File Too Large', 'Please select a file smaller than 20MB');
            return;
        }

        console.log("File upload started:", file.name, file.size);
        setLoadingState(`Analyzing document: ${file.name}...`);

        // Display the selected file name to give user feedback
        if (event.target.nextElementSibling && event.target.nextElementSibling instanceof HTMLElement) {
            event.target.nextElementSibling.textContent = `Selected: ${file.name}`;
        }

        // API endpoints to try in order of preference
        const apiEndpoints = [
            `${API_CONFIG?.baseUrl || 'http://localhost:3030'}/api/content/document`,
            `${API_CONFIG?.baseUrl || 'http://localhost:3030'}/api/content/analyze`,
            `${API_CONFIG?.baseUrl || 'http://localhost:3030'}/api/analyze`
        ];

        // Immediately prepare mock topics in case all endpoints fail
        const mockTopics = [
            {
                title: `Climate Change (Mock Data for "${file.name}")`,
                confidence: 0.95,
                arguments: [
                    "Climate change mitigation requires immediate global action",
                    "Renewable energy adoption must accelerate to reduce carbon emissions",
                    "Carbon pricing is an effective economic tool for climate action"
                ]
            },
            {
                title: "AI Regulation (Mock Data)",
                confidence: 0.88,
                arguments: [
                    "AI development should be subject to international oversight",
                    "Self-regulation by tech companies is insufficient for AI safety",
                    "Privacy concerns in AI systems need stronger legal protections"
                ]
            }
        ];

        try {
            let success = false;
            let responseData = null;
            const formData = new FormData();
            formData.append('file', file);

            // Skip API calls completely if we know the server is unavailable
            if (!MVP_CONFIG.apiServerAvailable || MVP_CONFIG.disableApiTesting || process.env.NEXT_PUBLIC_MOCK_API === 'true') {
                console.log("API server unavailable or testing disabled. Using mock data directly.");
                success = false; // Skip to fallback
            } else {
                // Try each endpoint until one succeeds
                try {
                    for (const endpoint of apiEndpoints) {
                        try {
                            console.log(`Attempting to analyze document via ${endpoint}...`);

                            // For FormData uploads, we need to use the fetch API directly
                            // but still apply our throttling logic

                            // Check if this specific endpoint was recently called with this file 
                            // (endpoint-specific check, in addition to the global check)
                            const endpointThrottleKey = `${endpoint}-${throttleKey}`;
                            const lastEndpointRequestTime = requestTracker.recentRequests.get(endpointThrottleKey);

                            if (lastEndpointRequestTime && (now - lastEndpointRequestTime < 3000)) {
                                console.log(`Endpoint throttled for this file: ${endpointThrottleKey}`);
                                // Skip this endpoint and continue to the next one
                                continue;
                            }

                            // Record this endpoint request
                            requestTracker.recentRequests.set(endpointThrottleKey, now);
                            console.log("Sending fetch request to:", endpoint);

                            let response;
                            try {
                                response = await fetch(endpoint, {
                                    method: 'POST',
                                    body: formData,
                                    cache: 'no-store'
                                });

                                console.log(`Response from ${endpoint}:`, response.status);
                            } catch (networkError) {
                                console.error(`Network error connecting to ${endpoint}:`, networkError);
                                // Continue to the next endpoint or fall back to mock data
                                continue;
                            }

                            if (response.ok) {
                                try {
                                    responseData = await response.json();
                                    console.log(`Document analysis on ${endpoint} succeeded:`, responseData);

                                    // Check if the response has the expected topics structure
                                    if (responseData && Array.isArray(responseData.topics) && responseData.topics.length > 0) {
                                        success = true;
                                        break;
                                    } else if (responseData && responseData.status === "success") {
                                        // Endpoint exists but doesn't have proper implementation
                                        console.info(`Endpoint ${endpoint} returns success but no topics - this is expected in development`);

                                        // Add mock topics to the response to simulate a successful analysis
                                        responseData.topics = mockTopics;
                                        success = true;

                                        // Update UI to show mock data is being used
                                        const fileDisplay = document.getElementById('selected-file-display');
                                        if (fileDisplay) {
                                            fileDisplay.textContent = `${file.name} processed with sample topics`;
                                            fileDisplay.classList.remove('text-gray-400', 'text-red-400');
                                            fileDisplay.classList.add('text-yellow-400');
                                        }

                                        showInfo('Development Mode', 'Using sample topics since server API is simplified');
                                        break; // Use this endpoint's response with our mock data
                                    }
                                } catch (parseError) {
                                    console.error(`Error parsing JSON from ${endpoint}:`, parseError);
                                    continue;
                                }
                            } else {
                                const errorText = await response.text();
                                console.warn(`Document analysis on ${endpoint} failed:`, response.status, errorText);
                            }
                        } catch (endpointError) {
                            console.error(`Error analyzing document on ${endpoint}:`, endpointError);
                            // Continue to try next endpoint
                        }
                    }
                } catch (outerError) {
                    console.error("Fatal error in API connection attempt:", outerError);
                    // Let this fall through to the mock data fallback
                    success = false;
                }
            }

            if (!success || !responseData || !responseData.topics) {
                // Use info level logging instead of error since we're gracefully handling this
                console.info("Using fallback topics - API endpoints didn't return usable data");

                // Always use mock data when server endpoints fail
                console.log("Using mock topics data as fallback");
                setExtractedTopics(mockTopics);
                setLoadingState('');

                // Update UI to show success with mock data
                const fileDisplay = document.getElementById('selected-file-display');
                if (fileDisplay) {
                    fileDisplay.textContent = `Using sample topics for: ${file.name}`;
                    fileDisplay.classList.remove('text-gray-400', 'text-red-400');
                    fileDisplay.classList.add('text-yellow-400');
                }

                showSuccess('Document Analysis', 'Using sample topics since server analysis is unavailable');
                return;
            }

            // Ensure topics data is valid and formatted correctly
            if (responseData.topics && Array.isArray(responseData.topics)) {
                setExtractedTopics(responseData.topics);

                // Update UI to show success
                const fileDisplay = document.getElementById('selected-file-display');
                if (fileDisplay) {
                    fileDisplay.textContent = `Successfully analyzed: ${file.name}`;
                    fileDisplay.classList.remove('text-gray-400');
                    fileDisplay.classList.add('text-green-400');
                }
            } else {
                console.warn("Document analysis returned invalid topics data structure:", responseData);
                setExtractedTopics([]);

                // Update UI to show failure
                const fileDisplay = document.getElementById('selected-file-display');
                if (fileDisplay) {
                    fileDisplay.textContent = `Analysis failed: ${file.name}`;
                    fileDisplay.classList.remove('text-green-400');
                    fileDisplay.classList.add('text-red-400');
                }

                throw new Error('Document analysis returned an invalid data structure');
            }
            setLoadingState('');
            showSuccess('Document Analysis', 'Document analyzed successfully');
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            const appError = createError(
                'API_ERROR',
                `Failed to analyze document: ${errorMessage}`,
                'medium',
                true,
                { fileName: file.name }
            );
            handleError(appError);
            setLoadingState('');
            // Reset the extractedTopics to an empty array to avoid undefined errors
            setExtractedTopics([]);

            // Update UI to show error
            const fileDisplay = document.getElementById('selected-file-display');
            if (fileDisplay) {
                fileDisplay.textContent = `Error processing file: ${file.name}`;
                fileDisplay.classList.remove('text-green-400', 'text-gray-400');
                fileDisplay.classList.add('text-red-400');
            }

            // Create an additional error specifically for the toast
            const docAnalysisError = createError(
                'API_ERROR',
                'Failed to analyze document',
                'medium',
                true
            );
            showError(docAnalysisError);
        } finally {
            // Clear the file input value
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    // Trigger file input click
    const triggerFileUpload = () => {
        console.log("Upload button clicked, triggering file input");

        // Reset any previous file selection display
        const fileDisplay = document.getElementById('selected-file-display');
        if (fileDisplay) {
            fileDisplay.textContent = 'No file selected';
            fileDisplay.classList.remove('text-green-400');
            fileDisplay.classList.add('text-gray-400');
        }

        // Reset the file input value to allow selecting the same file again
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }

        fileInputRef.current?.click();
    };

    // Function to load mock topics for testing
    const loadMockTopics = () => {
        console.log("Loading mock topics for testing");

        const mockTopics = [
            {
                title: "Climate Change (Mock Data)",
                confidence: 0.95,
                arguments: [
                    "Climate change mitigation requires immediate global action",
                    "Renewable energy adoption must accelerate to reduce carbon emissions",
                    "Carbon pricing is an effective economic tool for climate action",
                    "Individual actions are important but insufficient without systemic change",
                    "Climate justice must be central to any comprehensive solution"
                ]
            },
            {
                title: "AI Regulation (Mock Data)",
                confidence: 0.88,
                arguments: [
                    "AI development should be subject to international oversight",
                    "Self-regulation by tech companies is insufficient for AI safety",
                    "Privacy concerns in AI systems need stronger legal protections",
                    "Algorithmic bias can perpetuate and amplify social inequalities",
                    "Transparency in AI decision-making systems should be mandatory"
                ]
            },
            {
                title: "Universal Basic Income (Mock Data)",
                confidence: 0.82,
                arguments: [
                    "UBI could provide economic security in an increasingly automated economy",
                    "Implementation costs may be offset by reduced bureaucracy and welfare administration",
                    "Freedom from economic necessities could foster creativity and entrepreneurship",
                    "Concerns about inflation and reduced work incentives need careful consideration",
                    "Pilot programs show mixed but promising results on individual well-being"
                ]
            }
        ];

        setExtractedTopics(mockTopics);

        // Update UI status
        const fileDisplay = document.getElementById('selected-file-display');
        if (fileDisplay) {
            fileDisplay.textContent = 'Using mock topics for testing';
            fileDisplay.classList.remove('text-gray-400', 'text-red-400');
            fileDisplay.classList.add('text-green-400');
        }

        showSuccess('Mock Data', 'Loaded sample topics for testing');
    };

    // Toggle content analyzer
    const toggleContentAnalyzer = () => {
        setIsContentAnalyzerOpen(!isContentAnalyzerOpen);
    };

    // Function to handle ending the debate and showing summary
    const handleEndDebate = () => {
        setShowSummary(true);
        // Scroll to the top to show the summary
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    // Function to handle starting a new debate
    const handleStartNewDebate = () => {
        // Reset all state
        reset();
        setShowSummary(false);
        setUserTopic('');
        setErrorMessage(null);
        setLoadingState('');
        setExpertsSelected(false);
        setShowExpertSelection(false);
        setExpertsLoading(false);
        setIsLoading(false);
        setSelectedParticipantType(null);
        setExtractedTopics([]);
        setIsContentAnalyzerOpen(false);

        // Reset steps state
        Object.keys(steps).forEach(key => {
            updateStepState(key as keyof typeof steps, 'idle', '');
        });

        // Scroll to the top
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    // Add a debug state to show API status
    const [debugInfo, setDebugInfo] = useState({
        usingRealApi: false,
        apiKeyFormat: '',
        environment: ''
    });

    // Check API status on component mount
    useEffect(() => {
        const checkApiStatus = async () => {
            try {
                const response = await fetch('/api/test-openai-real');
                const data = await response.json();
                setDebugInfo({
                    usingRealApi: data.success,
                    apiKeyFormat: data.apiKeyFormat || 'Unknown',
                    environment: data.environment?.NODE_ENV || 'Unknown'
                });
                console.log('API Status:', data);
            } catch (error) {
                console.error('Error checking API status:', error);
            }
        };

        // Only in development or if debug mode is enabled
        if (process.env.NODE_ENV === 'development' || process.env.NEXT_PUBLIC_DEBUG_MODE === 'true') {
            checkApiStatus();
        }
    }, []);

    // Add effect to load existing debate data if provided
    useEffect(() => {
        if (existingDebate) {
            // Initialize debate with existing data
            console.log('Loading existing debate:', existingDebate);

            // Set the debate ID
            const debateIdToUse = existingDebate.id || uuidv4();

            // Initialize the debate with existing topic
            initializeDebate(debateIdToUse, existingDebate.topic);

            // Set the experts
            if (existingDebate.experts && existingDebate.experts.length > 0) {
                setExperts(existingDebate.experts);
                setExpertsSelected(true);
            }

            // Set the expert type
            if (existingDebate.expertType) {
                setExpertType(existingDebate.expertType);
                setSelectedParticipantType(existingDebate.expertType);
            }

            // Set the messages if available
            if (existingDebate.messages && existingDebate.messages.length > 0) {
                setMessages(existingDebate.messages);
            }

            // Set the selected topic for UI
            setSelectedTopic(typeof existingDebate.topic === 'string' ? existingDebate.topic : JSON.parse(existingDebate.topic).title);

            // Close the content analyzer as we're continuing an existing debate
            setIsContentAnalyzerOpen(false);

            // Set success states
            updateStepState('topicInitialization', 'success', 'Debate loaded!');
            updateStepState('expertSelection', 'success');
            updateStepState('expertLoading', 'success', 'Experts loaded successfully!');

            showSuccess('Debate Loaded', 'You can continue where you left off');
        }
    }, [existingDebate]);

    // Add this useEffect after the existing useEffect hooks
    // This will ensure the topic is synchronized between the local state and store
    useEffect(() => {
        // If we have a selectedTopic but no topic in the store, update the store
        if (selectedTopic && !topic) {
            console.log('Syncing selectedTopic to store:', selectedTopic);
            setTopic(selectedTopic);
        }

        // Log state for debugging
        if (selectedTopic || topic) {
            console.log('Topic State Sync:');
            console.log('- Topic in store:', topic);
            console.log('- Selected Topic:', selectedTopic);
            console.log('- User Topic:', userTopic);
        }
    }, [selectedTopic, topic, userTopic, setTopic]);

    // Add a utility function to ensure topic is properly set
    const ensureTopicSet = (providedTopic: string | null | undefined) => {
        console.log('### Ensuring topic is set with:', providedTopic);

        if (!providedTopic || providedTopic.trim() === '') {
            console.warn('Cannot ensure topic is set - provided topic is empty');
            return false;
        }

        // Update local states
        setUserTopic(providedTopic);
        setSelectedTopic(providedTopic);

        // Update store
        setTopic(providedTopic);

        // Verify topic was set
        console.log('Topic verification after setting:');
        console.log('- Topic in store is now:', topic);
        console.log('- Selected Topic is now:', selectedTopic);
        console.log('- User Topic is now:', userTopic);

        return true;
    };

    // Main render
    return (
        <div className="flex flex-col bg-gray-700 h-full max-w-4xl mx-auto">
            {/* Debug indicator - only shown in development or if debug mode is enabled */}
            {(process.env.NODE_ENV === 'development' || process.env.NEXT_PUBLIC_DEBUG_MODE === 'true') && (
                <div className="fixed top-0 right-0 p-2 bg-slate-800 text-white text-xs z-50 opacity-80 rounded-bl">
                    API: {debugInfo.usingRealApi ?
                        <span className="text-green-400">REAL ✓</span> :
                        <span className="text-red-400">MOCK ✗</span>}
                    <br />
                    Key: {debugInfo.apiKeyFormat}
                    <br />
                    Env: {debugInfo.environment}
                </div>
            )}

            {/* Show summary if requested */}
            {showSummary && messages.length > 0 && (
                <div className="mb-8 p-6 bg-black border border-gray-800 rounded-lg">
                    <h2 className="text-2xl font-bold text-white text-center mb-6">Debate Summary</h2>
                    <DebateSummary
                        topic={topic}
                        experts={experts}
                        messages={messages}
                    />
                    <div className="mt-6 flex justify-center space-x-4">
                        <Button
                            variant="default"
                            onClick={() => setShowSummary(false)}
                            className="px-6 bg-green-600 hover:bg-green-700"
                        >
                            Return to Debate
                        </Button>

                        <Button
                            variant="default"
                            onClick={handleStartNewDebate}
                            className="px-6 bg-green-600 hover:bg-green-700"
                        >
                            <Upload className="mr-2 h-4 w-4 rotate-180" />
                            Start New Debate
                        </Button>
                    </div>
                </div>
            )}

            <div className={cn(
                "flex flex-col flex-1 p-4 md:p-6 rounded-lg",
                "bg-gray-700 border border-gray-700",
                showSummary && "opacity-50"
            )}>
                {/* Progressive Loading States */}
                <div className="fixed top-0 left-0 right-0 z-40 mt-16">
                    {Object.entries(steps).map(([key, state]) => {
                        if (state.state !== 'idle') {
                            return (
                                <div
                                    key={key}
                                    className={cn(
                                        'p-2 text-center text-sm font-medium transition-all duration-300',
                                        state.state === 'loading' && 'bg-primary text-primary-foreground',
                                        state.state === 'success' && 'bg-green-500/90 text-white backdrop-blur-sm',
                                        state.state === 'error' && 'bg-destructive text-destructive-foreground'
                                    )}
                                >
                                    <div className="flex items-center justify-center gap-2">
                                        {state.state === 'loading' && (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                        )}
                                        <span>{state.message}</span>
                                    </div>
                                </div>
                            );
                        }
                        return null;
                    })}
                </div>

                {/* Loading and Error States */}
                {loadingState && (
                    <div className="fixed top-0 left-0 right-0 bg-primary text-primary-foreground p-2 text-center z-50 animate-fade-in-down">
                        <div className="flex items-center justify-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span>{loadingState}</span>
                        </div>
                    </div>
                )}

                {errorMessage && (
                    <div className="fixed top-0 left-0 right-0 bg-destructive text-destructive-foreground p-2 text-center z-50 animate-fade-in-down">
                        <div className="flex items-center justify-center gap-2">
                            <span>{errorMessage}</span>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setErrorMessage(null)}
                                className="h-6 px-2 text-xs"
                            >
                                Dismiss
                            </Button>
                        </div>
                    </div>
                )}

                <div className="flex flex-col h-full bg-gray-700 max-w-4xl mx-auto p-4">
                    {/* Expert Type Selection */}
                    {!selectedParticipantType && (
                        <div className="space-y-8">
                            <h2 className="text-2xl font-bold text-center text-white">Choose Your Debate Experts</h2>
                            <p className="text-center font-bold text-white">
                                Select the type of experts you'd like to debate with
                            </p>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
                                <button
                                    onClick={() => handleExpertTypeSelect('historical')}
                                    className="flex flex-col items-center p-6 rounded-lg border border-gray-600 bg-black hover:bg-gray-900 transition-colors"
                                >
                                    <div className="w-16 h-16 rounded-full bg-blue-900 flex items-center justify-center mb-4">
                                        <BookOpen className="h-8 w-8 text-blue-300" />
                                    </div>
                                    <h3 className="text-xl font-semibold mb-2 text-blue-700">Historical Figures</h3>
                                    <p className="text-white text-center">
                                        Debate with notable historical thinkers and leaders from different eras
                                    </p>
                                </button>

                                <button
                                    onClick={() => handleExpertTypeSelect('ai')}
                                    className="flex flex-col items-center p-6 rounded-lg border border-gray-600 bg-black hover:bg-gray-900 transition-colors"
                                >
                                    <div className="w-16 h-16 rounded-full bg-purple-900 flex items-center justify-center mb-4">
                                        <BrainCircuit className="h-8 w-8 text-purple-300" />
                                    </div>
                                    <h3 className="text-xl font-semibold mb-2 text-purple-700">AI Subject Experts</h3>
                                    <p className="text-white text-center">
                                        Debate with AI specialists across various fields, each with a unique identifier
                                    </p>
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Content Analysis or Direct Topic Input */}
                    {selectedParticipantType && !topic && (
                        <div className="space-y-8">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Direct Topic Input */}
                                <div className="card">
                                    <h2 className="text-xl font-semibold mb-4">Enter Debate Topic</h2>
                                    <div className="flex flex-col gap-2">
                                        <input
                                            type="text"
                                            placeholder="Enter your topic..."
                                            className="input"
                                            value={userTopic}
                                            onChange={(e) => setUserTopic(e.target.value)}
                                        />
                                        <Button
                                            onClick={() => {
                                                // Create a topic object with default arguments for manually entered topics
                                                const topicData = {
                                                    title: userTopic,
                                                    confidence: 1.0,
                                                    arguments: [
                                                        `${userTopic} is an important topic to discuss.`,
                                                        `There are multiple perspectives on ${userTopic}.`,
                                                        `Understanding ${userTopic} requires careful consideration of evidence.`
                                                    ]
                                                };

                                                // First, ensure the topic is properly set in all states
                                                ensureTopicSet(userTopic);

                                                // Then call handler for side effects
                                                handleTopicSelect(userTopic, topicData);

                                                // Increase timeout to ensure state is updated
                                                setTimeout(() => {
                                                    console.log('Checking topic before initialization (direct topic input):');
                                                    console.log('- Topic in store:', topic);
                                                    console.log('- Selected Topic:', selectedTopic);
                                                    console.log('- User Topic:', userTopic);

                                                    // Double-check that topic is set in at least one place
                                                    if (topic || selectedTopic || userTopic) {
                                                        console.log('Topic appears to be set, initializing debate...');
                                                        initializeDebateWithTopic();
                                                    } else {
                                                        console.warn('Topic still not set properly before initialization (direct topic input)');
                                                        // Force topic setting one more time as a final fallback
                                                        const success = ensureTopicSet(userTopic);
                                                        if (success) {
                                                            console.log('Forced topic setting, now initializing debate...');
                                                            initializeDebateWithTopic();
                                                        } else {
                                                            showWarning('Topic Error', 'Could not set topic properly. Please try again.');
                                                        }
                                                    }
                                                }, 800);  // Increased timeout for more reliability
                                            }}
                                            disabled={!userTopic.trim()}
                                            className="mt-2 w-full bg-green-600 hover:bg-green-700"
                                        >
                                            Set Topic
                                        </Button>
                                    </div>
                                </div>

                                {/* Content Analysis Section */}
                                <div className="card">
                                    <h2 className="text-xl font-semibold mb-4">Or Upload Content / Provide a Link</h2>
                                    <p className="text-sm text-muted-foreground mb-4">Upload a document, or provide a link to a YouTube video, or podcast to extract debate topics</p>

                                    {/* Integrated ContentUploader with all options */}
                                    <ContentUploader />
                                </div>
                            </div>

                            {/* Suggested Debate Topics - Replacing the former Extracted Topics section */}
                            {extractedTopics.length > 0 && (
                                <div className="mt-6">
                                    <h3 className="text-lg font-semibold mb-4">Suggested Debate Topics</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {extractedTopics.map((topic, index) => (
                                            <button
                                                key={index}
                                                onClick={() => {
                                                    // First ensure the topic is properly set in all states
                                                    ensureTopicSet(topic.title);

                                                    // Then call handler for side effects
                                                    handleTopicSelect(topic.title, topic);

                                                    // Increase timeout to ensure state is updated
                                                    setTimeout(() => {
                                                        console.log('Checking topic before initialization (suggested topic):');
                                                        console.log('- Topic in store:', topic);
                                                        console.log('- Selected Topic:', selectedTopic);
                                                        console.log('- User Topic:', userTopic);

                                                        // Double-check that topic is set in at least one place
                                                        if (topic || selectedTopic || userTopic) {
                                                            console.log('Topic appears to be set, initializing debate...');
                                                            initializeDebateWithTopic();
                                                        } else {
                                                            console.warn('Topic still not set properly before initialization (suggested topic)');
                                                            // Force topic setting one more time as a final fallback
                                                            const success = ensureTopicSet(topic.title);
                                                            if (success) {
                                                                console.log('Forced topic setting, now initializing debate...');
                                                                initializeDebateWithTopic();
                                                            } else {
                                                                showWarning('Topic Error', 'Could not set topic properly. Please try again.');
                                                            }
                                                        }
                                                    }, 800);  // Increased timeout for more reliability
                                                }}
                                                className={`card p-4 text-left hover:bg-accent transition-colors ${selectedTopic === topic.title ? 'border-2 border-primary' : 'border border-border'}`}
                                            >
                                                <div className="flex items-center justify-between mb-2">
                                                    <h4 className="font-medium text-md">{topic.title}</h4>
                                                    <span className="text-xs px-2 py-1 rounded-full bg-muted text-foreground">
                                                        {Math.round(topic.confidence * 100)}% confidence
                                                    </span>
                                                </div>
                                                <div className="my-2">
                                                    <div className="text-sm text-muted-foreground mb-1">Key arguments:</div>
                                                    <ul className="list-disc list-inside text-xs space-y-1 text-muted-foreground">
                                                        {topic.arguments.slice(0, 2).map((arg, i) => (
                                                            <li key={i} className="truncate">{arg}</li>
                                                        ))}
                                                        {topic.arguments.length > 2 && (
                                                            <li className="text-muted-foreground">+{topic.arguments.length - 2} more arguments</li>
                                                        )}
                                                    </ul>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {loadingState && (
                                <div className="border rounded-lg p-6 mt-4 bg-black/50 text-center">
                                    <div className="flex items-center justify-center space-x-2 p-4">
                                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                                        <span className="text-white font-medium">{loadingState}</span>
                                    </div>
                                </div>
                            )}

                            {(!extractedTopics || extractedTopics.length === 0) && !loadingState && (
                                <div className="text-center text-sm text-white">
                                    <p>Choose one of the options above to define the topic for your debate</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Meet Experts Button */}
                    {topic && !experts.length && !showExpertSelection && (
                        <div className="flex justify-center my-8">
                            <Button
                                onClick={() => {
                                    setShowExpertSelection(true);
                                    selectExperts();
                                }}
                                size="lg"
                                className="animate-pulse"
                            >
                                Meet Your Experts
                            </Button>
                        </div>
                    )}

                    {/* Expert Display and Debate Section */}
                    {(experts.length > 0 || expertsLoading || (expertsSelected && showExpertSelection) || (topic && showExpertSelection)) && (
                        <div className="space-y-6 mt-8">
                            <h3 className="text-xl font-semibold text-white text-center">Your Debate Experts</h3>

                            {experts.length > 0 ? (
                                <div className="flex gap-4 overflow-x-auto pb-4 justify-center">
                                    {experts.map((expert) => (
                                        <div
                                            key={expert.id}
                                            className={cn(
                                                "rounded-lg overflow-hidden",
                                                expert.stance === 'pro'
                                                    ? 'bg-green-100 dark:bg-green-900/50 border border-green-200 dark:border-green-800'
                                                    : 'bg-red-100 dark:bg-red-900/50 border border-red-200 dark:border-red-800'
                                            )}
                                        >
                                            <ExpertCard expert={expert} />
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    {/* Single consolidated loading indicator - no duplicate spinners */}
                                    <div className="flex flex-col items-center justify-center py-8">
                                        <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
                                        <>
                                            <p className="text-white text-center">Generating expert profiles based on your topic...</p>
                                            <p className="text-sm text-muted-foreground mt-2">This may take a moment as we create tailored debate experts.</p>
                                            {/* Add retry button after 15 seconds */}
                                            <div id="expert-retry-button" className="mt-6 opacity-0" style={{ animation: 'fadeIn 0.5s ease-in forwards 15s' }}>
                                                <Button
                                                    onClick={() => {
                                                        console.log("Retry button clicked, attempting to regenerate experts");
                                                        // Reset loading states
                                                        setExpertsLoading(false);
                                                        setIsLoading(false);
                                                        // Reset error states
                                                        updateStepState('expertLoading', 'idle');
                                                        clearError();

                                                        // Start fresh expert generation attempt - directly call API
                                                        console.log("PRODUCTION MODE RETRY: Making direct API call to generate experts");
                                                        setExpertsLoading(true);
                                                        setIsLoading(true);

                                                        // Get current topic
                                                        const currentTopic = topic || selectedTopic;

                                                        if (!currentTopic) {
                                                            console.warn('Missing topic, cannot select experts');
                                                            showWarning('Missing Topic', 'Please enter a topic first');
                                                            setExpertsLoading(false);
                                                            setIsLoading(false);
                                                            return;
                                                        }

                                                        // Parse topic data
                                                        let topicTitle = currentTopic;
                                                        let topicArguments: any[] = [];

                                                        try {
                                                            if (currentTopic.startsWith('{') && currentTopic.includes('title')) {
                                                                const parsedTopic = JSON.parse(currentTopic);
                                                                topicTitle = parsedTopic.title;

                                                                if (parsedTopic.data && parsedTopic.data.arguments) {
                                                                    topicArguments = parsedTopic.data.arguments;
                                                                }
                                                            }
                                                        } catch (e) {
                                                            console.warn('Failed to parse topic data, using as plain text');
                                                        }

                                                        updateStepState('expertLoading', 'loading', 'Selecting experts...');

                                                        // Direct API call with a longer timeout
                                                        (async () => {
                                                            try {
                                                                // API endpoints to try in order of preference (same as main function)
                                                                const apiEndpoints = [
                                                                    '/api/debate',
                                                                    '/api/debate/experts',
                                                                    '/api/experts',
                                                                    '/api/openai/generate-experts'
                                                                ];

                                                                // Function to check if an API endpoint is accessible (same as above)
                                                                const testApiEndpoint = async (endpoint: string): Promise<boolean> => {
                                                                    try {
                                                                        console.log(`Retry: Testing API endpoint availability: ${endpoint}`);
                                                                        const controller = new AbortController();
                                                                        const timeoutId = setTimeout(() => controller.abort(), 5000);

                                                                        const response = await fetch(`${endpoint}`, {
                                                                            method: 'GET',
                                                                            signal: controller.signal
                                                                        });

                                                                        clearTimeout(timeoutId);
                                                                        console.log(`Retry: Endpoint ${endpoint} test result: ${response.status}`);
                                                                        return response.ok;
                                                                    } catch (error) {
                                                                        console.warn(`Retry: Endpoint ${endpoint} test failed:`, error);
                                                                        return false;
                                                                    }
                                                                };

                                                                // Check API availability
                                                                let apiAvailable = false;
                                                                for (const endpoint of apiEndpoints) {
                                                                    apiAvailable = await testApiEndpoint(endpoint);
                                                                    if (apiAvailable) {
                                                                        console.log(`Retry: Found available API endpoint: ${endpoint}`);
                                                                        break;
                                                                    }
                                                                }

                                                                if (!apiAvailable) {
                                                                    console.error('Retry: No API endpoints are available');
                                                                    throw new Error('API services are currently unavailable. Please try again later.');
                                                                }

                                                                let apiSuccess = false;
                                                                let selectedExperts = [];
                                                                let lastError = null;

                                                                // Try each endpoint
                                                                for (const endpoint of apiEndpoints) {
                                                                    if (apiSuccess) break;
                                                                    console.log(`Retry: Attempting to select experts via ${endpoint}...`);

                                                                    try {
                                                                        const controller = new AbortController();
                                                                        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 seconds timeout

                                                                        // Get API key from environment
                                                                        const apiKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY || '';
                                                                        console.log(`Retry: Using API key: ${apiKey ? 'Available (starting with ' + apiKey.substring(0, 3) + '...)' : 'Not available'}`);

                                                                        const requestBody = {
                                                                            action: 'select-experts',
                                                                            topic: topicTitle,
                                                                            expertType: expertType || 'ai',
                                                                            count: 2,
                                                                            arguments: topicArguments
                                                                        };

                                                                        console.log(`Retry: Request body for ${endpoint}:`, JSON.stringify(requestBody));

                                                                        const response = await fetch(endpoint, {
                                                                            method: 'POST',
                                                                            headers: {
                                                                                'Content-Type': 'application/json',
                                                                                'Authorization': `Bearer ${apiKey}`
                                                                            },
                                                                            body: JSON.stringify(requestBody),
                                                                            signal: controller.signal
                                                                        });

                                                                        clearTimeout(timeoutId);
                                                                        console.log(`Retry: Response status from ${endpoint}: ${response.status}`);

                                                                        if (response.ok) {
                                                                            let rawText = '';
                                                                            try {
                                                                                rawText = await response.text();
                                                                                console.log(`Retry: Raw response from ${endpoint}:`, rawText.substring(0, 200) + '...');
                                                                                const data = JSON.parse(rawText);
                                                                                console.log(`Retry: Parsed data from ${endpoint}:`, data);

                                                                                if (data.experts && Array.isArray(data.experts) && data.experts.length > 0) {
                                                                                    console.log('Retry: Successfully selected experts from API:', data.experts);
                                                                                    selectedExperts = data.experts;
                                                                                    apiSuccess = true;
                                                                                    break;
                                                                                } else {
                                                                                    console.warn('Retry: API returned valid response but no experts:', data);
                                                                                }
                                                                            } catch (parseError) {
                                                                                console.error(`Retry: Error parsing API response from ${endpoint}:`, parseError);
                                                                                console.error('Retry: Raw response that failed to parse:', rawText);
                                                                                lastError = new Error(`Parse error: ${parseError.message}`);
                                                                            }
                                                                        } else {
                                                                            console.warn(`Retry: API returned error status: ${response.status}`);
                                                                            try {
                                                                                const errorText = await response.text();
                                                                                console.warn(`Retry: API error details from ${endpoint}:`, errorText);
                                                                                lastError = new Error(`HTTP ${response.status}: ${errorText}`);
                                                                            } catch (err) {
                                                                                console.warn('Retry: Could not read error response');
                                                                                lastError = new Error(`HTTP ${response.status}`);
                                                                            }
                                                                        }
                                                                    } catch (endpointError) {
                                                                        console.error(`Retry: Error with endpoint ${endpoint}:`, endpointError);
                                                                        lastError = endpointError;
                                                                    }
                                                                }

                                                                // If we successfully got experts, use them
                                                                if (apiSuccess && selectedExperts.length > 0) {
                                                                    console.log('Retry: Using experts from API:', selectedExperts);
                                                                    setExperts(selectedExperts);
                                                                    setExpertsSelected(true);
                                                                    updateStepState('expertLoading', 'success', 'Experts generated successfully!');
                                                                    showSuccess('Experts Generated', 'Debate experts have been selected based on your topic');
                                                                    return;
                                                                }

                                                                // If all API endpoints failed in production, show a clear error with the last error we encountered
                                                                console.error('Retry: All API endpoints failed to generate experts');
                                                                const errorMessage = lastError instanceof Error
                                                                    ? lastError.message
                                                                    : String(lastError);
                                                                throw new Error(`All API endpoints failed to generate experts: ${errorMessage}`);
                                                            } catch (error) {
                                                                console.error('Retry: Error generating experts:', error);
                                                                updateStepState('expertLoading', 'error', 'Failed to generate experts');
                                                                showError(createError(
                                                                    'API_ERROR',
                                                                    'Failed to generate experts. Please try again later or try a different topic.',
                                                                    'medium',
                                                                    true,
                                                                    { topic: topicTitle }
                                                                ));
                                                            } finally {
                                                                setExpertsLoading(false);
                                                                setIsLoading(false);
                                                            }
                                                        })();
                                                    }}
                                                    variant="outline"
                                                    size="sm"
                                                >
                                                    Retry Expert Generation
                                                </Button>
                                                <p className="text-xs text-muted-foreground mt-2">
                                                    Having trouble? Try manually refreshing the page or entering a different topic.
                                                </p>
                                            </div>
                                        </>
                                    </div>
                                </div>
                            )}

                            {/* Step 4: Start Discussion */}
                            {expertsSelected && messages.length === 0 && experts.length > 0 && (
                                <div className="mt-6 flex flex-col items-center justify-center gap-4">
                                    <Button
                                        onClick={startDiscussion}
                                        disabled={isGenerating}
                                        size="lg"
                                        className="w-full max-w-md"
                                    >
                                        {isGenerating ? (
                                            <>
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                Starting Discussion...
                                            </>
                                        ) : (
                                            'Start Debate on Selected Topic'
                                        )}
                                    </Button>

                                    {/* Debug info in development mode */}
                                    {process.env.NODE_ENV !== 'production' && (
                                        <div className="border border-yellow-400 rounded p-2 mt-2 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300 text-sm w-full max-w-md">
                                            <p className="font-semibold mb-1">Debug Info:</p>
                                            <ul className="list-disc list-inside space-y-1">
                                                <li>Experts selected: {experts.length}</li>
                                                <li>Messages: {messages.length}</li>
                                                <li>Topic: {topic || 'None'}</li>
                                                <li>
                                                    <Button
                                                        variant="link"
                                                        size="sm"
                                                        className="p-0 h-auto text-yellow-600 dark:text-yellow-400 underline"
                                                        onClick={() => {
                                                            // Force a direct API call
                                                            console.log('Testing direct API call');
                                                            fetch('/api/debate/response', {
                                                                method: 'POST',
                                                                headers: { 'Content-Type': 'application/json' },
                                                                body: JSON.stringify({
                                                                    expert: experts[0],
                                                                    messages: [{
                                                                        role: 'user',
                                                                        content: `Test topic: ${topic || 'General debate'}`
                                                                    }],
                                                                    topic: topic || 'General debate'
                                                                })
                                                            })
                                                                .then(res => res.json())
                                                                .then(data => {
                                                                    console.log('API test response:', data);
                                                                    alert(`API Response: ${data.response ? 'Success' : 'Failed'}`);
                                                                })
                                                                .catch(err => {
                                                                    console.error('API test error:', err);
                                                                    alert(`API Error: ${err.message}`);
                                                                });
                                                        }}
                                                    >
                                                        Test API
                                                    </Button>
                                                </li>
                                            </ul>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Debate Section */}
                    {messages.length > 0 && !showSummary && (
                        <>
                            <div className="flex-1 overflow-y-auto space-y-4 mb-4">
                                {messages.map((message) => (
                                    <MessageBubble
                                        key={message.id}
                                        message={message}
                                        experts={experts}
                                        audioRef={audioRef}
                                    />
                                ))}
                                {isGenerating && (
                                    <div className="flex justify-center">
                                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                                    </div>
                                )}
                                <div ref={messagesEndRef} />
                            </div>

                            <UserInput onSubmit={handleUserInput} disabled={isGenerating} />

                            {/* End Debate Button */}
                            <div className="mt-4 flex justify-center">
                                <Button
                                    variant="destructive"
                                    onClick={handleEndDebate}
                                    className="w-full max-w-xs font-bold text-white"
                                    disabled={isGenerating}
                                >
                                    <XCircle className="mr-2 h-4 w-4" />
                                    End Debate
                                </Button>
                            </div>
                        </>
                    )}

                    {/* Show debate content when summary is shown */}
                    {messages.length > 0 && showSummary && (
                        <div className="flex justify-center items-center h-40">
                            <p className="text-gray-400 text-center">
                                Debate has ended. View the summary above or return to continue the conversation.
                            </p>
                        </div>
                    )}

                    {/* Return button if participant type is selected but no experts are loaded yet */}
                    {selectedParticipantType && !topic && !experts.length && (
                        <div className="mt-6 flex justify-start">
                            <Button
                                variant="default"
                                onClick={() => {
                                    setSelectedParticipantType(null);
                                    setExtractedTopics([]);
                                    setSelectedTopic(null);
                                }}
                                className="bg-green-600 hover:bg-green-700"
                            >
                                <ArrowLeft className="mr-2 h-4 w-4" />
                                Back to Participants Selection
                            </Button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
} 