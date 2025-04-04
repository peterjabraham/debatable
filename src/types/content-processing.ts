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
    metadata?: DocumentMetadata;
    content: string;
    rawText?: string;
    sections?: DocumentSection[];
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
    keywords?: string[];
    summary?: string;
    relatedTopics?: string[];
    sourceSection?: {
        content: string;
        position: number;
    };
}

export interface Argument {
    topicTitle: string;
    text?: string;
    claim?: string;
    confidence: number;
    evidence?: string[];
    type: 'support' | 'counter';
    counterpoints?: string[];
    sourceSection?: {
        content: string;
        position: number;
    };
}

export interface TopicExtractionResult {
    success?: boolean;
    topics: Topic[];
    args: Argument[];
    mainArguments?: Argument[];
    error?: string;
}

/**
 * Topic extraction options
 */
export interface TopicExtractorOptions {
    /**
     * Minimum confidence for a topic to be considered valid
     * @default 0.6
     */
    minConfidence: number;

    /**
     * Maximum number of topics to extract
     * @default 5
     */
    maxTopics: number;

    /**
     * Whether to extract counterpoints for topics
     * @default true
     */
    extractCounterpoints: boolean;

    /**
     * Language of the document
     * @default 'english'
     */
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

/**
 * A section in a parsed document
 */
export interface DocumentSection {
    /**
     * Title of the section
     */
    title?: string;

    /**
     * Content of the section
     */
    content: string;

    /**
     * Page number for the section
     */
    pageNumber?: number;
}

/**
 * The topic as displayed to the user
 */
export interface DisplayTopic {
    /**
     * Title of the topic
     */
    title: string;

    /**
     * Confidence score (0-1)
     */
    confidence: number;

    /**
     * Arguments for the topic
     */
    arguments: {
        /**
         * The claim being made
         */
        claim: string;

        /**
         * Evidence supporting the claim
         */
        evidence: string;

        /**
         * Type of argument
         */
        type?: string;

        /**
         * Counterpoints to the claim, if any
         */
        counterpoints?: string[];
    }[];
} 