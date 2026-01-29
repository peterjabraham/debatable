/**
 * Job Queue Types
 * 
 * Type definitions for all job types processed by the queue.
 */

// Job types
export type JobType = 
    | 'GENERATE_RESPONSE'
    | 'SELECT_EXPERTS'
    | 'EXTRACT_TOPICS'
    | 'PROCESS_DOCUMENT'
    | 'GENERATE_SUMMARY';

// Job status
export type JobStatus = 
    | 'pending'
    | 'processing'
    | 'completed'
    | 'failed'
    | 'cancelled';

// Base job data
export interface BaseJobData {
    jobId: string;
    debateId?: string;
    userId?: string;
    createdAt: string;
}

// Generate expert response job
export interface GenerateResponseJobData extends BaseJobData {
    type: 'GENERATE_RESPONSE';
    expertId: string;
    expertName: string;
    expertStance: 'pro' | 'con';
    expertBackground: string;
    expertExpertise: string[];
    topic: string;
    messages: Array<{
        role: 'user' | 'assistant' | 'system';
        content: string;
        name?: string;
    }>;
}

// Select experts job
export interface SelectExpertsJobData extends BaseJobData {
    type: 'SELECT_EXPERTS';
    topic: string;
    expertType: 'historical' | 'ai';
    count?: number;
}

// Extract topics job
export interface ExtractTopicsJobData extends BaseJobData {
    type: 'EXTRACT_TOPICS';
    content: string;
    sourceType: 'pdf' | 'youtube' | 'podcast' | 'link';
    maxTopics?: number;
}

// Process document job
export interface ProcessDocumentJobData extends BaseJobData {
    type: 'PROCESS_DOCUMENT';
    filePath: string;
    fileName: string;
}

// Generate summary job
export interface GenerateSummaryJobData extends BaseJobData {
    type: 'GENERATE_SUMMARY';
    messages: Array<{
        role: string;
        content: string;
        speaker?: string;
    }>;
    topic: string;
}

// Union of all job data types
export type LLMJobData = 
    | GenerateResponseJobData
    | SelectExpertsJobData
    | ExtractTopicsJobData
    | ProcessDocumentJobData
    | GenerateSummaryJobData;

// Job result types
export interface GenerateResponseResult {
    response: string;
    usage: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
        cost: number;
    };
}

export interface SelectExpertsResult {
    experts: Array<{
        id: string;
        name: string;
        background: string;
        stance: 'pro' | 'con';
        perspective: string;
        expertise: string[];
    }>;
}

export interface ExtractTopicsResult {
    topics: Array<{
        title: string;
        confidence: number;
        keywords?: string[];
        summary?: string;
    }>;
}

export interface ProcessDocumentResult {
    success: boolean;
    chunkCount?: number;
    extractedText?: string;
}

export interface GenerateSummaryResult {
    summary: string;
    keyPoints: string[];
}

// Union of all job result types
export type LLMJobResult = 
    | GenerateResponseResult
    | SelectExpertsResult
    | ExtractTopicsResult
    | ProcessDocumentResult
    | GenerateSummaryResult;

// Job status response (for API)
export interface JobStatusResponse {
    jobId: string;
    status: JobStatus;
    progress: number;
    result?: LLMJobResult;
    error?: string;
    createdAt: string;
    startedAt?: string;
    completedAt?: string;
}
