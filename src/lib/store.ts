import { create } from 'zustand';
import { Expert } from '@/types/expert';
import { Message, Citation } from '@/types/message';
import { processCitationMarkers } from './utils/citation-processor';

type ExpertType = 'historical' | 'domain';

// Helper function to sanitize names for OpenAI API
function sanitizeNameForOpenAI(name: string | undefined): string | undefined {
    if (!name) return undefined;

    // Replace any characters that aren't alphanumeric, underscore, or hyphen with underscore
    // This matches OpenAI's requirements: '^[a-zA-Z0-9_-]+$'
    return name.replace(/[^a-zA-Z0-9_-]/g, '_');
}

interface DebateState {
    topic: string;
    userStance: string;
    experts: Expert[];
    messages: Message[];
    isGenerating: boolean;
    useVoiceSynthesis: boolean;
    useCitations: boolean;
    expertType: ExpertType;
    debateId: string | null;
    error: string | null;
    setTopic: (topic: string) => void;
    setUserStance: (stance: string) => void;
    resetUserStance: () => void;
    setExperts: (experts: Expert[]) => void;
    addMessage: (message: Message) => void;
    processCitationsInMessage: (messageId: string) => void;
    setIsGenerating: (isGenerating: boolean) => void;
    setUseVoiceSynthesis: (useVoice: boolean) => void;
    setUseCitations: (useCitations: boolean) => void;
    setExpertType: (type: ExpertType) => void;
    initializeDebate: (debateId: string, topic: string) => void;
    setError: (error: string | null) => void;
    reset: () => void;
}

export const useDebateStore = create<DebateState>((set, get) => ({
    topic: '',
    userStance: '',
    experts: [],
    messages: [],
    isGenerating: false,
    useVoiceSynthesis: false,
    useCitations: true,
    expertType: 'historical',
    debateId: null,
    error: null,
    setTopic: (topic) => set({ topic }),
    setUserStance: (stance) => set({ userStance: stance }),
    resetUserStance: () => set({ userStance: '' }),
    setExperts: (experts) => set({
        experts: experts.map(expert => ({
            ...expert,
            id: expert.id || `expert_${Date.now()}_${expert.name.replace(/\s+/g, '_')}`
        }))
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
    reset: () => set({
        topic: '',
        userStance: '',
        experts: [],
        messages: [],
        expertType: 'historical',
        debateId: null,
        error: null
    }),
})); 