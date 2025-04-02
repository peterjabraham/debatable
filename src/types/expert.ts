// Source reference type
export interface SourceReference {
    id: string;
    title: string;
    author?: string;
    year?: string;
    content?: string;
    url?: string;
}

// The main Expert interface used throughout the application
export interface Expert {
    id: string;
    name: string;
    background: string;
    stance: 'pro' | 'con';
    perspective: string;
    type: 'historical' | 'ai';
    expertise: string[];
    identifier?: string;
    voiceId?: string;
    sourceReferences?: SourceReference[];
}

// These interfaces are kept for reference but not actively used
interface BaseExpert {
    id: string;
    name: string;
    title: string;
    perspective: string;
    bio: string;
    type: 'historical' | 'ai';
    identifier?: string;
    voiceId?: string;
    sourceReferences?: SourceReference[];
}

export interface HistoricalExpert extends BaseExpert {
    type: 'historical';
    era: string;
}

export interface DomainExpert extends BaseExpert {
    type: 'ai';
    field: string;
} 