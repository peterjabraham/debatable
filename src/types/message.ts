export interface MessageUsage {
    tokens: number;
    promptTokens: number;
    completionTokens: number;
    cost: number;
}

export interface Citation {
    id: string;
    referenceId: string;
    text: string;
    startIndex: number;
    endIndex: number;
}

export interface Message {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    speaker?: string;
    timestamp?: string;
    usage?: {
        tokens: number;
        promptTokens: number;
        completionTokens: number;
        cost: number;
    };
    citations?: Citation[];
    hasProcessedCitations?: boolean;
    apiName?: string;
}

export interface ExpertContext {
    expertId: string;
    stanceOnTopic: string;
    keyPoints: string[];
    recentArguments: string[];
    consistencyScore?: number;
    persuasionTechniques?: string[];
    backgroundKnowledge?: string;
    sourceReferences?: SourceReference[];
    stanceStrength?: number; // 0-1 scale of how strongly the expert holds their position
}

export interface DebateContext {
    debateId: string;
    messageIndex?: number;
    expertContexts?: Record<string, ExpertContext>;
    mainPoints?: string[];
    userQuestions?: string[];
    factChecks?: FactCheck[];
    summaries?: SummaryPoint[];
    turnHistory?: TurnRecord[];
    nextSpeaker?: string;
}

export interface FactCheck {
    claim: string;
    accuracy: 'true' | 'false' | 'partially true' | 'uncertain';
    explanation: string;
    sources?: SourceReference[];
    confidence: number; // 0-1 scale
}

export interface SourceReference {
    title: string;
    url?: string;
    author?: string;
    publishDate?: string;
    excerpt?: string;
    relevance?: number; // 0-1 scale
}

export interface SummaryPoint {
    content: string;
    speaker?: string;
    importance: number; // 0-1 scale
    type: 'claim' | 'evidence' | 'rebuttal' | 'question';
}

export interface TurnRecord {
    speakerId: string;
    timestamp: string;
    duration?: number; // Time taken to respond in ms
    messageId: string;
} 