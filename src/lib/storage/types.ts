import { Expert } from '@/types/expert';
import { Message, DebateContext } from '@/types/message';

export interface DebateMetadata {
    id: string;
    userId: string;
    topic: string;
    expertType: 'historical' | 'domain';
    status: 'initializing' | 'active' | 'completed' | 'error';
    createdAt: string;
    updatedAt: string;
}

export interface FastAccessData {
    experts?: Expert[];
    recentMessages?: Message[];
    currentContext?: DebateContext;
}

export interface StorageOperationResult<T> {
    success: boolean;
    data?: T;
    error?: string;
} 