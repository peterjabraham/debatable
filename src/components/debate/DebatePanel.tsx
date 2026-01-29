"use client";

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
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

export function DebatePanel({ existingDebate }: { existingDebate?: any }) {
    const router = useRouter();
    const pathname = usePathname();
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
    const [fileStatus, setFileStatus] = useState({ message: 'No file selected', className: 'text-gray-400' });
    const [suggestedHistoricalFigures, setSuggestedHistoricalFigures] = useState<Array<{
        id: string;
        name: string;
        title: string;
        description: string;
        background: string;
        expertise: string[];
        perspective: string;
        stance: 'pro' | 'con';
        imageUrl?: string;
        voiceId?: string;
    }>>([]);
    const [selectedHistoricalFigures, setSelectedHistoricalFigures] = useState<string[]>([]);
    const [isLoadingHistoricalFigures, setIsLoadingHistoricalFigures] = useState(false);
    const [showHistoricalFigureSelection, setShowHistoricalFigureSelection] = useState(false);
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

    // MOVED: handleVoiceSynthesis to be defined earlier
    // Voice synthesis function
    const handleVoiceSynthesis = useCallback(async (responses: any[], currentExperts: Expert[]) => {
        // Skip API calls if server is unavailable
        if (!MVP_CONFIG.apiServerAvailable) {
            return; // Just return if API is not available, don't assign mock voices
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
    }, [MVP_CONFIG.apiServerAvailable, showWarning, createError, handleError]);

    // MOVED: selectExpertsWithTopic to be defined earlier
    // Create a version of selectExperts that takes a direct topic parameter
    const selectExpertsWithTopic = useCallback(async (directTopic: string): Promise<Expert[] | undefined> => {
        updateStepState('expertSelection', 'loading', 'Finding experts for this topic...');

        if (!directTopic || directTopic.trim() === '') {
            updateStepState('expertSelection', 'error', 'No topic provided');
            showWarning('No Topic', 'Please enter a topic to select experts.');
            return;
        }

        try {
            // First check if API is accessible at all
            const apiEndpoint = '/api/debate-experts';

            // Parse topic for potential structured data
            let topicTitle = directTopic;
            let topicArguments: any[] = [];

            if (typeof topicTitle === 'string' && topicTitle.startsWith('{') && topicTitle.includes('title')) {
                try {
                    const parsedTopic = JSON.parse(topicTitle);
                    console.log('Successfully parsed topic JSON:', parsedTopic);

                    topicTitle = parsedTopic.title || topicTitle;

                    if (parsedTopic.data && parsedTopic.data.arguments) {
                        topicArguments = parsedTopic.data.arguments;
                        console.log('Extracted topic arguments:', topicArguments);
                    }
                } catch (e) {
                    console.error('Error parsing topic JSON:', e);
                    console.log('Raw topic string that failed parsing:', topicTitle);
                }
            }

            // Check for API key
            const apiKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY || '';

            // Set timeout for API request - 90 seconds for LLM calls
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 90000);

            // Construct proper request body for debate-experts API
            const requestBody = {
                action: 'select-experts',
                topic: topicTitle,
                topicArguments: topicArguments, // Include the extracted arguments
                expertType: expertType || 'ai',
                count: 2,
                requireOpposing: true  // Explicitly request experts with opposing stances
            };

            console.log('Request body:', JSON.stringify(requestBody));
            console.log(`Using expert type: ${expertType || 'ai'} (from store: ${expertType})`);

            try {
                const response = await fetch(apiEndpoint, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${apiKey}`
                    },
                    body: JSON.stringify(requestBody),
                    signal: controller.signal
                });

                clearTimeout(timeoutId);

                console.log(`Response status: ${response.status}`);

                if (response.ok) {
                    const responseText = await response.text();
                    console.log('Raw API response:', responseText.substring(0, 100) + '...');

                    try {
                        const data = JSON.parse(responseText);

                        if (data.experts && Array.isArray(data.experts) && data.experts.length > 0) {
                            // Format experts properly
                            const formattedExperts = data.experts.map((expert: any, index: number) => ({
                                id: expert.id || uuidv4(),
                                name: expert.name,
                                title: expert.title || `Expert on ${topicTitle}`,
                                description: expert.description || '',
                                background: expert.background || expert.description || `Expert with knowledge in ${topicTitle}`,
                                imageUrl: expert.imageUrl || '',
                                expertise: expert.expertise || [],
                                perspective: expert.perspective || '',
                                stance: expert.stance || (index === 0 ? 'pro' : 'con'), // First expert is pro, second is con if not already assigned
                                voiceId: expert.voiceId || assignVoiceToExpert(expert.name, expert.expertise?.[0] || topicTitle) || null
                            }));

                            // Update experts in store
                            setExperts(formattedExperts);
                            setExpertsSelected(true);
                            updateStepState('expertSelection', 'success', 'Experts selected successfully!');

                            // Store the current topic in sessionStorage as a backup
                            try {
                                sessionStorage.setItem('last_debate_topic', directTopic);
                                console.log('Stored topic in sessionStorage as backup');
                            } catch (storageError) {
                                console.warn('Could not store topic in sessionStorage:', storageError);
                            }

                            // Show success toast
                            showSuccess('Experts Selected', 'Ready to start the debate!');

                            console.log('Selected experts:', formattedExperts);
                            return formattedExperts;
                        } else {
                            throw new Error('No experts returned from API');
                        }
                    } catch (parseError) {
                        console.error('Error parsing API response:', parseError);
                        throw new Error('Invalid API response format');
                    }
                } else {
                    console.error('API responded with error status:', response.status);
                    throw new Error(`API error: ${response.status}`);
                }
            } catch (fetchError) {
                console.error('Error fetching experts:', fetchError);
                throw fetchError;
            }
        } catch (error) {
            console.error('Error selecting experts:', error);
            updateStepState('expertSelection', 'error', 'Failed to select experts');

            // Create structured error object
            const appError = createError(
                'EXPERT_SELECTION_ERROR',
                'Failed to select experts for this topic',
                'high',
                true,
                { topic: directTopic }
            );
            handleError(appError);
            return;
        }
    }, [MVP_CONFIG.apiServerAvailable, expertType, setExperts, setExpertsSelected, handleError, showSuccess, createError, showWarning, updateStepState]);

    // Fetch suggested historical figures for a topic
    const fetchSuggestedHistoricalFigures = useCallback(async (topicTitle: string) => {
        setIsLoadingHistoricalFigures(true);
        updateStepState('expertSelection', 'loading', 'Finding relevant historical figures (this may take up to 45 seconds)...');

        try {
            let parsedTopicTitle = topicTitle;
            let topicArguments: any[] = [];

            // Parse topic if it's JSON
            if (typeof topicTitle === 'string' && topicTitle.startsWith('{') && topicTitle.includes('title')) {
                try {
                    const parsedTopic = JSON.parse(topicTitle);
                    parsedTopicTitle = parsedTopic.title || topicTitle;
                    if (parsedTopic.data && parsedTopic.data.arguments) {
                        topicArguments = parsedTopic.data.arguments;
                    }
                } catch (e) {
                    console.warn('Error parsing topic JSON for historical figures:', e);
                }
            }

            console.log(`Fetching historical figures for topic: "${parsedTopicTitle}"`);

            const requestBody = {
                action: 'suggest-historical-figures',
                topic: parsedTopicTitle,
                topicArguments: topicArguments,
                count: 6, // Get more options for user to choose from
                requireOpposing: true
            };

            const controller = new AbortController();
            const timeoutId = setTimeout(() => {
                console.log('Historical figures API request timing out after 90 seconds');
                controller.abort();
            }, 90000);

            const response = await fetch('/api/debate-experts', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${process.env.NEXT_PUBLIC_OPENAI_API_KEY || ''}`
                },
                body: JSON.stringify(requestBody),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (response.ok) {
                const data = await response.json();
                console.log('Historical figures response:', data);
                console.log('Number of figures returned:', data.historicalFigures?.length);

                if (data.historicalFigures && Array.isArray(data.historicalFigures) && data.historicalFigures.length > 0) {
                    // Format the historical figures
                    const formattedFigures = data.historicalFigures.map((figure: any, index: number) => ({
                        id: figure.id || uuidv4(),
                        name: figure.name,
                        title: figure.title || figure.role || `Historical Expert on ${parsedTopicTitle}`,
                        description: figure.description || '',
                        background: figure.background || figure.description || `Historical figure with expertise in ${parsedTopicTitle}`,
                        expertise: figure.expertise || [],
                        perspective: figure.perspective || '',
                        stance: figure.stance || (index % 2 === 0 ? 'pro' : 'con'), // Alternate stances
                        imageUrl: figure.imageUrl || '',
                        voiceId: figure.voiceId || assignVoiceToExpert(figure.name, figure.expertise?.[0] || parsedTopicTitle) || null,
                        timeperiod: figure.timeperiod || '', // Historical context
                        notableWorks: figure.notableWorks || [], // Their famous works/contributions
                        relevanceReason: figure.relevanceReason || '' // Why they're relevant to this topic
                    }));

                    console.log(`Formatted ${formattedFigures.length} historical figures for selection`);
                    setSuggestedHistoricalFigures(formattedFigures);
                    setShowHistoricalFigureSelection(true);
                    updateStepState('expertSelection', 'success', 'Historical figures found!');
                    showSuccess('Historical Figures Found', `Found ${formattedFigures.length} relevant historical figures for your topic`);
                } else {
                    console.warn('API returned invalid historical figures data:', data);
                    throw new Error('No historical figures returned from API');
                }
            } else {
                const errorText = await response.text();
                console.error('API error response:', errorText);
                throw new Error(`API error: ${response.status}`);
            }
        } catch (error) {
            console.error('Error fetching historical figures:', error);
            updateStepState('expertSelection', 'error', 'Failed to find historical figures');

            // Handle specific error types
            let errorMessage = 'Failed to find relevant historical figures for this topic';
            if (error instanceof Error) {
                if (error.name === 'AbortError') {
                    errorMessage = 'Request timed out while finding historical figures. Please try again with a simpler topic.';
                } else {
                    errorMessage = error.message;
                }
            }

            const appError = createError(
                'HISTORICAL_FIGURES_ERROR',
                errorMessage,
                'high',
                true,
                { topic: topicTitle }
            );
            handleError(appError);

            // Show fallback message
            showWarning('Historical Figures Not Found', 'Try a different topic or use AI Subject Experts instead');
        } finally {
            setIsLoadingHistoricalFigures(false);
        }
    }, [updateStepState, showSuccess, showWarning, createError, handleError, assignVoiceToExpert]);

    // Update the original selectExperts function to use the new version
    const selectExperts = useCallback(async () => {
        // Get current topic from store or state
        const currentTopic = topic || selectedTopic;

        if (!currentTopic || currentTopic.trim() === '') {
            updateStepState('expertSelection', 'error', 'No topic provided');
            showWarning('No Topic', 'Please enter a topic to select experts.');
            return;
        }

        // Call the implementation with the current topic
        return selectExpertsWithTopic(currentTopic);
    }, [topic, selectedTopic, updateStepState, showWarning, selectExpertsWithTopic]);

    // Generate expert responses locally
    const generateLocalExpertResponses = useCallback(async (currentExperts: Expert[], currentMessages: Message[]) => {
        console.log('Generating responses for experts:', currentExperts);

        // Create a copy of messages for safety
        const messagesCopy = [...currentMessages];
        const newMessages: Message[] = [];

        // Process each expert
        await Promise.all(currentExperts.map(async (expert) => {
            try {
                console.log(`Generating response for ${expert.name}`);

                // Create a direct fetch request to the API
                const response = await fetch('/api/debate/response', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        expert,
                        messages: messagesCopy,
                        topic: topic || selectedTopic || 'General debate'
                    }),
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`API request failed: ${response.status}`);
                }

                const data = await response.json();

                console.log(`Response for ${expert.name}:`, data);

                // Create the new message
                const newMessage: Message = {
                    id: uuidv4(),
                    role: 'assistant',
                    content: data.response,
                    speaker: expert.name,
                    timestamp: new Date().toISOString()
                };

                // Add to our collection of new messages
                newMessages.push(newMessage);

            } catch (error) {
                console.error(`Error generating response for ${expert.name}:`, error);

                // Return a fallback response instead of throwing
                const errorMessage: Message = {
                    id: uuidv4(),
                    role: 'assistant',
                    content: `I apologize, but there was an error generating my response as ${expert.name}. ${error instanceof Error ? error.message : 'Unknown error'}`,
                    speaker: expert.name,
                    timestamp: new Date().toISOString()
                };

                // Add error message to our collection
                newMessages.push(errorMessage);
            }
        }));

        // Only update the messages state if we have new messages
        if (newMessages.length > 0) {
            console.log('Adding new messages to state:', newMessages);

            // Add all the new messages to the current messages
            const updatedMessages = [...currentMessages, ...newMessages];

            // Update the store with all messages at once
            setMessages(updatedMessages);

            // If voice synthesis is enabled, generate voices
            if (useVoiceSynthesis) {
                await handleVoiceSynthesis(newMessages, currentExperts);
            }
        }
    }, [topic, selectedTopic, useVoiceSynthesis, handleVoiceSynthesis, setMessages]);

    // Handle expert type selection
    const handleExpertTypeSelect = useCallback(async (type: 'historical' | 'ai') => {
        console.log(`Expert type selected: ${type}`);
        // Make sure we update both the store and the local state
        setExpertType(type);
        setSelectedParticipantType(type);

        // Show a confirmation message
        showInfo('Expert Type Selected', `${type === 'historical' ? 'Historical Figures' : 'AI Subject Experts'} selected`);

        // If we already have a topic, we can re-select experts based on the new type
        if (topic || selectedTopic) {
            // Clear existing experts
            setExperts([]);
            // Generate new experts with the selected type
            await selectExperts();
        }
    }, [setExpertType, setSelectedParticipantType, showInfo, topic, selectedTopic, setExperts, selectExperts]);

    // Handle topic selection from extracted topics
    const handleTopicSelect = useCallback((topicTitle: string, topicData?: any) => {
        console.log('Topic selected:', topicTitle, 'with data:', topicData);

        // Make sure the title is not empty
        if (!topicTitle || topicTitle.trim() === '') {
            showWarning('Invalid Topic', 'Please select a valid topic');
            return;
        }

        // Create a topic object with consistent structure
        const topicWithMetadata = topicData ? {
            title: topicTitle,
            data: topicData
        } : {
            title: topicTitle,
            data: {
                arguments: [
                    `${topicTitle} is an important topic to discuss.`,
                    `There are multiple perspectives on ${topicTitle}.`,
                    `Understanding ${topicTitle} requires careful consideration of evidence.`
                ]
            }
        };

        // Update all topic state synchronously to ensure consistency
        const topicJSON = JSON.stringify(topicWithMetadata);

        // Update the user topic state
        setUserTopic(topicTitle);

        // Update the selected topic state
        setSelectedTopic(topicTitle);

        // Store the complete topic data in the store
        setTopic(topicJSON);

        // Log the values we're setting to confirm
        console.log('Setting topic values:');
        console.log('- User Topic:', topicTitle);
        console.log('- Selected Topic:', topicTitle);
        console.log('- Topic in store (JSON):', topicJSON);

        // Ensure participant type is set if not already selected
        // Default to 'ai' experts when selecting from Suggested Debate Topics
        if (!selectedParticipantType) {
            setSelectedParticipantType('ai');
            setExpertType('ai');
        }

        // Handle different flows based on expert type
        if (selectedParticipantType === 'historical') {
            console.log('Historical expert type detected - fetching suggested historical figures');
            // For historical figures, fetch suggestions for user to choose from
            fetchSuggestedHistoricalFigures(topicJSON);
        } else {
            console.log('AI expert type detected - proceeding with automatic expert generation');
            // For AI experts, continue with automatic generation (existing behavior)
            // Ensure expert selection is shown after topic is selected
            setShowExpertSelection(true);
            setExpertsLoading(false);
        }
    }, [setUserTopic, setSelectedTopic, setTopic, selectedParticipantType, setExpertType, setShowExpertSelection, setExpertsLoading, showWarning, fetchSuggestedHistoricalFigures]);

    // Handle historical figure selection/deselection
    const handleHistoricalFigureToggle = useCallback((figureId: string) => {
        setSelectedHistoricalFigures(prev => {
            if (prev.includes(figureId)) {
                // Remove if already selected
                return prev.filter(id => id !== figureId);
            } else {
                // Add if not selected (limit to 2)
                if (prev.length >= 2) {
                    showWarning('Selection Limit', 'You can select a maximum of 2 historical figures');
                    return prev;
                }
                return [...prev, figureId];
            }
        });
    }, [showWarning]);

    // Handle finalizing historical figure selection and starting debate
    const handleConfirmHistoricalFigures = useCallback(() => {
        if (selectedHistoricalFigures.length < 2) {
            showWarning('Selection Required', 'Please select at least 2 historical figures to debate');
            return;
        }

        // Get the selected figures from the suggested list
        const selectedFigures = suggestedHistoricalFigures.filter(figure =>
            selectedHistoricalFigures.includes(figure.id)
        );

        if (selectedFigures.length !== selectedHistoricalFigures.length) {
            showError(createError(
                'SELECTION_ERROR',
                'Error with historical figure selection',
                'medium',
                true
            ));
            return;
        }

        // Format the figures as Expert objects for the debate
        const formattedExperts = selectedFigures.map((figure, index) => ({
            id: figure.id,
            name: figure.name,
            title: figure.title,
            description: figure.description,
            background: figure.background,
            imageUrl: figure.imageUrl || '',
            expertise: figure.expertise,
            perspective: figure.perspective,
            stance: figure.stance || (index === 0 ? 'pro' : 'con'),
            voiceId: figure.voiceId || assignVoiceToExpert(figure.name, figure.expertise?.[0] || 'history') || null
        }));

        console.log('Selected historical figures for debate:', formattedExperts);

        // Set the experts in the store
        setExperts(formattedExperts);
        setExpertsSelected(true);

        // Hide the selection UI
        setShowHistoricalFigureSelection(false);

        // Update state to show debate is ready
        updateStepState('expertSelection', 'success', 'Historical figures selected!');
        showSuccess('Historical Figures Selected', `${formattedExperts.map(e => e.name).join(' and ')} are ready to debate!`);

    }, [selectedHistoricalFigures, suggestedHistoricalFigures, showWarning, showError, createError, setExperts, setExpertsSelected, setShowHistoricalFigureSelection, updateStepState, showSuccess, assignVoiceToExpert]);

    // Initialize debate after topic selection
    const initializeDebateWithTopic = useCallback(async () => {
        console.log('### DEBUG: initializeDebateWithTopic called ###');

        // Get all relevant topic information (prefer local state if store not updated yet)
        const currentTopicFromStore = topic;
        const currentTopicFromState = selectedTopic;

        console.log('- Topic from store:', currentTopicFromStore);
        console.log('- Selected Topic state:', currentTopicFromState);
        console.log('- User Topic state:', userTopic);
        console.log('- Participant Type:', selectedParticipantType);
        console.log('- Experts Length:', experts.length);
        console.log('- ExpertsLoading:', expertsLoading);
        console.log('- ExpertsSelected:', expertsSelected);

        // Use store topic first, fall back to selected topic if store is not yet updated
        // This ensures we always have a topic value to work with
        const effectiveTopic = currentTopicFromStore || (currentTopicFromState ? JSON.stringify({
            title: currentTopicFromState,
            data: {
                arguments: [`${currentTopicFromState} is an important topic to discuss.`]
            }
        }) : null);

        if (!effectiveTopic) {
            console.warn("InitializeDebate called without a topic.");
            return; // Should not happen if useEffect is set up correctly
        }

        const newDebateId = uuidv4();
        updateStepState('topicInitialization', 'loading', 'Initializing debate...');

        try {
            // Initialize directly with the generated debateId and effective topic
            initializeDebate(newDebateId, effectiveTopic);
            updateStepState('topicInitialization', 'success', 'Debate initialized!');
            showSuccess('Debate Initialized', 'Generating expert profiles...');

            // If no experts are loaded, force expert generation
            if (experts.length === 0) {
                setExpertsLoading(true);

                try {
                    // Call selectExperts to generate experts through the API
                    // Pass the effective topic directly to the function to avoid dependency on store state
                    const expertPromise = selectExpertsWithTopic(effectiveTopic);

                    // Add a timeout to prevent infinite loading
                    const timeoutPromise = new Promise((_, reject) => {
                        setTimeout(() => reject(new Error('Expert generation timed out')), 20000); // 20-second timeout
                    });

                    await Promise.race([expertPromise, timeoutPromise]);

                    // Double-check that experts were loaded after API call completed
                    if (experts.length === 0) {
                        // Show error since we don't want to use mock experts
                        showWarning('Expert Generation Failed', 'Please try again or try a different topic');
                    }
                } catch (expertError) {
                    showWarning('Expert Generation Failed', 'Please try again with a different topic');
                } finally {
                    setExpertsLoading(false);
                }
            }

            updateStepState('expertLoading', 'success', 'Experts selected successfully!');

        } catch (error) {
            // Always clear loading states
            setExpertsLoading(false);

            const appError = createError(
                'DEBATE_INITIALIZATION_ERROR',
                'Failed to initialize debate',
                'high',
                true,
                { topic: effectiveTopic, expertType: selectedParticipantType || 'ai' }
            );
            handleError(appError);
            updateStepState('topicInitialization', 'error', 'Failed to initialize debate');
        }
    }, [topic, selectedTopic, userTopic, selectedParticipantType, experts.length, expertsLoading, expertsSelected, initializeDebate, showSuccess, handleError, updateStepState, selectExpertsWithTopic, showWarning, createError]);

    // Handle starting the discussion
    const startDiscussion = useCallback(async () => {
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

            // Create an array of message objects first
            const newMessages = responses.map(resp => ({
                id: uuidv4(),
                timestamp: new Date().toISOString(),
                role: 'assistant' as const,
                content: resp.response,
                speaker: resp.expertName,
                speakerId: resp.expertId
            }));

            // Log the messages we're about to add
            console.log('Adding messages to state:', newMessages);

            // Then set them all at once instead of in a forEach loop
            setMessages(newMessages);

            updateStepState('responseGeneration', 'success', 'Discussion started!');

        } catch (error: any) {
            console.error('Error starting discussion:', error);
            setErrorMessage(`Failed to start the discussion: ${error?.message || 'Unknown error'}`);
            updateStepState('responseGeneration', 'error', 'Failed to start the discussion');
        } finally {
            setIsGenerating(false);
        }
    }, [experts, isGenerating, topic, selectedTopic, setIsGenerating, updateStepState, setMessages, useVoiceSynthesis, handleVoiceSynthesis, setErrorMessage]);

    // Handle user input
    const handleUserInput = useCallback(async (text: string) => {
        if (text.trim() && !isGenerating && experts.length > 0) {
            // Create user message
            const userMessage: Message = {
                id: `msg_user_${Date.now()}`,
                role: 'user',
                content: text,
                speaker: 'You',
                timestamp: new Date().toISOString()
            };

            // Get current messages
            const currentMessages = [...messages];

            // Add user message to the messages array
            const updatedMessages = [...currentMessages, userMessage];

            // Set messages with user message included
            setMessages(updatedMessages);

            setIsGenerating(true);
            updateStepState('responseGeneration', 'loading', 'Generating responses...');

            try {
                // Use our local function to generate expert responses
                await generateLocalExpertResponses(experts, updatedMessages);

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
    }, [messages, isGenerating, experts, setMessages, setIsGenerating, updateStepState, generateLocalExpertResponses, setErrorMessage]);

    // Scroll to bottom when messages change
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Handle file upload
    const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
        event.preventDefault();

        // Clear previous loading state
        setLoadingState('');

        const file = event.target.files?.[0];
        if (!file) {
            return;
        }

        // Generate a throttle key using the file name and size
        const throttleKey = `document-analyze-${file.name}-${file.size}`;
        const now = Date.now();
        const lastRequestTime = requestTracker.recentRequests.get(throttleKey);

        // Check if this exact file was recently uploaded (global check, not per endpoint)
        if (lastRequestTime && (now - lastRequestTime < 5000)) {
            // Update UI to show warning about duplicate
            setFileStatus({ message: `Recently processed: ${file.name} - using cached results`, className: 'text-yellow-400' });

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

        try {
            let success = false;
            let responseData = null;
            const formData = new FormData();
            formData.append('file', file);

            // Skip API calls completely if we know the server is unavailable
            if (!MVP_CONFIG.apiServerAvailable) {
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

                // Instead of using mock topics, show an error
                showError(createError(
                    'API_ERROR',
                    'Document analysis failed: Could not retrieve topics from the server.',
                    'medium',
                    true,
                    { fileName: file.name }
                ));
                setLoadingState('');
                setExtractedTopics([]); // Ensure topics are cleared
                setFileStatus({ message: `Analysis failed for: ${file.name}`, className: 'text-red-400' });
                return;
            }

            // Ensure topics data is valid and formatted correctly
            if (responseData.topics && Array.isArray(responseData.topics)) {
                setExtractedTopics(responseData.topics);

                // Update UI to show success
                setFileStatus({ message: `Successfully analyzed: ${file.name}`, className: 'text-green-400' });
            } else {
                console.warn("Document analysis returned invalid topics data structure:", responseData);
                setExtractedTopics([]);

                // Update UI to show failure
                setFileStatus({ message: `Analysis failed: ${file.name}`, className: 'text-red-400' });

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
            setFileStatus({ message: `Error processing file: ${file.name}`, className: 'text-red-400' });

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
    }, [requestTracker.recentRequests, setFileStatus, showInfo, extractedTopics, showWarning, setLoadingState, API_CONFIG?.baseUrl, MVP_CONFIG.apiServerAvailable, setExtractedTopics, showError, createError, handleError]);

    // Trigger file input click
    const triggerFileUpload = useCallback(() => {
        console.log("Upload button clicked, triggering file input");

        // Reset any previous file selection display
        setFileStatus({ message: 'No file selected', className: 'text-gray-400' });

        // Reset the file input value to allow selecting the same file again
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }

        fileInputRef.current?.click();
    }, [setFileStatus]);

    // Toggle content analyzer
    const toggleContentAnalyzer = useCallback(() => {
        setIsContentAnalyzerOpen(!isContentAnalyzerOpen);
    }, [isContentAnalyzerOpen, setIsContentAnalyzerOpen]);

    // Function to handle ending the debate and showing summary
    const handleEndDebate = useCallback(() => {
        setShowSummary(true);
        // Scroll to the top to show the summary
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }, [setShowSummary]);

    // Function to handle starting a new debate
    const handleStartNewDebate = useCallback(() => {
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

        // Reset historical figure selection states
        setSuggestedHistoricalFigures([]);
        setSelectedHistoricalFigures([]);
        setIsLoadingHistoricalFigures(false);
        setShowHistoricalFigureSelection(false);

        // Reset steps state
        Object.keys(steps).forEach(key => {
            updateStepState(key as keyof typeof steps, 'idle', '');
        });

        // Scroll to the top
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }, [reset, setShowSummary, setUserTopic, setErrorMessage, setLoadingState, setExpertsSelected, setShowExpertSelection, setExpertsLoading, setIsLoading, setSelectedParticipantType, setExtractedTopics, setIsContentAnalyzerOpen, setSuggestedHistoricalFigures, setSelectedHistoricalFigures, setIsLoadingHistoricalFigures, setShowHistoricalFigureSelection, steps, updateStepState]);

    // Check for reset parameter and trigger reset if present
    useEffect(() => {
        // Check if URL contains reset=true parameter
        if (typeof window !== 'undefined') {
            const urlParams = new URLSearchParams(window.location.search);
            const shouldReset = urlParams.get('reset');
            if (shouldReset === 'true') {
                handleStartNewDebate();
                // Remove the reset parameter from URL to prevent repeated resets
                const url = new URL(window.location.href);
                url.searchParams.delete('reset');
                window.history.replaceState({}, '', url.toString());
            }
        }
    }, [pathname, handleStartNewDebate]);

    // Add effect to load existing debate data if provided
    useEffect(() => {
        if (existingDebate) {
            // Load existing debate data
            // This is a placeholder and should be replaced with actual implementation
            console.log('Loading existing debate data');
        }
    }, [existingDebate]);

    // useEffect hook to initialize the debate when topic and type are ready
    useEffect(() => {
        // Check if topic and type are set, and if we haven't already started loading/loaded experts
        // Also check that debateId is not set (i.e., not loading an existing debate)
        // SKIP automatic initialization for historical experts - they use manual selection
        if (topic && selectedParticipantType && !debateId && experts.length === 0 && !isGenerating && !expertsLoading) {
            if (selectedParticipantType === 'historical') {
                console.log("Skipping automatic expert generation for historical figures - using manual selection");
                return; // Skip automatic initialization for historical figures
            }

            console.log("useEffect triggered: Initializing debate with AI experts");
            initializeDebateWithTopic();
        }
    }, [topic, selectedParticipantType, experts.length, debateId, isGenerating, expertsLoading, initializeDebateWithTopic]);

    // Main render
    return (
        <div className="flex flex-col bg-gray-700 h-full max-w-4xl mx-auto">
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
                                    onClick={() => {
                                        console.log("Historical Figures button clicked");
                                        handleExpertTypeSelect('historical');
                                    }}
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
                                    onClick={() => {
                                        console.log("AI Subject Experts button clicked");
                                        handleExpertTypeSelect('ai');
                                    }}
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
                                                // Then call handler for side effects
                                                handleTopicSelect(userTopic, topicData);
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
                                    <ContentUploader fileStatus={fileStatus} />
                                </div>
                            </div>

                            {/* Suggested Debate Topics - Replacing the former Extracted Topics section */}
                            {extractedTopics.length > 0 && (
                                <div className="mt-6">
                                    <h3 className="text-lg font-semibold mb-4">Suggested Debate Topics</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {extractedTopics.map((extractedTopic, index) => (
                                            <button
                                                key={index}
                                                onClick={() => {
                                                    // First ensure the topic is properly set in all states
                                                    // Then call handler for side effects
                                                    handleTopicSelect(extractedTopic.title, extractedTopic);
                                                }}
                                                className={`card p-4 text-left hover:bg-accent transition-colors ${selectedTopic === extractedTopic.title ? 'border-2 border-primary' : 'border border-border'}`}
                                            >
                                                <div className="flex items-center justify-between mb-2">
                                                    <h4 className="font-medium text-md">{extractedTopic.title}</h4>
                                                    <span className="text-xs px-2 py-1 rounded-full bg-muted text-foreground">
                                                        {Math.round(extractedTopic.confidence * 100)} confidence
                                                    </span>
                                                </div>
                                                <div className="my-2">
                                                    <div className="text-sm text-muted-foreground mb-1">Key arguments:</div>
                                                    <ul className="list-disc list-inside text-xs space-y-1 text-muted-foreground">
                                                        {extractedTopic.arguments.slice(0, 2).map((arg, i) => (
                                                            <li key={i} className="truncate">{arg}</li>
                                                        ))}
                                                        {extractedTopic.arguments.length > 2 && (
                                                            <li className="text-muted-foreground">+{extractedTopic.arguments.length - 2} more arguments</li>
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

                    {/* Historical Figure Selection */}
                    {showHistoricalFigureSelection && selectedParticipantType === 'historical' && topic && (
                        <div className="space-y-6 mt-8">
                            <div className="text-center">
                                <h3 className="text-2xl font-bold text-white mb-2">Select Historical Figures</h3>
                                <p className="text-gray-300">Choose 2 historical figures who are relevant to your topic to debate</p>
                                <p className="text-sm text-gray-400 mt-1">
                                    Selected: {selectedHistoricalFigures.length}/2
                                </p>
                            </div>

                            {isLoadingHistoricalFigures ? (
                                <div className="flex flex-col items-center justify-center py-12">
                                    <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
                                    <p className="text-white text-center font-semibold">Finding relevant historical figures...</p>
                                    <p className="text-sm text-yellow-400 mt-2 text-center">⏳ This may take up to 45 seconds while we search historical records</p>
                                    <p className="text-xs text-gray-400 mt-1 text-center">We're analyzing your topic to find the most relevant historical experts with opposing viewpoints</p>
                                </div>
                            ) : (
                                <>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {suggestedHistoricalFigures.map((figure) => {
                                            const isSelected = selectedHistoricalFigures.includes(figure.id);
                                            return (
                                                <button
                                                    key={figure.id}
                                                    onClick={() => handleHistoricalFigureToggle(figure.id)}
                                                    className={cn(
                                                        "p-4 rounded-lg border text-left transition-all hover:shadow-lg",
                                                        isSelected
                                                            ? "border-primary bg-primary/10 ring-2 ring-primary"
                                                            : "border-gray-600 bg-gray-800 hover:bg-gray-700",
                                                        figure.stance === 'pro'
                                                            ? 'border-l-4 border-l-green-500'
                                                            : 'border-l-4 border-l-red-500'
                                                    )}
                                                >
                                                    <div className="flex items-start justify-between mb-2">
                                                        <h4 className="font-semibold text-white text-lg">{figure.name}</h4>
                                                        {isSelected && (
                                                            <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                                                                <span className="text-white text-xs">✓</span>
                                                            </div>
                                                        )}
                                                    </div>

                                                    <p className="text-sm text-gray-300 mb-2">{figure.title}</p>

                                                    {figure.description && (
                                                        <p className="text-xs text-gray-400 mb-3 line-clamp-3">{figure.description}</p>
                                                    )}

                                                    {figure.expertise && figure.expertise.length > 0 && (
                                                        <div className="mb-2">
                                                            <p className="text-xs text-gray-500 mb-1">Expertise:</p>
                                                            <div className="flex flex-wrap gap-1">
                                                                {figure.expertise.slice(0, 3).map((skill, index) => (
                                                                    <span key={index} className="text-xs px-2 py-1 bg-gray-700 text-gray-300 rounded">
                                                                        {skill}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}

                                                    <div className="flex items-center justify-between mt-3">
                                                        <span className={cn(
                                                            "text-xs px-2 py-1 rounded-full",
                                                            figure.stance === 'pro'
                                                                ? "bg-green-900/50 text-green-300 border border-green-700"
                                                                : "bg-red-900/50 text-red-300 border border-red-700"
                                                        )}>
                                                            {figure.stance === 'pro' ? 'Supporting' : 'Opposing'}
                                                        </span>

                                                        {(figure as any).timeperiod && (
                                                            <span className="text-xs text-gray-500">
                                                                {(figure as any).timeperiod}
                                                            </span>
                                                        )}
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>

                                    {/* Action buttons */}
                                    <div className="flex justify-center gap-4 mt-6">
                                        <Button
                                            variant="outline"
                                            onClick={() => {
                                                setShowHistoricalFigureSelection(false);
                                                setSuggestedHistoricalFigures([]);
                                                setSelectedHistoricalFigures([]);
                                            }}
                                        >
                                            <ArrowLeft className="mr-2 h-4 w-4" />
                                            Back to Topic Selection
                                        </Button>

                                        <Button
                                            onClick={handleConfirmHistoricalFigures}
                                            disabled={selectedHistoricalFigures.length < 2}
                                            className="bg-green-600 hover:bg-green-700"
                                            size="lg"
                                        >
                                            Start Debate with Selected Figures
                                            {selectedHistoricalFigures.length > 0 && (
                                                <span className="ml-2">({selectedHistoricalFigures.length}/2)</span>
                                            )}
                                        </Button>
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {/* Meet Experts Button */}
                    {topic && !experts.length && !showExpertSelection && !showHistoricalFigureSelection && (
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

                                            {/* Add API test button */}
                                            <Button
                                                onClick={async () => {
                                                    console.log("Testing API endpoints directly");

                                                    // Show that we're testing
                                                    showInfo('API Test', 'Testing API endpoints for expert generation...');

                                                    // Get current topic
                                                    const currentTopic = topic || selectedTopic;
                                                    if (!currentTopic) {
                                                        console.warn('Missing topic, cannot test API');
                                                        showWarning('Missing Topic', 'Please enter a topic first');
                                                        return;
                                                    }

                                                    // Parse topic data
                                                    let topicTitle = currentTopic;
                                                    let topicArguments: any[] = [];

                                                    try {
                                                        if (typeof currentTopic === 'string' && currentTopic.startsWith('{') && currentTopic.includes('title')) {
                                                            const parsedTopic = JSON.parse(currentTopic);
                                                            topicTitle = parsedTopic.title;

                                                            if (parsedTopic.data && parsedTopic.data.arguments) {
                                                                topicArguments = parsedTopic.data.arguments;
                                                            }
                                                        }
                                                    } catch (e) {
                                                        console.warn('Failed to parse topic data, using as plain text');
                                                    }

                                                    console.log(`Testing with topic: "${topicTitle}"`);

                                                    // Get API key from environment
                                                    const apiKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY || '';
                                                    console.log(`Using API key: ${apiKey ? 'Available (starting with ' + apiKey.substring(0, 3) + '...)' : 'Not available'}`);

                                                    // API endpoints to test
                                                    const apiEndpoints = [
                                                        '/api/debate-experts',
                                                        '/api/test-openai-real',
                                                        '/api/debate',
                                                        '/api/debate/experts'
                                                    ];

                                                    // Define the results interface
                                                    interface ApiTestResult {
                                                        status: string;
                                                        response: string | null;
                                                        error: string | null;
                                                        data?: any;
                                                        rawResponse?: string;
                                                    };

                                                    const results: Record<string, ApiTestResult> = {};

                                                    // Test each endpoint
                                                    for (const endpoint of apiEndpoints) {
                                                        console.log(`Testing endpoint: ${endpoint}`);

                                                        results[endpoint] = { status: 'Testing...', response: null, error: null, data: undefined, rawResponse: undefined };

                                                        try {
                                                            const controller = new AbortController();
                                                            const timeoutId = setTimeout(() => controller.abort(), 10000); // 10-second timeout

                                                            // Create appropriate request body for each endpoint
                                                            let requestBody;

                                                            if (endpoint === '/api/debate') {
                                                                requestBody = {
                                                                    topic: topicTitle,
                                                                    expert: {
                                                                        name: "Test Expert",
                                                                        stance: "pro",
                                                                        background: "Testing API connectivity",
                                                                        expertise: ["API Testing"]
                                                                    }
                                                                };
                                                            } else if (endpoint === '/api/test-openai-real') {
                                                                // This is a GET endpoint, so we'll use fetch with GET method
                                                                clearTimeout(timeoutId);
                                                                const response = await fetch(endpoint, {
                                                                    method: 'GET',
                                                                    signal: controller.signal
                                                                });

                                                                const responseText = await response.text();
                                                                console.log(`Raw response from ${endpoint} (first 100 chars):`, responseText.substring(0, 100) + '...');

                                                                results[endpoint].status = `HTTP ${response.status}`;
                                                                if (response.ok) {
                                                                    try {
                                                                        const data = JSON.parse(responseText);
                                                                        results[endpoint].response = `Success: OpenAI API ${data.success ? 'is working' : 'failed'}`;
                                                                        results[endpoint].data = data;
                                                                    } catch (parseError) {
                                                                        results[endpoint].error = `Parse error: ${parseError instanceof Error ? parseError.message : String(parseError)}`;
                                                                    }
                                                                } else {
                                                                    results[endpoint].error = responseText.substring(0, 200);
                                                                }

                                                                continue; // Skip the rest of the loop for this endpoint
                                                            } else if (endpoint === '/api/debate-experts') {
                                                                requestBody = {
                                                                    action: 'select-experts',
                                                                    topic: topicTitle,
                                                                    expertType: expertType || 'ai',
                                                                    count: 2
                                                                };
                                                            } else {
                                                                // Default for other endpoints
                                                                requestBody = {
                                                                    action: 'select-experts',
                                                                    topic: topicTitle,
                                                                    expertType: expertType || 'ai',
                                                                    count: 2,
                                                                    arguments: topicArguments
                                                                };
                                                            }

                                                            console.log(`Request body for ${endpoint}:`, JSON.stringify(requestBody));

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

                                                            console.log(`Response status from ${endpoint}: ${response.status}`);
                                                            results[endpoint].status = `HTTP ${response.status}`;

                                                            if (response.ok) {
                                                                const responseText = await response.text();
                                                                console.log(`Raw response from ${endpoint}:`, responseText.substring(0, 100) + '...');

                                                                try {
                                                                    const data = JSON.parse(responseText);
                                                                    results[endpoint].response = `Success: ${data.experts ? data.experts.length + ' experts' : 'No experts'} returned`;
                                                                    results[endpoint].data = data;
                                                                } catch (parseError: unknown) {
                                                                    console.error(`Error parsing response from ${endpoint}:`, parseError);
                                                                    results[endpoint].error = `Parse error: ${parseError instanceof Error ? parseError.message : String(parseError)}`;
                                                                    results[endpoint].rawResponse = responseText.substring(0, 200) + '...';
                                                                }
                                                            } else {
                                                                try {
                                                                    const errorText = await response.text();
                                                                    console.warn(`API error details from ${endpoint}:`, errorText);
                                                                    results[endpoint].error = errorText.substring(0, 200) + '...';
                                                                } catch (err: unknown) {
                                                                    results[endpoint].error = `Could not read error response: ${err instanceof Error ? err.message : String(err)}`;
                                                                }
                                                            }
                                                        } catch (endpointError: unknown) {
                                                            console.error(`Error with endpoint ${endpoint}:`, endpointError);
                                                            results[endpoint].status = 'Failed';
                                                            results[endpoint].error = endpointError instanceof Error ? endpointError.message : String(endpointError);
                                                        }
                                                    }

                                                    // Format results for display
                                                    let resultsFormatted = 'API Endpoint Tests:\n\n';
                                                    for (const endpoint of apiEndpoints) {
                                                        resultsFormatted += `${endpoint}:\n`;
                                                        resultsFormatted += `  Status: ${results[endpoint].status}\n`;
                                                        if (results[endpoint].response) {
                                                            resultsFormatted += `  Response: ${results[endpoint].response}\n`;
                                                        }
                                                        if (results[endpoint].error) {
                                                            resultsFormatted += `  Error: ${results[endpoint].error}\n`;
                                                        }
                                                        resultsFormatted += '\n';
                                                    }

                                                    console.log(resultsFormatted);

                                                    // Show results in an alert
                                                    alert(resultsFormatted);
                                                }}
                                                variant="outline"
                                                size="sm"
                                                className="mt-4"
                                            >
                                                Test API Endpoints
                                            </Button>

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
                                                                                lastError = new Error(`Parse error: ${parseError instanceof Error ? parseError.message : String(parseError)}`); // Check type before accessing message
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
