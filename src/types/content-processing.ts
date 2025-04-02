export type SupportedDocumentType = 'pdf' | 'docx' | 'txt';

export interface DocumentMetadata {
    fileName: string;
    fileType: SupportedDocumentType;
    fileSize: number;
    pageCount?: number;
    createdAt: Date;
    lastModified: Date;
}

export interface ParsedDocument {
    metadata: DocumentMetadata;
    content: string;
    rawText: string;
    sections?: {
        title?: string;
        content: string;
        pageNumber?: number;
    }[];
    error?: string;
}

export interface DocumentParserOptions {
    extractSections?: boolean;
    maxSizeInMB?: number;
    preserveFormatting?: boolean;
}

export interface DocumentParserResult {
    success: boolean;
    parsedDocument?: ParsedDocument;
    error?: string;
}

export interface Topic {
    title: string;
    confidence: number;
    keywords: string[];
    summary: string;
    relatedTopics?: string[];
    sourceSection?: {
        content: string;
        position: number;
    };
}

export interface Argument {
    claim: string;
    confidence: number;
    evidence: string[];
    counterpoints?: string[];
    sourceSection?: {
        content: string;
        position: number;
    };
}

export interface TopicExtractionResult {
    success: boolean;
    topics: Topic[];
    mainArguments: Argument[];
    error?: string;
}

export interface TopicExtractorOptions {
    minConfidence: number;
    maxTopics: number;
    extractCounterpoints: boolean;
    language: string;
}

export type MediaType = 'youtube' | 'podcast' | 'audio' | 'video';

export interface MediaMetadata {
    title: string;
    description?: string;
    duration: number;
    format: string;
    url: string;
    thumbnailUrl?: string;
    author?: string;
    publishDate?: Date;
}

export interface TranscriptSegment {
    text: string;
    start: number;
    end: number;
    speaker?: string;
    confidence: number;
}

export interface KeyPoint {
    text: string;
    timestamp: number;
    confidence: number;
    topics: string[];
}

export interface ProcessedMedia {
    metadata: MediaMetadata;
    transcript: TranscriptSegment[];
    keyPoints: KeyPoint[];
    error?: string;
}

export interface MediaProcessorOptions {
    downloadMedia: boolean;
    extractAudio: boolean;
    generateTranscript: boolean;
    maxDuration: number;
    language: string;
} 