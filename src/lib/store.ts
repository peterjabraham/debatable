import { create } from 'zustand';
import { Expert } from '@/types/expert';
import { Message, Citation } from '@/types/message';
import { DebateTopic, ProcessedContent } from '@/types/content';
import { processCitationMarkers } from './utils/citation-processor';

type ExpertType = 'historical' | 'ai';

// Helper function to sanitize names for OpenAI API
function sanitizeNameForOpenAI(name: string | undefined): string | undefined {
    if (!name) return undefined;

    // Replace any characters that aren't alphanumeric, underscore, or hyphen with underscore
    // This matches OpenAI's requirements: '^[a-zA-Z0-9_-]+$'
    return name.replace(/[^a-zA-Z0-9_-]/g, '_');
}

// Extended topic interface for debate context
interface DebateTopicContext {
    title: string;
    description?: string;
    contentId?: string;
    sourceType?: 'pdf' | 'youtube' | 'podcast';
    extractedText?: string;
    confidence?: number;
}

interface DebateState {
    topic: string;
    topicContext: DebateTopicContext | null;
    userStance: string;
    experts: Expert[];
    messages: Message[];
    isGenerating: boolean;
    useVoiceSynthesis: boolean;
    useCitations: boolean;
    expertType: ExpertType;
    debateId: string | null;
    error: string | null;
    // Content processing related state
    processedContent: ProcessedContent | null;
    availableTopics: DebateTopic[];
    setTopic: (topic: string | DebateTopicContext) => void;
    setTopicContext: (context: DebateTopicContext) => void;
    setUserStance: (stance: string) => void;
    resetUserStance: () => void;
    setExperts: (experts: Expert[]) => void;
    addMessage: (message: Message) => void;
    setMessages: (messages: Message[]) => void;
    processCitationsInMessage: (messageId: string) => void;
    setIsGenerating: (isGenerating: boolean) => void;
    setUseVoiceSynthesis: (useVoice: boolean) => void;
    setUseCitations: (useCitations: boolean) => void;
    setExpertType: (type: ExpertType) => void;
    initializeDebate: (debateId: string, topic: string) => void;
    setError: (error: string | null) => void;
    // Content processing actions
    setProcessedContent: (content: ProcessedContent | null) => void;
    setAvailableTopics: (topics: DebateTopic[]) => void;
    getContentContext: () => { contentId?: string; sourceType?: string; extractedText?: string };
    reset: () => void;
}

export const useDebateStore = create<DebateState>((set, get) => ({
    topic: '',
    topicContext: null,
    userStance: '',
    experts: [],
    messages: [],
    isGenerating: false,
    useVoiceSynthesis: false,
    useCitations: true,
    expertType: 'historical',
    debateId: null,
    error: null,
    processedContent: null,
    availableTopics: [],
    setTopic: (topic) => {
        if (typeof topic === 'string') {
            set({ topic, topicContext: { title: topic } });
        } else {
            set({
                topic: topic.title,
                topicContext: topic
            });
        }
    },
    setTopicContext: (context) => set({
        topicContext: context,
        topic: context.title
    }),
    setUserStance: (stance) => set({ userStance: stance }),
    resetUserStance: () => set({ userStance: '' }),
    setExperts: (experts) => set({
        experts: experts.map(expert => {
            // Generate a consistent identifier for AI experts
            let identifier = expert.identifier;
            if (expert.type === 'ai' && !identifier) {
                // Extract the first letter of each word in expertise for a more meaningful identifier
                let expertCode = '';
                if (expert.expertise && expert.expertise.length > 0) {
                    // Take first expertise area, extract first letter of each word
                    expertCode = expert.expertise[0]
                        .split(' ')
                        .map(word => word.charAt(0).toUpperCase())
                        .join('');

                    // Limit to 3 characters
                    expertCode = expertCode.slice(0, 3);
                }

                // Random number between 1000-9999
                const randomNum = Math.floor(1000 + Math.random() * 9000);
                identifier = `AI-${expertCode}${randomNum}`;
            }

            return {
                ...expert,
                id: expert.id || `expert_${Date.now()}_${expert.name.replace(/\s+/g, '_')}`,
                identifier
            };
        })
    }),
    addMessage: (message) => set((state) => {
        // Create a safe name for OpenAI API if one exists
        const apiSafeName = message.speaker ? sanitizeNameForOpenAI(message.speaker) : undefined;

        return {
            messages: [...state.messages, {
                ...message,
                id: message.id || `msg_${Date.now()}_${state.messages.length}`,
                // Add a special field for the OpenAI-compatible name pattern
                apiName: apiSafeName
            }]
        };
    }),
    setMessages: (messages) => set({
        messages: messages.map(message => {
            // Create a safe name for OpenAI API if one exists
            const apiSafeName = message.speaker ? sanitizeNameForOpenAI(message.speaker) : undefined;

            // Ensure each message has an ID
            return {
                ...message,
                id: message.id || `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                apiName: apiSafeName
            };
        })
    }),
    processCitationsInMessage: (messageId) => set((state) => {
        const msgIndex = state.messages.findIndex(m => m.id === messageId);
        if (msgIndex === -1) return state;

        const message = state.messages[msgIndex];
        if (message.hasProcessedCitations || message.role !== 'assistant') return state;

        const expert = state.experts.find(e => e.name === message.speaker);
        if (!expert || !expert.sourceReferences) return state;

        const { processedText, citations } = processCitationMarkers(
            message.content,
            expert.sourceReferences
        );

        const updatedMessages = [...state.messages];
        updatedMessages[msgIndex] = {
            ...message,
            content: processedText,
            citations,
            hasProcessedCitations: true
        };

        return { messages: updatedMessages };
    }),
    setIsGenerating: (isGenerating) => set({ isGenerating }),
    setUseVoiceSynthesis: (useVoice) => set({ useVoiceSynthesis: useVoice }),
    setUseCitations: (useCitations) => set({ useCitations }),
    setExpertType: (type) => set({ expertType: type }),
    initializeDebate: (debateId, topic) => set({ debateId, topic }),
    setError: (error) => set({ error }),
    setProcessedContent: (content) => set({ processedContent: content }),
    setAvailableTopics: (topics) => set({ availableTopics: topics }),
    getContentContext: () => {
        const state = get();
        return {
            contentId: state.topicContext?.contentId,
            sourceType: state.topicContext?.sourceType,
            extractedText: state.topicContext?.extractedText || state.processedContent?.extractedText
        };
    },
    reset: () => set({
        topic: '',
        topicContext: null,
        userStance: '',
        experts: [],
        messages: [],
        expertType: 'historical',
        debateId: null,
        error: null,
        processedContent: null,
        availableTopics: []
    }),
})); 