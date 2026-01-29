/**
 * Queue Manager
 * 
 * Manages BullMQ queues for async LLM job processing.
 * Provides methods to add jobs and check their status.
 */

import { Queue, Job } from 'bullmq';
import { v4 as uuid } from 'uuid';
import { prisma } from '../db/prisma';
import { getRedisConnection, QUEUE_NAMES, DEFAULT_JOB_OPTIONS } from './config';
import { 
    LLMJobData, 
    JobStatus, 
    JobStatusResponse,
    GenerateResponseJobData,
    SelectExpertsJobData,
    ExtractTopicsJobData,
    GenerateSummaryJobData
} from './types';

// Singleton queue instance
let llmQueue: Queue<LLMJobData> | null = null;

/**
 * Get or create the LLM jobs queue
 */
export function getLLMQueue(): Queue<LLMJobData> {
    if (llmQueue) {
        return llmQueue;
    }

    try {
        const connection = getRedisConnection();
        llmQueue = new Queue<LLMJobData>(QUEUE_NAMES.LLM_JOBS, {
            connection,
            defaultJobOptions: DEFAULT_JOB_OPTIONS,
        });

        console.log('[QueueManager] LLM queue initialized');
        return llmQueue;
    } catch (error) {
        console.error('[QueueManager] Failed to initialize queue:', error);
        throw error;
    }
}

/**
 * Add a job to generate an expert response
 */
export async function addGenerateResponseJob(
    data: Omit<GenerateResponseJobData, 'jobId' | 'type' | 'createdAt'>
): Promise<string> {
    const jobId = uuid();
    const jobData: GenerateResponseJobData = {
        ...data,
        jobId,
        type: 'GENERATE_RESPONSE',
        createdAt: new Date().toISOString(),
    };

    // Store job in database
    await prisma.job.create({
        data: {
            id: jobId,
            debateId: data.debateId,
            type: 'GENERATE_RESPONSE',
            status: 'PENDING',
            payload: jobData as any,
            progress: 0,
        },
    });

    // Add to queue
    const queue = getLLMQueue();
    await queue.add('generate-response', jobData, {
        jobId,
        priority: 1, // High priority for responses
    });

    console.log(`[QueueManager] Added generate-response job: ${jobId}`);
    return jobId;
}

/**
 * Add a job to select experts for a topic
 */
export async function addSelectExpertsJob(
    data: Omit<SelectExpertsJobData, 'jobId' | 'type' | 'createdAt'>
): Promise<string> {
    const jobId = uuid();
    const jobData: SelectExpertsJobData = {
        ...data,
        jobId,
        type: 'SELECT_EXPERTS',
        createdAt: new Date().toISOString(),
    };

    // Store job in database
    await prisma.job.create({
        data: {
            id: jobId,
            debateId: data.debateId,
            type: 'SELECT_EXPERTS',
            status: 'PENDING',
            payload: jobData as any,
            progress: 0,
        },
    });

    // Add to queue
    const queue = getLLMQueue();
    await queue.add('select-experts', jobData, {
        jobId,
        priority: 2,
    });

    console.log(`[QueueManager] Added select-experts job: ${jobId}`);
    return jobId;
}

/**
 * Add a job to extract topics from content
 */
export async function addExtractTopicsJob(
    data: Omit<ExtractTopicsJobData, 'jobId' | 'type' | 'createdAt'>
): Promise<string> {
    const jobId = uuid();
    const jobData: ExtractTopicsJobData = {
        ...data,
        jobId,
        type: 'EXTRACT_TOPICS',
        createdAt: new Date().toISOString(),
    };

    // Store job in database
    await prisma.job.create({
        data: {
            id: jobId,
            type: 'EXTRACT_TOPICS',
            status: 'PENDING',
            payload: jobData as any,
            progress: 0,
        },
    });

    // Add to queue
    const queue = getLLMQueue();
    await queue.add('extract-topics', jobData, {
        jobId,
        priority: 3,
    });

    console.log(`[QueueManager] Added extract-topics job: ${jobId}`);
    return jobId;
}

/**
 * Add a job to generate a debate summary
 */
export async function addGenerateSummaryJob(
    data: Omit<GenerateSummaryJobData, 'jobId' | 'type' | 'createdAt'>
): Promise<string> {
    const jobId = uuid();
    const jobData: GenerateSummaryJobData = {
        ...data,
        jobId,
        type: 'GENERATE_SUMMARY',
        createdAt: new Date().toISOString(),
    };

    // Store job in database
    await prisma.job.create({
        data: {
            id: jobId,
            debateId: data.debateId,
            type: 'GENERATE_SUMMARY',
            status: 'PENDING',
            payload: jobData as any,
            progress: 0,
        },
    });

    // Add to queue
    const queue = getLLMQueue();
    await queue.add('generate-summary', jobData, {
        jobId,
        priority: 4,
    });

    console.log(`[QueueManager] Added generate-summary job: ${jobId}`);
    return jobId;
}

/**
 * Get job status from database
 */
export async function getJobStatus(jobId: string): Promise<JobStatusResponse | null> {
    const job = await prisma.job.findUnique({
        where: { id: jobId },
    });

    if (!job) {
        return null;
    }

    return {
        jobId: job.id,
        status: job.status.toLowerCase() as JobStatus,
        progress: job.progress,
        result: job.result as any,
        error: job.error || undefined,
        createdAt: job.createdAt.toISOString(),
        startedAt: job.startedAt?.toISOString(),
        completedAt: job.completedAt?.toISOString(),
    };
}

/**
 * Get all jobs for a debate
 */
export async function getDebateJobs(debateId: string): Promise<JobStatusResponse[]> {
    const jobs = await prisma.job.findMany({
        where: { debateId },
        orderBy: { createdAt: 'desc' },
    });

    return jobs.map(job => ({
        jobId: job.id,
        status: job.status.toLowerCase() as JobStatus,
        progress: job.progress,
        result: job.result as any,
        error: job.error || undefined,
        createdAt: job.createdAt.toISOString(),
        startedAt: job.startedAt?.toISOString(),
        completedAt: job.completedAt?.toISOString(),
    }));
}

/**
 * Cancel a pending job
 */
export async function cancelJob(jobId: string): Promise<boolean> {
    try {
        const queue = getLLMQueue();
        const job = await queue.getJob(jobId);
        
        if (job) {
            await job.remove();
        }

        await prisma.job.update({
            where: { id: jobId },
            data: { 
                status: 'CANCELLED',
                completedAt: new Date(),
            },
        });

        return true;
    } catch (error) {
        console.error(`[QueueManager] Failed to cancel job ${jobId}:`, error);
        return false;
    }
}

/**
 * Clean up old completed/failed jobs
 */
export async function cleanupOldJobs(olderThanHours: number = 24): Promise<number> {
    const cutoff = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);
    
    const result = await prisma.job.deleteMany({
        where: {
            completedAt: { lt: cutoff },
            status: { in: ['COMPLETED', 'FAILED', 'CANCELLED'] },
        },
    });

    console.log(`[QueueManager] Cleaned up ${result.count} old jobs`);
    return result.count;
}
