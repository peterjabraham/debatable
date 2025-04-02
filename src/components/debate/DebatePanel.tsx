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

// Flag to completely disable API testing in MVP mode - Can be overridden by environment variables
const DISABLE_API_TESTING = process.env.DISABLE_API_TESTING === 'true';

// Flag to disable debug logs in MVP mode
const DISABLE_DEBUG_LOGS = process.env.DISABLE_DEBUG_LOGS === 'true';

// Flag to indicate if the backend API server is running - Use the value from config or environment
const API_SERVER_AVAILABLE = MVP_CONFIG.apiServerAvailable || process.env.MVP_CONFIG_API_SERVER_AVAILABLE === 'true';

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
        name: 'Dr. Rachel Chen',
        type: 'domain' as const,
        background: 'Dr. Chen is a leading environmental scientist with expertise in climate change research and sustainability initiatives.',
        expertise: ['Climate change', 'Biodiversity', 'Sustainability'],
        stance: 'pro' as const,
        perspective: 'I believe this is an important area that deserves our attention.',
        voiceId: 'mock-voice-1'
    } as Expert,
    {
        id: 'exp_mock_2',
        name: 'Professor Michael Torres',
        type: 'domain' as const,
        background: 'Professor Torres specializes in economic policy analysis with a focus on resource allocation and market effects.',
        expertise: ['Economic policy', 'Resource allocation', 'Market analysis'],
        stance: 'con' as const,
        perspective: 'I think we need to carefully examine the assumptions being made in this discussion.',
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

export function DebatePanel() {
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
        reset
    } = useDebateStore();

    // Initialize error handling and toast hooks
    const { handleError, clearError, retry, canRetry } = useErrorHandler({
        maxRetries: 3,
        onError: (error) => {
            displayError(error);
        },
    });
    // Extract toast functions only once
    const { showError: displayError, showSuccess, showWarning, showInfo } = useToast();

    const [showSummary, setShowSummary] = useState(false);
    const [userTopic, setUserTopic] = useState('');
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [loadingState, setLoadingState] = useState<string>('');
    const [expertsSelected, setExpertsSelected] = useState(false);
    const [showExpertSelection, setShowExpertSelection] = useState(false);
    const [expertsLoading, setExpertsLoading] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [selectedParticipantType, setSelectedParticipantType] = useState<'historical' | 'domain' | null>(null);
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

    // Helper function to generate and handle expert responses
    const generateLocalExpertResponses = useCallback(async (currentExperts: Expert[], currentMessages: Message[]) => {
        updateStepState('responseGeneration', 'loading', 'Generating responses...');
        try {
            // Use either the topic from the store or the selectedTopic local state
            const currentTopic = topic || selectedTopic;
            console.log('Generating responses for topic:', currentTopic);

            // Parse the topic data if it's in JSON format
            let topicTitle = currentTopic;
            let topicArguments = [];

            try {
                // Use the same parsing approach as in selectExperts
                if (typeof currentTopic === 'string' && currentTopic.startsWith('{') && currentTopic.includes('title')) {
                    const parsedTopic = JSON.parse(currentTopic);
                    topicTitle = parsedTopic.title;

                    // Extract arguments if available
                    if (parsedTopic.data && parsedTopic.data.arguments) {
                        topicArguments = parsedTopic.data.arguments;
                        console.log('Found topic arguments:', topicArguments);
                    }
                }
            } catch (e) {
                console.error('Failed to parse topic JSON:', e);
                // Continue with the topic as-is if parsing fails
            }

            // Check if we can use the real API
            if (API_SERVER_AVAILABLE && !DISABLE_API_TESTING) {
                try {
                    console.log('Attempting to use real OpenAI API for responses');

                    // Prepare responses using OpenAI
                    for (const expert of currentExperts) {
                        try {
                            console.log(`Generating response for expert: ${expert.name}`);

                            // Create conversation context for this expert
                            const expertContext = [
                                {
                                    role: 'system',
                                    content: `You are ${expert.name}, an expert with the following background: ${expert.background}. 
                                    Your areas of expertise include: ${Array.isArray(expert.expertise) ? expert.expertise.join(', ') : 'various fields'}.
                                    You have a ${expert.stance === 'pro' ? 'positive' : 'skeptical'} stance on the topic.
                                    Respond in first person as this expert would, with their tone, knowledge level, and perspective.
                                    Keep responses concise (150-250 words) but substantive, focusing on your strongest arguments.`
                                }
                            ];

                            // Add the topic as the first message if this is the initial response
                            if (currentMessages.length === 0) {
                                expertContext.push({
                                    role: 'user',
                                    content: `The topic is: ${topicTitle}. Please provide your initial perspective on this topic.`
                                });
                            } else {
                                // Add all existing messages to the context
                                currentMessages.forEach(msg => {
                                    expertContext.push({
                                        role: msg.role,
                                        content: msg.content
                                        // Don't add name field here - let the API handle it
                                    });
                                });
                            }

                            // Make the API call to our internal endpoint
                            console.log(`Sending API request for ${expert.name}`);
                            const response = await fetch('/api/debate', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    messages: expertContext,
                                    expert: {
                                        name: expert.name,
                                        stance: expert.stance,
                                        expertise: expert.expertise,
                                        background: expert.background
                                    },
                                    topic: topicTitle
                                })
                            });

                            if (!response.ok) {
                                const errorText = await response.text();
                                console.error(`API error for ${expert.name}: ${response.status} - ${errorText}`);
                                throw new Error(`Failed to generate response for ${expert.name}: ${response.status}`);
                            }

                            const data = await response.json();

                            // Add message to the store
                            const messageId = `msg_${Date.now()}_${expert.id}`;
                            const newMessage = {
                                id: messageId,
                                role: 'assistant' as const,
                                content: data.response || data.content,
                                speaker: expert.name,
                                usage: data.usage || {
                                    tokens: 0,
                                    promptTokens: 0,
                                    completionTokens: 0,
                                    cost: 0
                                }
                            };

                            addMessage(newMessage);
                            useDebateStore.getState().processCitationsInMessage(messageId);
                        } catch (expertError) {
                            console.error(`Error generating response for ${expert.name}:`, expertError);

                            // Only throw if this is a critical error, otherwise continue with other experts
                            if (expertError.message?.includes('authentication') ||
                                expertError.message?.includes('key') ||
                                expertError.message?.includes('quota') ||
                                expertError.message?.includes('rate limit')) {
                                throw expertError; // Rethrow critical errors
                            }

                            // For non-critical errors, create a fallback response for this expert
                            const mockResponse = `As ${expert.name}, I apologize, but I'm unable to provide a response at this time due to a technical issue. ${expert.stance === 'pro'
                                ? 'I generally support this position based on my expertise.'
                                : 'I have some reservations about this position based on my expertise.'
                                }`;

                            const messageId = `msg_${Date.now()}_${expert.id}_fallback`;
                            const fallbackMessage = {
                                id: messageId,
                                role: 'assistant' as const,
                                content: mockResponse,
                                speaker: expert.name,
                                usage: {
                                    tokens: 50,
                                    promptTokens: 50,
                                    completionTokens: 50,
                                    cost: 0.01
                                }
                            };

                            addMessage(fallbackMessage);
                        }
                    }

                    if (useVoiceSynthesis) {
                        // Get the latest messages for voice synthesis
                        const latestMessages = useDebateStore.getState().messages.slice(-currentExperts.length);
                        await handleVoiceSynthesis(
                            latestMessages.map(msg => ({
                                expertName: msg.speaker,
                                content: msg.content
                            })),
                            currentExperts
                        );
                    }

                    updateStepState('responseGeneration', 'success', 'Responses generated successfully!');
                    showSuccess('AI Responses Generated', 'Expert responses have been created');
                    return;
                } catch (apiError) {
                    // Log the error but don't rethrow - we'll fallback to mock data
                    console.error('Error using OpenAI API:', apiError);
                    console.log('Falling back to simulated responses');

                    // Check for specific error types to show more helpful messages
                    if (apiError.message?.includes('authentication') || apiError.message?.includes('key')) {
                        showWarning('API Key Issue', 'Authentication with OpenAI failed. Check your API key.');
                    } else if (apiError.message?.includes('quota') || apiError.message?.includes('rate limit')) {
                        showWarning('API Quota Exceeded', 'You may have exceeded your OpenAI quota or rate limit.');
                    } else if (apiError.message?.includes('messages[')) {
                        showWarning('Message Format Error', 'There was an issue with the message format sent to OpenAI.');
                    }
                }
            }

            // Fallback to simulated responses if API is not available or failed
            console.log('Using simulated expert responses');

            // Simulate responses for each expert
            const responses = currentExperts.map((expert, index) => {
                // Get the last user message if available
                const lastUserMessage = currentMessages.length > 0
                    ? currentMessages[currentMessages.length - 1].content
                    : '';

                let simulatedResponse = '';

                // If this is the first message (no user messages yet), use the extracted arguments
                if (currentMessages.length === 0 && topicArguments.length > 0) {
                    // Each expert focuses on different arguments
                    const expertArgument = topicArguments[index % topicArguments.length];

                    // Handle different formats of arguments
                    const argumentText = typeof expertArgument === 'string'
                        ? expertArgument
                        : (expertArgument.claim || expertArgument.text || JSON.stringify(expertArgument));

                    // Handle evidence if available
                    const evidence = typeof expertArgument === 'object' && expertArgument.evidence
                        ? expertArgument.evidence
                        : '';

                    // Handle counterpoints if available
                    const counterpoint = typeof expertArgument === 'object' &&
                        expertArgument.counterpoints &&
                        Array.isArray(expertArgument.counterpoints) &&
                        expertArgument.counterpoints.length > 0
                        ? expertArgument.counterpoints[0]
                        : '';

                    if (expert.stance === 'pro') {
                        simulatedResponse = `As a proponent in the field of ${topicTitle}, I'd like to highlight some key points: ${argumentText}. ${evidence}`;
                    } else {
                        simulatedResponse = `While examining ${topicTitle}, I have a different perspective to offer: ${argumentText}. ${evidence}`;

                        // Add counterpoints if available
                        if (counterpoint) {
                            simulatedResponse += ` However, it's worth considering that ${counterpoint}`;
                        }
                    }
                } else {
                    // For subsequent messages, use the previous approach
                    simulatedResponse = expert.stance === 'pro'
                        ? `As someone who supports action on ${topicTitle}, I believe we need to take this issue seriously. ${expert.perspective}`
                        : `I have reservations about some aspects of ${topicTitle}. ${expert.perspective}`;
                }

                return {
                    response: simulatedResponse,
                    usage: {
                        tokens: 250,
                        promptTokens: 100,
                        completionTokens: 150,
                        cost: 0.002
                    },
                    expertName: expert.name,
                    expertId: expert.id
                };
            });

            for (const { response, usage, expertName, expertId } of responses) {
                const messageId = `msg_${Date.now()}_${expertId}`;
                const newMessage = {
                    id: messageId,
                    role: 'assistant' as const,
                    content: response,
                    speaker: expertName,
                    usage
                };

                addMessage(newMessage);
                useDebateStore.getState().processCitationsInMessage(messageId);
            }

            if (useVoiceSynthesis) {
                await handleVoiceSynthesis(responses, currentExperts);
            }

            updateStepState('responseGeneration', 'success', 'Responses generated successfully!');
            showSuccess('Responses Generated', 'Expert responses are ready');
        } catch (error) {
            const appError = createError(
                'RESPONSE_GENERATION_ERROR',
                'Failed to generate expert responses',
                'medium',
                true,
                { error: error instanceof Error ? error.message : String(error) }
            );
            handleError(appError);
            updateStepState('responseGeneration', 'error', 'Failed to generate responses');
            setTimeout(() => updateStepState('responseGeneration', 'idle'), 2000);
        }
    }, [topic, selectedTopic, addMessage, handleError, showSuccess, showWarning, useVoiceSynthesis, updateStepState]);

    // Handle expert type selection
    const handleExpertTypeSelect = async (type: 'historical' | 'domain') => {
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
    const handleTopicSelect = async (topicTitle: string, topicData?: any) => {
        if (!topicTitle || topicTitle.trim() === '') {
            console.warn('Cannot select empty topic');
            showWarning('Invalid Topic', 'Please provide a valid debate topic');
            return;
        }

        console.log('Topic selected:', topicTitle, 'with data:', topicData);
        setUserTopic(topicTitle);

        // Store the complete topic data in the store, not just the title
        // This ensures arguments are available for expert generation
        if (topicData) {
            // Store as JSON string to preserve all data
            const topicWithData = JSON.stringify({
                title: topicTitle,
                data: topicData
            });
            setTopic(topicWithData);
        } else {
            // Fallback to just the title if no data provided
            setTopic(topicTitle);
        }

        setSelectedTopic(topicTitle);

        // Ensure participant type is set if not already selected
        // Default to 'domain' experts when selecting from Suggested Debate Topics
        if (!selectedParticipantType) {
            console.log('Setting default participant type to domain experts');
            setSelectedParticipantType('domain');
            setExpertType('domain');
        }

        // Set loading states
        setShowExpertSelection(true);
        setExpertsLoading(true);

        // Wait for state updates to complete
        await new Promise(resolve => setTimeout(resolve, 100));

        // Initialize debate with the selected topic
        const newDebateId = uuidv4();
        initializeDebate(newDebateId, topicTitle);
    };

    // Initialize debate after topic selection
    const initializeDebateWithTopic = async () => {
        console.log('### DEBUG: initializeDebateWithTopic called ###');
        console.log('- Topic:', selectedTopic);
        console.log('- Participant Type:', selectedParticipantType);
        console.log('- Experts Length:', experts.length);
        console.log('- ExpertsLoading:', expertsLoading);
        console.log('- ExpertsSelected:', expertsSelected);

        if (!selectedTopic) {
            console.warn('Cannot initialize debate: missing topic', { selectedTopic });

            // If there's no selectedTopic but there is a topic in the store, use that instead
            if (topic) {
                console.log('Using topic from store instead:', topic);
                // Extract the title if it's in JSON format
                let topicTitle = topic;
                try {
                    if (topic.startsWith('{') && topic.includes('title')) {
                        const parsedTopic = JSON.parse(topic);
                        topicTitle = parsedTopic.title;
                    }
                } catch (e) {
                    console.warn('Failed to parse topic JSON:', e);
                }

                // Set the selectedTopic state
                setSelectedTopic(topicTitle);

                // Continue with initialization using the store topic
                console.log('Continuing with topic from store:', topicTitle);
            } else {
                // If there's still no topic, show a warning and return
                showWarning('Missing Topic', 'Please enter a topic for the debate');
                return;
            }
        }

        // Get the actual topic to use (either selectedTopic or the parsed store topic)
        const currentTopic = selectedTopic || topic;

        // Set default participant type if not set
        if (!selectedParticipantType) {
            console.log('Setting default participant type to domain experts');
            setSelectedParticipantType('domain');
            setExpertType('domain');
        }

        console.log('Initializing debate with topic:', currentTopic, 'and participant type:', selectedParticipantType || 'domain');
        const newDebateId = uuidv4();
        updateStepState('topicInitialization', 'loading', 'Initializing debate...');

        try {
            // Initialize directly with the generated debateId
            initializeDebate(newDebateId, currentTopic);
            updateStepState('topicInitialization', 'success', 'Debate initialized!');
            showSuccess('Debate Initialized', 'Experts are ready');

            // Skip selectExperts call since we already loaded experts in handleTopicSelect
            // Just verify experts are loaded
            if (experts.length === 0) {
                console.log("No experts found after initialization, forcing mock experts again");
                // Force mock experts one more time as a fallback
                const currentExpertType = expertType || selectedParticipantType || 'domain';
                const filteredMockExperts = mockExperts
                    .filter((expert: Expert) => expert.type === currentExpertType)
                    .slice(0, 2);

                setExperts(filteredMockExperts);
                setExpertsSelected(true);
                showInfo('Using Sample Experts', 'Mock experts are being used for this session');
            }

            updateStepState('expertLoading', 'success', 'Experts selected successfully!');

        } catch (error) {
            console.error('Error initializing debate:', error);
            const appError = createError(
                'DEBATE_INITIALIZATION_ERROR',
                'Failed to initialize debate',
                'high',
                true,
                { topic: currentTopic, expertType: selectedParticipantType || 'domain' }
            );
            handleError(appError);
            updateStepState('topicInitialization', 'error', 'Failed to initialize debate');
        }
    };

    // Update selectExperts to use the selected participant type
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

        updateStepState('expertLoading', 'loading', 'Selecting experts...');
        setIsLoading(true);
        setExpertsLoading(true);
        clearError();

        try {
            // Check if API server is available before deciding whether to use mock data
            if (!MVP_CONFIG.apiServerAvailable) {
                console.log('API server unavailable, using mock experts as fallback');
                throw new Error('API server unavailable');
            }

            // Try real API calls first - API endpoints in order of preference
            const apiEndpoints = [
                `${API_CONFIG?.baseUrl || 'http://localhost:3030'}/api/debate`,
                `${API_CONFIG?.baseUrl || 'http://localhost:3030'}/api/climate-debate`
            ];

            let success = false;
            let experts = [];

            for (const endpoint of apiEndpoints) {
                try {
                    console.log(`Attempting to fetch experts from ${endpoint}...`);
                    const response = await fetch(`${endpoint}/experts?topic=${encodeURIComponent(topicTitle)}&type=${encodeURIComponent(expertType || 'domain')}`);

                    if (response.ok) {
                        const data = await response.json();
                        console.log(`Response from ${endpoint}:`, data);

                        if (data.experts && Array.isArray(data.experts) && data.experts.length > 0) {
                            experts = data.experts;
                            success = true;
                            console.log('Successfully retrieved experts from API:', experts);
                            break;
                        }
                    } else {
                        console.warn(`Failed to fetch experts from ${endpoint}:`, response.status);
                    }
                } catch (error) {
                    console.warn(`Error fetching from ${endpoint}:`, error);
                    // Continue to next endpoint
                }
            }

            if (success && experts.length > 0) {
                // Use the experts from the API
                setExperts(experts);
                setExpertsSelected(true);
                updateStepState('expertLoading', 'success', 'Experts selected successfully!');
                showSuccess('Experts Selected', 'Retrieved experts based on your topic');
            } else {
                // Fall back to mock experts if API calls fail
                console.log('API expert selection failed. Using mock experts as fallback.');
                throw new Error('Failed to retrieve experts from API');
            }

            // Clear loading states
            setExpertsLoading(false);
            setIsLoading(false);

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.warn(`API expert selection failed: ${errorMessage}. Using mock experts instead.`);

            // Use mock expert data as fallback
            const filteredMockExperts = mockExperts.filter((expert: Expert) => expert.type === (expertType || 'domain'));

            // Take the first two experts (one pro, one con)
            const selectedMockExperts = filteredMockExperts.slice(0, 2);

            // Test mock fallback
            debugTest.testMockExpertFallback(true, selectedMockExperts);

            console.log('Using mock experts as fallback:', selectedMockExperts);
            setExperts(selectedMockExperts);
            setExpertsSelected(true);
            updateStepState('expertLoading', 'success', 'Experts selected successfully!');
            showInfo('Using Sample Experts', 'Mock experts are being used because the API is unavailable');

            // Still log the original error
            const appError = createError(
                'EXPERT_SELECTION_ERROR',
                `API expert selection failed: ${errorMessage}. Using mock experts instead.`,
                'medium',
                false,
                { topic, expertType }
            );
            console.warn(appError);

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

        try {
            // Get the current topic
            const currentTopic = topic || selectedTopic || 'General debate';

            // Use our local function to generate expert responses
            await generateLocalExpertResponses(experts, []);

            updateStepState('responseGeneration', 'success', 'Discussion started!');
            setTimeout(() => updateStepState('responseGeneration', 'idle'), 2000);
        } catch (error) {
            console.error('Error starting discussion:', error);
            setErrorMessage('Failed to start the discussion');
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

    // Force show mock experts if not already present
    useEffect(() => {
        // If the user clicks on a debate topic and we're showing the loading spinner but no experts appear
        if (topic && expertsLoading && !experts.length) {
            // Set a timeout to ensure we're not still in the process of loading
            const timer = setTimeout(() => {
                if (!experts.length) {
                    console.log('FORCE LOADING MOCK EXPERTS: Experts not loaded after timeout');

                    // Get the current expert type or default to domain
                    const currentExpertType = expertType || 'domain';

                    // Filter and select mock experts
                    const filteredMockExperts = mockExperts
                        .filter((expert: Expert) => expert.type === currentExpertType)
                        .slice(0, 2); // Take two experts (one pro, one con)

                    console.log('Setting forced mock experts:', filteredMockExperts);

                    // Update the store with mock experts
                    setExperts(filteredMockExperts);
                    setExpertsSelected(true);
                    setExpertsLoading(false);

                    // Show notification
                    showInfo('Using Sample Experts', 'Mock experts are being displayed for testing');
                }
            }, 2000); // Wait 2 seconds before forcing experts to display

            return () => clearTimeout(timer);
        }
    }, [topic, expertsLoading, experts.length, expertType, setExperts, setExpertsSelected, setExpertsLoading, showInfo]);

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
                'Unable to analyze the document. Please try again or use a different file.',
                'medium',
                true
            );
            displayError(docAnalysisError);
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
    const handleEndDebate = async () => {
        setShowSummary(true);
        // Scroll to the top to show the summary
        window.scrollTo({ top: 0, behavior: 'smooth' });

        // Trigger the Perplexity API call by updating the topic
        // This will cause the DebateSummary component to re-render and fetch data
        if (topic) {
            setTopic(topic);
        }
    };

    // Function to handle starting a new debate
    const handleStartNewDebate = () => {
        // Reset all state
        reset();
        setShowSummary(false);
        setUserTopic('');
        setSelectedTopic(null);  // Make sure to reset the selectedTopic state
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

        // Clear any stored topics from the store explicitly
        setTopic('');

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

    // Main render
    return (
        <div data-testid="debate-panel" className="flex flex-col h-full max-w-4xl mx-auto">
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
                <div className="mb-8 p-6 bg-gray-800 border border-gray-700 rounded-lg">
                    <h2 className="text-2xl font-bold text-center mb-6">Debate Summary</h2>
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
                "bg-gray-800 border border-gray-700",
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

                <div className="flex flex-col h-full max-w-4xl mx-auto p-4">
                    {/* Expert Type Selection */}
                    {!selectedParticipantType && (
                        <div className="space-y-8">
                            <h2 className="text-2xl font-bold text-center">Choose Your Debate Experts</h2>
                            <p className="text-center text-gray-400">
                                Select the type of experts you'd like to debate with
                            </p>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
                                <button
                                    onClick={() => handleExpertTypeSelect('historical')}
                                    className="flex flex-col items-center p-6 rounded-lg border border-gray-700 bg-gray-800 hover:bg-gray-700 transition-colors"
                                >
                                    <div className="w-16 h-16 rounded-full bg-blue-900 flex items-center justify-center mb-4">
                                        <BookOpen className="h-8 w-8 text-blue-300" />
                                    </div>
                                    <h3 className="text-xl font-semibold mb-2">Historical Figures</h3>
                                    <p className="text-gray-400 text-center">
                                        Debate with notable historical thinkers and leaders from different eras
                                    </p>
                                </button>

                                <button
                                    onClick={() => handleExpertTypeSelect('domain')}
                                    className="flex flex-col items-center p-6 rounded-lg border border-gray-700 bg-gray-800 hover:bg-gray-700 transition-colors"
                                >
                                    <div className="w-16 h-16 rounded-full bg-purple-900 flex items-center justify-center mb-4">
                                        <BrainCircuit className="h-8 w-8 text-purple-300" />
                                    </div>
                                    <h3 className="text-xl font-semibold mb-2">Domain Experts</h3>
                                    <p className="text-gray-400 text-center">
                                        Debate with specialists from various fields and disciplines
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
                                                // Validate topic input
                                                if (!userTopic || userTopic.trim() === '') {
                                                    showWarning('Missing Topic', 'Please enter a valid debate topic');
                                                    return;
                                                }

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
                                                handleTopicSelect(userTopic, topicData);

                                                // Add small delay before initialization to ensure state is updated
                                                setTimeout(() => {
                                                    // Double-check that we have a topic before initializing
                                                    if (selectedTopic || topic) {
                                                        initializeDebateWithTopic();
                                                    } else {
                                                        console.warn('Topic state not updated in time, using direct value');
                                                        // Force initialization with the user input as fallback
                                                        setSelectedTopic(userTopic);
                                                        initializeDebate(uuidv4(), userTopic);
                                                    }
                                                }, 100);
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
                                    <h2 className="text-xl font-semibold mb-4">Upload Content</h2>
                                    <p className="text-sm text-muted-foreground mb-4">Upload a document, YouTube video, or podcast to extract debate topics</p>

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
                                                    handleTopicSelect(topic.title, topic);
                                                    setTimeout(() => {
                                                        // Double-check that we have a topic before initializing
                                                        if (selectedTopic || topic) {
                                                            initializeDebateWithTopic();
                                                        } else {
                                                            console.warn('Topic state not updated in time, using direct value');
                                                            // Force initialization with the extracted topic as fallback
                                                            setSelectedTopic(topic.title);
                                                            initializeDebate(uuidv4(), topic.title);
                                                        }
                                                    }, 100);
                                                }}
                                                className={`card p-4 text-left hover:bg-accent transition-colors ${selectedTopic === topic.title ? 'border-2 border-primary' : 'border border-border'
                                                    }`}
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
                                <div className="border rounded-lg p-6 mt-4 bg-gray-700/50 text-center">
                                    <div className="flex items-center justify-center space-x-2 p-4">
                                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                                        <span className="text-white font-medium">{loadingState}</span>
                                    </div>
                                </div>
                            )}

                            {(!extractedTopics || extractedTopics.length === 0) && !loadingState && (
                                <div className="text-center text-sm text-gray-400">
                                    <p>Choose one of the options above to start your debate</p>
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
                                        <ExpertCard key={expert.id} expert={expert} />
                                    ))}
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    {/* Loading indicator */}
                                    <div className="flex justify-center">
                                        <div className="text-center">
                                            <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto mb-4" />
                                            <p className="text-sm text-muted-foreground">Loading your experts...</p>
                                        </div>
                                    </div>

                                    {/* Fallback experts - always show these if loading takes more than 4 seconds */}
                                    <div className="mt-8 opacity-0 animate-fadeIn" style={{ animation: 'fadeIn 0.5s ease-in forwards 4s' }}>
                                        <p className="text-sm text-center text-yellow-400 mb-4">Using sample experts while we load...</p>
                                        <div className="flex gap-4 overflow-x-auto pb-4 justify-center">
                                            <ExpertCard key="fallback_pro" expert={{
                                                id: 'fallback_pro',
                                                name: 'Dr. Rachel Chen',
                                                type: 'domain',
                                                background: 'Environmental scientist specializing in climate policy',
                                                expertise: ['Climate Science', 'Policy Analysis'],
                                                stance: 'pro',
                                                perspective: 'I support evidence-based solutions to climate challenges.'
                                            }} />
                                            <ExpertCard key="fallback_con" expert={{
                                                id: 'fallback_con',
                                                name: 'Professor Michael Torres',
                                                type: 'domain',
                                                background: 'Economic policy specialist focusing on market impacts',
                                                expertise: ['Economics', 'Policy Analysis'],
                                                stance: 'con',
                                                perspective: 'I believe we need careful consideration of economic implications.'
                                            }} />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Step 4: Start Discussion */}
                            {expertsSelected && messages.length === 0 && experts.length > 0 && (
                                <div className="mt-6 flex justify-center">
                                    <Button
                                        onClick={startDiscussion}
                                        disabled={isGenerating}
                                        size="lg"
                                        className="bg-green-600 hover:bg-green-700"
                                    >
                                        {isGenerating ? (
                                            <>
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                Starting Discussion...
                                            </>
                                        ) : (
                                            'Start Discussion'
                                        )}
                                    </Button>
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