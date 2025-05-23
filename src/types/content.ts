export interface ProcessedContent {
    id: string;
    userId: string;
    sourceType: 'pdf' | 'youtube' | 'podcast';
    sourceName: string;
    sourceUrl?: string;
    status: 'pending' | 'extracting_text' | 'generating_topics' | 'completed' | 'failed';
    extractedText?: string;
    textStoragePath?: string; // For large texts stored in Firebase Storage
    debateTopics: DebateTopic[];
    createdAt: string;
    updatedAt: string;
    errorMessage?: string;
}

export interface DebateTopic {
    title: string;
    summary: string;
    confidence?: number;
}

export interface ContentProcessingRequest {
    sourceType: 'pdf' | 'youtube' | 'podcast';
    file?: File;
    url?: string;
    userId: string;
}

export interface ContentProcessingResponse {
    message: string;
    contentId: string;
    sourceName: string;
    debateTopics: DebateTopic[];
    status: ProcessedContent['status'];
}

export interface ContentProcessingError {
    error: string;
    details?: string;
    contentId?: string;
} 