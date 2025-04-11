"use client";

import React, { useState, useRef, useEffect, useCallback, ChangeEvent, FormEvent } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { ExpertCard } from '@/components/debate/ExpertCard';
import { MessageBubble } from '@/components/debate/MessageBubble';
import { UserInput } from '@/components/debate/UserInput';
import { ExpertTypeSelector } from '@/components/debate/ExpertTypeSelector';
import { Button } from '@/components/ui/button';
import { useDebateStore } from '@/lib/store';
import { Expert } from '@/types/expert';
import { Message } from '@/types/message';
import { MVP_CONFIG } from '@/lib/config';
import { useToast } from "@/components/ui/use-toast"
import { Input } from '@/components/ui/input';
import { useSession } from 'next-auth/react';

type DebateStep = 'topicSelection' | 'expertTypeSelection' | 'expertSelection' | 'responseGeneration' | 'discussion' | 'finished';
type StepStatus = 'idle' | 'loading' | 'success' | 'error';
interface StepState {
    step: DebateStep;
    status: StepStatus;
    message?: string;
}

interface UserInputProps {
    onSubmit: (text: string) => void;
    disabled?: boolean;
}

interface MessageBubbleProps {
    message: Message;
    experts: Expert[];
}

// Assuming mockExperts is correctly exported from config or use local mock
// Import might be incorrect, relying on local mock definition below
// import { MVP_CONFIG, mockExperts as importedMockExperts } from '@/lib/config'; 
// --- Mock implementations for missing/renamed imports --- 
// Define mockExperts locally as it seems unavailable from config
const mockExperts: Expert[] = [{ id: 'mock1', name: 'Mock Expert 1', type: 'ai', background: 'Mock BG', expertise: ['mocking'], stance: 'pro' }];
const createError = (code: string, message: string, level: string, retry?: boolean, details?: string) => ({ code, message, level, retry, details });
const API_CONFIG = MVP_CONFIG; // Alias for consistency if needed
const requestTracker = { recentRequests: new Map(), addRequest: (_key: string) => { } }; // Mock tracker, accept key but ignore it
// --- End Mock implementations --- 

