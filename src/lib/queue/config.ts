/**
 * BullMQ Queue Configuration
 * 
 * Configures Redis connection for job queues.
 * Uses Upstash Redis in production, local Redis in development.
 */

import { ConnectionOptions } from 'bullmq';

// Parse Redis URL for BullMQ connection
function parseRedisUrl(url: string): ConnectionOptions {
    try {
        const parsed = new URL(url);
        return {
            host: parsed.hostname,
            port: parseInt(parsed.port) || 6379,
            password: parsed.password || undefined,
            username: parsed.username || undefined,
            tls: parsed.protocol === 'rediss:' ? {} : undefined,
        };
    } catch (error) {
        console.error('Failed to parse Redis URL:', error);
        return {
            host: 'localhost',
            port: 6379,
        };
    }
}

// Get Redis connection options
export function getRedisConnection(): ConnectionOptions {
    // Check for Upstash Redis URL first (production)
    const upstashUrl = process.env.UPSTASH_REDIS_URL;
    if (upstashUrl) {
        console.log('[Queue] Using Upstash Redis');
        return parseRedisUrl(upstashUrl);
    }

    // Check for generic Redis URL
    const redisUrl = process.env.REDIS_URL;
    if (redisUrl) {
        console.log('[Queue] Using Redis URL');
        return parseRedisUrl(redisUrl);
    }

    // Default to localhost for development
    console.log('[Queue] Using local Redis (localhost:6379)');
    return {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD || undefined,
    };
}

// Queue names
export const QUEUE_NAMES = {
    LLM_JOBS: 'llm-jobs',
    CONTENT_PROCESSING: 'content-processing',
} as const;

// Default job options
export const DEFAULT_JOB_OPTIONS = {
    attempts: 3,
    backoff: {
        type: 'exponential' as const,
        delay: 2000, // Start with 2 seconds
    },
    removeOnComplete: {
        age: 3600, // Keep completed jobs for 1 hour
        count: 100, // Keep last 100 completed jobs
    },
    removeOnFail: {
        age: 86400, // Keep failed jobs for 24 hours
    },
};
