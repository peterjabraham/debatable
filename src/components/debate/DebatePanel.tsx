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
import { usePerplexity } from '@/lib/contexts/perplexity-context';
import { useMessageBatching } from '@/lib/hooks/useMessageBatching';
import { PerplexityDebug } from '@/components/debug/PerplexityDebug';

// Flag to completely disable API testing in MVP mode - changed to false to enable API calls
const DISABLE_API_TESTING = false;

// Flag to disable debug logs in MVP mode - ALWAYS TRUE FOR MVP
const DISABLE_DEBUG_LOGS = true;

// Add a flag to indicate if the backend API server is running - changed to true to enable API calls
const API_SERVER_AVAILABLE = true; // Set to true to enable backend API calls

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

// Helper function to ensure consistent expert types
const migrateExpertType = (expertType: string): 'historical' | 'ai' => {
    // Convert any 'domain' types to 'ai'
    return expertType === 'domain' ? 'ai' : (expertType as 'historical' | 'ai');
};

export function DebatePanel() {
    const {
        topic,
        experts,
        messages: storeMessages,
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
    const isMountedRef = useRef<boolean>(true);
    const messagesCache = useRef<Map<string, any>>(new Map());

    // Add the Perplexity context
    const { isLoading: isPerplexityLoading, setLoading: setPerplexityLoading, recentMessageIds, addMessageId } = usePerplexity();

    // Use the optimized message loading hook instead of directly using the store messages
    const {
        messages: optimizedMessages,
        isLoading: isMessagesLoading,
        hasMoreMessages,
        loadMoreMessages,
        refreshMessages
    } = useMessageBatching({
        debateId,
        initialMessages: storeMessages,
        enabled: !!debateId,
        onMessagesLoaded: (newMessages) => {
            // Process citations for newly loaded messages
            newMessages.forEach(msg => {
                if (msg.id) {
                    useDebateStore.getState().processCitationsInMessage(msg.id);
                }
            });
        }
    });

    // Sync any new messages from the store to our cache (for messages added locally)
    useEffect(() => {
        if (storeMessages.length > optimizedMessages.length) {
            // There are new messages in the store that aren't in our optimized messages
            // Refresh messages to pull in latest changes
            refreshMessages();
        }
    }, [storeMessages.length, optimizedMessages.length, refreshMessages]);

    // Request utility using the request manager
    const makeApiRequest = useCallback(async (
        endpoint: string,
        method: 'GET' | 'POST',
        data?: any,
        throttleKey?: string
    ) => {
        // Always try to make the request
        try {
            console.log(`Making API request to ${endpoint}`, data);

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

    // Update the generateLocalExpertResponses function to track Perplexity loading state
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

            // Call the API to generate expert responses
            console.log('Calling API to generate responses for experts:', currentExperts.map(e => e.name));

            // For each expert, call the API to generate a response
            const responses = await Promise.all(currentExperts.map(async (expert) => {
                // Get the last user message if available
                const lastUserMessage = currentMessages.length > 0
                    ? currentMessages[currentMessages.length - 1].content
                    : '';

                try {
                    // Call the debate API to generate a response
                    const response = await fetch('/api/debate', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            expert,
                            topic: topicTitle,
                            messages: currentMessages,
                            userMessage: lastUserMessage,
                            arguments: topicArguments
                        }),
                    });

                    if (!response.ok) {
                        throw new Error(`Failed to generate response for ${expert.name}`);
                    }

                    const data = await response.json();
                    return {
                        response: data.response || data.content,
                        usage: data.usage || { tokens: 0, promptTokens: 0, completionTokens: 0, cost: 0 },
                        expertName: expert.name,
                        expertId: expert.id
                    };
                } catch (error) {
                    console.error(`Error generating response for ${expert.name}:`, error);
                    // Fallback to a simple response
                    return {
                        response: `As ${expert.name}, I would address this topic, but I'm having trouble formulating my thoughts right now.`,
                        usage: { tokens: 0, promptTokens: 0, completionTokens: 0, cost: 0 },
                        expertName: expert.name,
                        expertId: expert.id
                    };
                }
            }));

            // Set loading state for Perplexity
            if (setPerplexityLoading) {
                setPerplexityLoading(true);
            }

            // Process each response and add it to the store
            for (const { response, usage, expertName, expertId } of responses) {
                const messageId = `msg_${Date.now()}_${expertId}`;

                // Track message ID for Perplexity loading indicator (if available)
                if (addMessageId) {
                    addMessageId(messageId);
                }

                const newMessage: Message = {
                    id: messageId,
                    role: 'assistant',
                    content: response,
                    speaker: expertName,
                    usage,
                    timestamp: new Date().toISOString() // Add timestamp for proper ordering
                };

                // Add to the store
                addMessage(newMessage);

                // Process citations if needed
                try {
                    useDebateStore.getState().processCitationsInMessage(messageId);
                } catch (error) {
                    console.warn('Error processing citations:', error);
                }
            }

            // Handle voice synthesis if enabled
            if (useVoiceSynthesis) {
                await handleVoiceSynthesis(responses, currentExperts);
            }

            // Force a refresh of the optimized messages to include the new ones
            setTimeout(() => {
                console.log("Refreshing messages after start discussion");
                refreshMessages();
            }, 300);

            // Update UI state
            updateStepState('responseGeneration', 'success', 'Responses generated successfully!');
            showSuccess('Responses Generated', 'Expert responses are ready');

            // Turn off Perplexity loading after a delay
            setTimeout(() => {
                if (setPerplexityLoading) {
                    setPerplexityLoading(false);
                }
            }, 1500);

            return responses;
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
            if (setPerplexityLoading) {
                setPerplexityLoading(false);
            }
            return [];
        }
    }, [topic, selectedTopic, addMessage, handleError, showSuccess, useVoiceSynthesis, updateStepState, setPerplexityLoading, addMessageId, refreshMessages]);

    // Handle expert type selection
    const handleExpertTypeSelect = async (type: 'historical' | 'ai') => {
        try {
            updateStepState('expertSelection', 'loading', 'Preparing expert selection...');
            setExperts([]);
            setExpertType(migrateExpertType(type));
            setSelectedParticipantType(migrateExpertType(type));
            clearError();
            setIsLoading(false);
            updateStepState('expertSelection', 'success');
            showSuccess('Expert Type Selected', `${migrateExpertType(type)} experts will be used for the debate`);
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
        // Default to 'ai' experts when selecting from Suggested Debate Topics
        if (!selectedParticipantType) {
            console.log('Setting default participant type to ai experts');
            setSelectedParticipantType('ai');
            setExpertType('ai');
        }

        // IMPORTANT: Force experts to load immediately with mock data
        // This bypasses all API calls and ensures experts always appear
        console.log('Force loading mock experts on topic selection');
        const currentExpertType = expertType || selectedParticipantType || 'ai';

        // Get the appropriate mock experts based on the selected type
        const filteredMockExperts = mockExperts
            .filter((expert: Expert) => expert.type === (currentExpertType))
            .slice(0, 2); // Take the first two (one pro, one con)

        console.log('Loading mock experts:', filteredMockExperts);

        // Set the experts in the store
        setExperts(filteredMockExperts);
        setExpertsSelected(true);
        showInfo('Sample Experts Loaded', 'Using mock experts for this debate session');

        // Ensure expert selection is shown after topic is selected
        setShowExpertSelection(true);
        setExpertsLoading(false);
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
            return;
        }

        // Set default participant type if not set
        if (!selectedParticipantType) {
            console.log('Setting default participant type to ai experts');
            setSelectedParticipantType('ai');
            setExpertType('ai');
        }

        console.log('Initializing debate with topic:', selectedTopic, 'and participant type:', selectedParticipantType || 'ai');
        const newDebateId = uuidv4();
        updateStepState('topicInitialization', 'loading', 'Initializing debate...');

        try {
            // Initialize directly with the generated debateId
            initializeDebate(newDebateId, selectedTopic);
            updateStepState('topicInitialization', 'success', 'Debate initialized!');
            showSuccess('Debate Initialized', 'Experts are ready');

            // Skip selectExperts call since we already loaded experts in handleTopicSelect
            // Just verify experts are loaded
            if (experts.length === 0) {
                console.log("No experts found after initialization, forcing mock experts again");
                // Force mock experts one more time as a fallback
                const currentExpertType = expertType || selectedParticipantType || 'ai';
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
                { topic: selectedTopic, expertType: selectedParticipantType || 'ai' }
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
            // Call the debate-experts API to get experts
            console.log('Calling debate-experts API to get experts for topic:', topicTitle);

            const response = await fetch('/api/debate-experts', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action: 'select-experts',
                    topic: topicTitle,
                    expertType: migrateExpertType(expertType || 'ai')
                }),
            });

            if (!response.ok) {
                throw new Error(`API request failed with status ${response.status}`);
            }

            const data = await response.json();

            if (data.status !== 'success' || !data.experts || !Array.isArray(data.experts)) {
                throw new Error('Invalid response format from API');
            }

            console.log('Received experts from API:', data.experts);

            // Set the experts
            setExperts(data.experts);
            setExpertsSelected(true);
            updateStepState('expertLoading', 'success', 'Experts selected successfully!');
            showSuccess('Experts Selected', 'Your debate experts are ready');

            // Clear loading states
            setExpertsLoading(false);
            setIsLoading(false);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.warn(`API expert selection failed: ${errorMessage}. Using mock experts instead.`);

            // Use mock expert data as fallback
            const filteredMockExperts = mockExperts.filter((expert: Expert) => expert.type === (expertType || 'ai'));

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

        console.log("Starting discussion with experts:", experts.map(e => e.name));
        setIsGenerating(true);
        updateStepState('responseGeneration', 'loading', 'Generating initial responses...');

        try {
            // Ensure debate ID is set
            if (!debateId) {
                const newDebateId = uuidv4();
                console.log("Creating new debate ID:", newDebateId);
                initializeDebate(newDebateId, topic || selectedTopic || 'General debate');
            }

            // Use our local function to generate expert responses with empty messages array
            const responses = await generateLocalExpertResponses(experts, []);
            console.log("Generated responses:", responses?.length || 0);

            // If our component is still mounted after the async operation
            if (isMountedRef.current) {
                // Force a message refresh to ensure the UI shows the new messages
                setTimeout(() => {
                    console.log("Refreshing messages after start discussion");
                    refreshMessages();
                }, 500);

                updateStepState('responseGeneration', 'success', 'Discussion started!');
                setTimeout(() => updateStepState('responseGeneration', 'idle'), 2000);
            }
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
        if (isGenerating || !text.trim()) {
            return;
        }

        setIsGenerating(true);
        updateStepState('responseGeneration', 'loading', 'Generating responses...');

        try {
            // Create user message
            const userMessage: Message = {
                id: `msg_${Date.now()}_user`,
                role: 'user',
                content: text,
                speaker: 'You',
                timestamp: new Date().toISOString()
            };

            // Add to local store first for immediate UI update
            addMessage(userMessage);

            // Save to Firestore through the API
            try {
                await fetch(`/api/debate/${debateId}/messages`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ message: userMessage }),
                });
            } catch (error) {
                console.error('Error saving message to Firestore:', error);
                // Continue even if saving to Firestore fails - we've already updated local state
            }

            // Generate expert responses - keep existing implementation
            await generateLocalExpertResponses(experts, [...optimizedMessages, userMessage]);
        } catch (error) {
            const appError = createError(
                'RESPONSE_GENERATION_ERROR', // Use existing error code
                'Error processing user input',
                'medium',
                true,
                { error: error instanceof Error ? error.message : String(error) }
            );
            displayError(appError);
        } finally {
            setIsGenerating(false);
            updateStepState('responseGeneration', 'idle');
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
    }, [optimizedMessages]);

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

                    // Get the current expert type or default to ai
                    const currentExpertType = expertType || 'ai';

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
            // This check is now disabled to allow API calls
            // if (!MVP_CONFIG.apiServerAvailable || MVP_CONFIG.disableApiTesting || process.env.NEXT_PUBLIC_MOCK_API === 'true') {
            //     console.log("API server unavailable or testing disabled. Using mock data directly.");
            //     success = false; // Skip to fallback
            // } else {

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
            // }

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
    const handleEndDebate = () => {
        setShowSummary(true);
        // Scroll to the top to show the summary
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    // Function to handle starting a new debate
    const handleStartNewDebate = () => {
        // Reset all global store state
        reset();

        // Reset all component state
        setShowSummary(false);
        setUserTopic('');
        setErrorMessage(null);
        setLoadingState('');
        setExpertsSelected(false);
        setShowExpertSelection(false);
        setExpertsLoading(false);
        setIsLoading(false);

        // Important - reset the participant type to null to go back to the initial screen
        setSelectedParticipantType(null);

        // Reset topic-related state
        setSelectedTopic(null);
        setExtractedTopics([]);
        setIsContentAnalyzerOpen(true);

        // Clear any cached messages
        messagesCache.current?.clear?.();

        // Reset all step states
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

    // Replace the renderMessages function
    const renderMessages = () => {
        if (optimizedMessages.length === 0) {
            return null;
        }

        return (
            <div className="space-y-4 mb-4">
                {optimizedMessages.map((message, index) => (
                    <MessageBubble
                        key={message.id || index}
                        message={message}
                        experts={experts}
                        audioRef={audioRef}
                        isLoadingInsights={isPerplexityLoading && message.id ? recentMessageIds.includes(message.id) : false}
                    />
                ))}
                {hasMoreMessages && (
                    <div className="flex justify-center py-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={loadMoreMessages}
                            disabled={isMessagesLoading}
                        >
                            {isMessagesLoading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Loading...
                                </>
                            ) : (
                                'Load More Messages'
                            )}
                        </Button>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>
        );
    };

    // Add useEffect cleanup for isMountedRef
    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
        };
    }, []);

    // Add new state for confirmation dialog
    const [showConfirmationDialog, setShowConfirmationDialog] = useState(false);
    const [pendingTopic, setPendingTopic] = useState<{ title: string, data: any } | null>(null);

    // Function to handle custom topic submission with confirmation
    const handleCustomTopicSubmit = () => {
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

        // If a topic is already selected (from suggested topics), show confirmation dialog
        if (selectedTopic) {
            setPendingTopic({ title: userTopic, data: topicData });
            setShowConfirmationDialog(true);
            return;
        }

        // Otherwise, proceed as normal
        handleTopicSelect(userTopic, topicData);
        setTimeout(() => {
            initializeDebateWithTopic();
        }, 100);
    };

    // Function to confirm topic change
    const confirmTopicChange = () => {
        if (pendingTopic) {
            // Clear extracted topics to prevent confusion
            setExtractedTopics([]);

            // Set the new topic
            handleTopicSelect(pendingTopic.title, pendingTopic.data);
            setTimeout(() => {
                initializeDebateWithTopic();
            }, 100);
        }

        // Close the dialog
        setShowConfirmationDialog(false);
        setPendingTopic(null);
    };

    // Main render
    return (
        <div className="flex flex-col h-full max-w-4xl mx-auto">
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
            {showSummary && optimizedMessages.length > 0 && (
                <div className="mb-8 p-6 bg-gray-800 border border-gray-700 rounded-lg">
                    <h2 className="text-2xl font-bold text-center mb-6">Debate Summary</h2>
                    <DebateSummary
                        topic={topic}
                        experts={experts}
                        messages={optimizedMessages}
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

                {/* Only show when not in summary mode */}
                {!showSummary && (
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
                                        onClick={() => handleExpertTypeSelect('ai')}
                                        className="flex flex-col items-center p-6 rounded-lg border border-gray-700 bg-gray-800 hover:bg-gray-700 transition-colors"
                                    >
                                        <div className="w-16 h-16 rounded-full bg-purple-900 flex items-center justify-center mb-4">
                                            <BrainCircuit className="h-8 w-8 text-purple-300" />
                                        </div>
                                        <h3 className="text-xl font-semibold mb-2">AI Subject Experts</h3>
                                        <p className="text-gray-400 text-center">
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
                                                onClick={handleCustomTopicSubmit}
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
                                                            initializeDebateWithTopic();
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

                        {/* Expert Display and Debate Section - Only show when not in summary mode */}
                        {!showSummary && (experts.length > 0 || expertsLoading || (expertsSelected && showExpertSelection) || (topic && showExpertSelection)) && (
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
                                                    name: 'AI Environmental Expert',
                                                    type: 'ai',
                                                    background: 'Specializes in environmental science and climate policy analysis',
                                                    expertise: ['Climate Science', 'Policy Analysis'],
                                                    stance: 'pro',
                                                    perspective: 'I support evidence-based solutions to climate challenges.',
                                                    identifier: 'AI-ENV5432'
                                                }} />
                                                <ExpertCard key="fallback_con" expert={{
                                                    id: 'fallback_con',
                                                    name: 'AI Economic Policy Expert',
                                                    type: 'ai',
                                                    background: 'Specializes in economic policy and market impact assessment',
                                                    expertise: ['Economics', 'Policy Analysis'],
                                                    stance: 'con',
                                                    perspective: 'I believe we need careful consideration of economic implications.',
                                                    identifier: 'AI-EPE7891'
                                                }} />
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Step 4: Start Discussion */}
                                {expertsSelected && optimizedMessages.length === 0 && experts.length > 0 && (
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
                        {optimizedMessages.length > 0 && !showSummary && (
                            <>
                                <div className="debate-messages-container">
                                    {renderMessages()}
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
                        {optimizedMessages.length > 0 && showSummary && (
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
                )}
            </div>

            {/* Perplexity API Diagnostics - only shown in development or if debug mode is enabled */}
            {(process.env.NODE_ENV === 'development' || process.env.NEXT_PUBLIC_DEBUG_MODE === 'true') && (
                <div className="mt-16 px-4">
                    <div className="max-w-3xl mx-auto">
                        <details className="group">
                            <summary className="flex cursor-pointer items-center justify-between rounded-lg bg-gray-800 px-4 py-2 text-sm font-medium text-white">
                                <span>Developer Tools: Perplexity API Status</span>
                                <span className="transition group-open:rotate-180">
                                    <ChevronDown className="h-4 w-4" />
                                </span>
                            </summary>
                            <div className="mt-3 space-y-3">
                                <PerplexityDebug />
                            </div>
                        </details>
                    </div>
                </div>
            )}

            {/* Confirmation Dialog */}
            {showConfirmationDialog && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
                    <div className="bg-gray-800 p-6 rounded-lg max-w-md w-full mx-4">
                        <h3 className="text-xl font-bold mb-4">Change Debate Topic?</h3>
                        <p className="mb-6">
                            You already selected "{selectedTopic}". Changing to "{pendingTopic?.title}" will start a new debate with different experts.
                        </p>
                        <div className="flex space-x-4 justify-end">
                            <Button
                                variant="outline"
                                onClick={() => {
                                    setShowConfirmationDialog(false);
                                    setPendingTopic(null);
                                }}
                            >
                                Cancel
                            </Button>
                            <Button
                                variant="destructive"
                                onClick={confirmTopicChange}
                            >
                                Change Topic
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
} 