export function DebatePanel() {
    const { data: session } = useSession();
    const apiKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY || '';

    const {
        topic,
        experts,
        messages,
        expertType,
        setTopic,
        setExperts,
        setExpertType,
        addMessage,
        setMessages,
        error: storeError,
        setError,
        setUserStance
    } = useDebateStore();

    const [selectedTopic, setSelectedTopic] = useState<string | null>(topic || null);
    const [isGenerating, setIsGenerating] = useState<boolean>(false);
    const [expertsLoading, setExpertsLoading] = useState<boolean>(false);
    const [expertsSelected, setExpertsSelected] = useState<boolean>(experts.length > 0);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [infoMessage, setInfoMessage] = useState<string | null>(null);
    const [warningMessage, setWarningMessage] = useState<string | null>(null);
    const [loadingState, setLoadingState] = useState<string>('');
    const [extractedTopics, setExtractedTopics] = useState<{ title: string, confidence: number, arguments: string[] }[] | null>(null);
    const [stepStates, setStepStates] = useState<Record<DebateStep, StepState>>({
        topicSelection: { step: 'topicSelection', status: topic ? 'success' : 'idle' },
        expertTypeSelection: { step: 'expertTypeSelection', status: expertType ? 'success' : 'idle' },
        expertSelection: { step: 'expertSelection', status: experts.length > 0 ? 'success' : 'idle' },
        responseGeneration: { step: 'responseGeneration', status: 'idle' },
        discussion: { step: 'discussion', status: messages.length > 0 ? 'success' : 'idle' },
        finished: { step: 'finished', status: 'idle' }
    });
    const [userInput, setUserInput] = useState('');
    const [manualTopicInput, setManualTopicInput] = useState('');

    const messagesEndRef = useRef<null | HTMLDivElement>(null);
    const { toast } = useToast();

    const showToast = useCallback((variant: "default" | "destructive", title: string, description: string) => {
        toast({ variant, title, description });
    }, [toast]);
    const showInfo = useCallback((title: string, description: string) => showToast("default", title, description), [showToast]);
    const showWarning = useCallback((title: string, description: string) => showToast("destructive", title, description), [showToast]);
    const showError = useCallback((error: ReturnType<typeof createError>) => {
        console.error("Displaying Error:", error);
        setErrorMessage(`${error.code}: ${error.message}${error.details ? ` (${error.details})` : ''}`);
        showToast("destructive", error.code || "Error", error.message);
    }, [showToast]);
    const updateStepState = (step: DebateStep, status: StepStatus, message?: string) => {
        setStepStates(prev => ({
            ...prev,
            [step]: { ...prev[step], status, message: message || prev[step].message }
        }));
        if (status === 'loading' && message) setLoadingState(message);
        if (status === 'success' && message) setInfoMessage(message);
        if (status === 'error' && message) setWarningMessage(message);
    };

    const debouncedSelectExperts = useCallback(
        debounce(async (currentTopic: string, currentExpertType: 'historical' | 'ai') => {
            if (!currentTopic) return;
            console.log(`Debounced expert selection triggered for topic: ${currentTopic}, type: ${currentExpertType}`);
            updateStepState('expertSelection', 'loading', 'Finding experts...');
            setExpertsLoading(true);
            setExpertsSelected(false);

            try {
                const apiEndpoint = '/api/debate-experts';
                const requestBody = {
                    action: 'select-experts',
                    topic: currentTopic,
                    expertType: currentExpertType,
                    count: 2,
                };

                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 20000);

                const response = await fetch(apiEndpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
                    body: JSON.stringify(requestBody),
                    signal: controller.signal
                });
                clearTimeout(timeoutId);

                if (response.ok) {
                    const data = await response.json();
                    if (data.experts && data.experts.length > 0) {
                        const formattedExperts: Expert[] = data.experts.map((expert: any) => ({
                            id: expert.id || uuidv4(),
                            name: expert.name || 'Unnamed Expert',
                            background: expert.background || 'No background available.',
                            expertise: expert.expertise || [],
                            stance: expert.stance || 'neutral',
                            type: expert.type || currentExpertType,
                            voiceId: expert.voiceId
                        }));
                        setExperts(formattedExperts);
                        setExpertsSelected(true);
                        updateStepState('expertSelection', 'success', 'Experts selected!');
                    } else {
                        throw new Error('API did not return valid experts.');
                    }
                } else {
                    const errorText = await response.text();
                    throw new Error(`API Error ${response.status}: ${errorText.substring(0, 150)}`);
                }

            } catch (error: any) {
                console.error('Error selecting experts:', error);
                updateStepState('expertSelection', 'error', `Failed: ${error.message}`);
                if (process.env.NODE_ENV !== 'production') {
                    showWarning('Using Sample Experts', 'Failed to get real experts. Using samples.');
                    setExperts(mockExperts.map((e: Expert) => ({ ...e, id: e.id || uuidv4() })));
                    setExpertsSelected(true);
                    updateStepState('expertSelection', 'success', 'Sample experts loaded.');
                } else {
                    showError(createError('EXPERT_SELECTION_FAILED', error.message, 'high'));
                }
            } finally {
                setExpertsLoading(false);
            }
        }, 500),
        [apiKey, setExperts, showError, showWarning, updateStepState]
    );
    useEffect(() => {
        console.log(`Topic or Expert Type changed. Topic: ${selectedTopic}, Type: ${expertType}`);
        if (selectedTopic && expertType) {
            setExperts([]);
            setExpertsSelected(false);
            debouncedSelectExperts(selectedTopic, expertType);
        }
    }, [selectedTopic, expertType, debouncedSelectExperts, setExperts]);
    const handleTopicSelect = useCallback((topicTitle?: string) => {
        const finalTopic = topicTitle || manualTopicInput;
        if (!finalTopic) {
            showWarning("No Topic", "Please enter a topic or upload content.");
            return;
        }
        console.log("Topic selected:", finalTopic);
        setTopic(finalTopic);
        setSelectedTopic(finalTopic);
        setManualTopicInput("");
        updateStepState('topicSelection', 'success', `Topic set: ${finalTopic}`);
        if (!expertType) {
            setExpertType('ai');
            updateStepState('expertTypeSelection', 'success', 'Defaulted to AI Experts');
        }
    }, [setTopic, setExpertType, expertType, updateStepState, manualTopicInput, showWarning]);
    const handleExpertTypeSelect = useCallback((type: 'historical' | 'ai') => {
        console.log("Expert type selected:", type);
        setExpertType(type);
        updateStepState('expertTypeSelection', 'success', `Selected ${type === 'historical' ? 'Historical Figures' : 'AI Subject Experts'}`);
    }, [setExpertType, updateStepState]);

    const startDiscussion = async () => {
        if (!selectedTopic || experts.length < 2 || isGenerating) return;
        console.log("Starting discussion for topic:", selectedTopic);
        setIsGenerating(true);
        updateStepState('responseGeneration', 'loading', 'Generating initial statements...');
        setMessages([]);
        try {
            const currentTopic = topic || selectedTopic || 'General Debate';
            const responses = await Promise.all(experts.map(async (expert) => {
                const response = await fetch('/api/debate/response', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        expert,
                        messages: [{ role: 'user', content: `The topic is: ${currentTopic}. Please provide your initial thoughts.` }],
                        topic: currentTopic
                    }),
                });
                if (!response.ok) {
                    const errorText = await response.text();
                    console.error(`API error for ${expert.name}:`, response.status, errorText);
                    throw new Error(`API request failed: ${response.status}`);
                }
                const data = await response.json();
                return { expertName: expert.name, expertId: expert.id, response: data.response || "No response received" };
            }));
            const newMessages: Message[] = responses.map(resp => ({
                id: uuidv4(),
                timestamp: new Date().toISOString(),
                role: 'assistant' as const,
                content: resp.response,
                speaker: resp.expertName,
            }));
            setMessages(newMessages);
            updateStepState('responseGeneration', 'success', 'Discussion started!');
        } catch (error: any) {
            console.error('Error starting discussion:', error);
            showError(createError('START_DISCUSSION_ERROR', `Failed to start: ${error?.message || 'Unknown error'}`, 'high'));
            updateStepState('responseGeneration', 'error', 'Failed to start the discussion');
        } finally {
            setIsGenerating(false);
        }
    };

    const generateLocalExpertResponses = async (currentExperts: Expert[], currentMessages: Message[]) => {
        if (currentExperts.length === 0) return;
        const responsePromises: Promise<Message | null>[] = [];
        console.log(`Generating responses for ${currentExperts.length} experts...`);

        currentExperts.forEach((expert) => {
            responsePromises.push(
                (async (): Promise<Message | null> => {
                    try {
                        const response = await fetch('/api/debate/response', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                expert,
                                messages: currentMessages,
                                topic: topic || selectedTopic || 'General Debate'
                            }),
                        });
                        if (!response.ok) {
                            const errorText = await response.text();
                            console.error(`API error for ${expert.name}: ${response.status}`, errorText);
                            throw new Error(`API request failed: ${response.status}`);
                        }
                        const data = await response.json();
                        return {
                            id: uuidv4(),
                            role: 'assistant',
                            content: data.response || `(${expert.name} could not respond)`,
                            speaker: expert.name,
                            timestamp: new Date().toISOString()
                        };
                    } catch (error) {
                        console.error(`Error generating response for ${expert.name}:`, error);
                        showError(createError('EXPERT_RESPONSE_ERROR', `Failed for ${expert.name}: ${error instanceof Error ? error.message : 'Unknown error'}`, 'medium'));
                        return {
                            id: uuidv4(),
                            role: 'assistant',
                            content: `I apologize, an error occurred while generating my response as ${expert.name}. (${error instanceof Error ? error.message : 'Unknown error'})`,
                            speaker: expert.name,
                            timestamp: new Date().toISOString()
                        };
                    }
                })()
            );
        });

        const resolvedMessages = await Promise.all(responsePromises);
        const newAssistantMessages = resolvedMessages.filter(m => m !== null) as Message[];

        if (newAssistantMessages.length > 0) {
            newAssistantMessages.forEach(addMessage);
        }
    };

    const handleUserInput = async (text: string) => {
        if (text.trim() && !isGenerating && experts.length > 0) {
            const userMessage: Message = {
                id: uuidv4(),
                role: 'user',
                content: text,
                speaker: 'You',
                timestamp: new Date().toISOString()
            };
            addMessage(userMessage);
            setUserInput('');
            setIsGenerating(true);
            updateStepState('responseGeneration', 'loading', 'Generating responses...');
            const messagesForApi = useDebateStore.getState().messages;
            try {
                await generateLocalExpertResponses(experts, messagesForApi);
                updateStepState('responseGeneration', 'success', 'Responses generated!');
                setTimeout(() => updateStepState('responseGeneration', 'idle'), 2000);
            } catch (error) {
                console.error('Error generating responses:', error);
                showError(createError('RESPONSE_GENERATION_ERROR', `Failed to get responses: ${error instanceof Error ? error.message : 'Unknown error'}`, 'high'));
                updateStepState('responseGeneration', 'error', 'Failed to generate responses');
            } finally {
                setIsGenerating(false);
            }
        }
    };

    const handleInputChange = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setUserInput(event.target.value);
    };

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    useEffect(() => {
        if (storeError) {
            setErrorMessage(storeError);
            setError(null);
        }
    }, [storeError, setError]);

    useEffect(() => {
        console.log('Expert state change detected');
    }, [experts, expertsLoading, expertsSelected]);

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        event.preventDefault();
        setLoadingState('');
        const file = event.target.files?.[0];
        if (!file) {
            showWarning('No File Selected', 'Please select a valid document file');
            return;
        }
        const throttleKey = `document-analyze-${file.name}-${file.size}`;
        const now = Date.now();
        const lastRequestTime = requestTracker.recentRequests.get(throttleKey);
        if (lastRequestTime && (now - lastRequestTime < 5000)) {
            showInfo('File Already Processed', 'This file was recently analyzed. Using cached results.');
            if (extractedTopics && extractedTopics.length > 0) return;
        }
        const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
        if (file.size > MAX_FILE_SIZE) {
            showWarning('File Too Large', 'Please select a file smaller than 20MB');
            return;
        }
        setLoadingState(`Analyzing document: ${file.name}...`);
        if (event.target.nextElementSibling && event.target.nextElementSibling instanceof HTMLElement) {
            event.target.nextElementSibling.textContent = `Selected: ${file.name}`;
        }
        const apiEndpoints = [
            `/api/content/document`,
            `/api/content/analyze`,
            `/api/analyze`
        ];
        const mockTopics = [
            { title: `Climate Change (Mock for ${file.name})`, confidence: 0.95, arguments: [] },
            { title: "AI Regulation (Mock Data)", confidence: 0.88, arguments: [] }
        ];
        try {
            let success = false;
            let responseData: { topics?: any[] } | null = null;
            const formData = new FormData();
            formData.append('file', file);
            const userId = session?.user && 'id' in session.user ? session.user.id : 'anonymous';
            formData.append('userId', userId as string);
            formData.append('fileName', file.name);

            for (const endpoint of apiEndpoints) {
                try {
                    const response = await fetch(endpoint, { method: 'POST', body: formData });
                    if (response.ok) {
                        responseData = await response.json();
                        success = true;
                        requestTracker.addRequest(throttleKey);
                        break;
                    }
                } catch (fetchError) { /* Ignore fetch error, try next endpoint */ }
            }

            if (success && responseData?.topics && responseData.topics.length > 0) {
                setExtractedTopics(responseData.topics);
                handleTopicSelect(responseData.topics[0].title);
                showInfo('Analysis Complete', `Extracted topics from ${file.name}`);
            } else {
                throw new Error('Failed to analyze document or no topics found.');
            }
        } catch (error: any) {
            console.error('Error analyzing document:', error);
            if (process.env.NODE_ENV !== 'production') {
                setExtractedTopics(mockTopics);
                handleTopicSelect(mockTopics[0].title);
                showWarning('Using Mock Topics', `Failed to analyze: ${error.message}. Using mock data.`);
            } else {
                showError(createError('DOC_ANALYSIS_FAILED', `Document analysis failed: ${error.message}`, 'medium'));
            }
        } finally {
            setLoadingState('');
        }
    };

    const handleManualTopicInputChange = (event: ChangeEvent<HTMLInputElement>) => {
        setManualTopicInput(event.target.value);
    };
    const handleManualTopicSubmit = (event: FormEvent) => {
        event.preventDefault();
        handleTopicSelect();
    };

    return (
        <div className="flex flex-col h-full bg-background text-foreground p-4 md:p-6 space-y-4">
            {errorMessage && <div className="p-3 bg-destructive/20 text-destructive rounded-md text-sm">Error: {errorMessage}</div>}
            {warningMessage && <div className="p-3 bg-yellow-500/20 text-yellow-600 rounded-md text-sm">Warning: {warningMessage}</div>}
            {infoMessage && <div className="p-3 bg-blue-500/20 text-blue-600 rounded-md text-sm">Info: {infoMessage}</div>}
            {loadingState && <div className="p-3 bg-gray-500/10 text-gray-500 rounded-md text-sm animate-pulse">{loadingState}</div>}

            {!selectedTopic && (
                <div className="p-4 border rounded-lg bg-card">
                    <h2 className="text-lg font-semibold mb-3">Enter Debate Topic</h2>
                    <form onSubmit={handleManualTopicSubmit} className="flex items-center gap-2 mb-4">
                        <Input
                            type="text"
                            placeholder="Enter your debate topic here..."
                            value={manualTopicInput}
                            onChange={handleManualTopicInputChange}
                            className="flex-grow"
                            aria-label="Debate Topic Input"
                        />
                        <Button type="submit" disabled={!manualTopicInput.trim()}>Set Topic</Button>
                    </form>

                    <div className="text-center my-2 text-sm text-muted-foreground">OR</div>

                    <div className="flex flex-col items-center">
                        <label htmlFor="file-upload" className="cursor-pointer inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 mb-2">
                            Upload Document
                        </label>
                        <input id="file-upload" name="file-upload" type="file" className="sr-only" onChange={handleFileUpload} accept=".pdf,.txt,.docx,.md" />
                        <p className="text-xs text-muted-foreground">(PDF, TXT, DOCX, MD - Max 20MB)</p>
                    </div>
                </div>
            )}

            {selectedTopic && (
                <div className="p-3 bg-primary/10 rounded-md">
                    <h2 className="text-lg font-semibold text-primary">Selected Topic:</h2>
                    <p className="mt-1">{selectedTopic}</p>
                </div>
            )}

            {selectedTopic && !expertType && (
                <ExpertTypeSelector />
            )}

            {selectedTopic && expertType && (
                <div className="flex flex-col md:flex-row gap-4">
                    {expertsLoading && <p className="w-full animate-pulse">Selecting experts...</p>}
                    {!expertsLoading && experts.length === 0 && stepStates.expertSelection.status !== 'error' && (
                        <p className="w-full">Waiting for experts...</p>
                    )}
                    {!expertsLoading && experts.length === 0 && stepStates.expertSelection.status === 'error' && (
                        <div className="p-3 bg-destructive/20 text-destructive rounded-md text-sm w-full">
                            Failed to select experts: {stepStates.expertSelection.message || 'Please check the topic or try again.'}
                        </div>
                    )}
                    {!expertsLoading && experts.map((expert) => (
                        <ExpertCard key={expert.id} expert={expert} />
                    ))}
                </div>
            )}

            {expertsSelected && messages.length === 0 && (
                <Button onClick={startDiscussion} disabled={isGenerating || experts.length < 2}>
                    {isGenerating ? "Starting..." : "Start Debate on Selected Topic"}
                </Button>
            )}

            {messages.length > 0 && (
                <div className="flex-1 overflow-y-auto p-4 bg-muted/50 rounded-lg space-y-4">
                    {messages.map((m) => (
                        <MessageBubble
                            key={m.id}
                            message={m}
                            experts={experts}
                        />
                    ))}
                    {isGenerating && (
                        <div className="flex justify-center items-center p-2">
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
                            <span className="ml-2 text-sm text-muted-foreground">Generating response...</span>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>
            )}

            {expertsSelected && messages.length > 0 && (
                <UserInput
                    onSubmit={(text: string) => handleUserInput(text)}
                    disabled={isGenerating}
                />
            )}
        </div>
    );
}

function debounce<T extends (...args: any[]) => any>(func: T, wait: number): (...args: Parameters<T>) => void {
    let timeout: ReturnType<typeof setTimeout> | null = null;
    return function (this: ThisParameterType<T>, ...args: Parameters<T>) {
        const context = this;
        if (timeout) {
            clearTimeout(timeout);
        }
        timeout = setTimeout(() => {
            timeout = null;
            func.apply(context, args);
        }, wait);
    };
} 