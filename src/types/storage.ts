import { Expert } from './expert';
import { Message } from './message';

export interface DebateMetadata {
    id: string;
    topic: string;
    expertType: string;
    userId: string;
    status: 'active' | 'completed' | 'archived';
    createdAt: string;
    updatedAt: string;
    context?: string;
}

export interface FastAccessData {
    topic: string;
    experts: Expert[];
    messages: Message[];
    lastUpdated: string;
}

export interface StorageOperationResult {
    success: boolean;
    error?: string;
} 