/**
 * Job Queue Worker
 * 
 * Processes LLM jobs from the queue with exponential backoff retry.
 * This can run as a separate process for better scalability.
 */

import { Worker, Job } from 'bullmq';
import { prisma } from '../db/prisma';
import { getRedisConnection, QUEUE_NAMES } from './config';
import { 
    LLMJobData, 
    GenerateResponseJobData,
    SelectExpertsJobData,
    ExtractTopicsJobData,
    GenerateSummaryJobData,
    GenerateResponseResult,
    SelectExpertsResult,
    ExtractTopicsResult,
    GenerateSummaryResult
} from './types';
import { getOpenAIClient } from '../openai';
import { withOpenAIRetry } from '../utils/retry';

// Singleton worker instance
let llmWorker: Worker<LLMJobData> | null = null;

/**
 * Process a generate response job
 */
async function processGenerateResponse(
    job: Job<GenerateResponseJobData>
): Promise<GenerateResponseResult> {
    const { 
        expertName, 
        expertStance, 
        expertBackground, 
        expertExpertise,
        topic,
        messages 
    } = job.data;

    console.log(`[Worker] Processing generate-response for ${expertName}`);

    const openai = getOpenAIClient();
    const model = process.env.OPENAI_MODEL || 'gpt-4-turbo';

    // Build system prompt
    const systemPrompt = `You are ${expertName}, an expert with the following background: ${expertBackground}. 
Your areas of expertise include: ${expertExpertise.join(', ')}.
You have a ${expertStance === 'pro' ? 'strongly supportive' : 'fundamentally opposed'} stance on the topic: "${topic}".

${expertStance === 'pro' 
    ? 'Highlight benefits, advantages, and positive aspects. Refute common criticisms.' 
    : 'Emphasize serious risks, significant downsides, and negative consequences. Challenge claims made by supporters.'}

Respond in first person as this expert would. Keep responses concise (150-250 words) but substantive.`;

    const apiMessages = [
        { role: 'system' as const, content: systemPrompt },
        ...messages.map(m => ({
            role: m.role as 'user' | 'assistant' | 'system',
            content: m.content,
        })),
    ];

    // Update progress
    await job.updateProgress(30);

    const response = await withOpenAIRetry(() => 
        openai.chat.completions.create({
            model,
            messages: apiMessages,
            temperature: 0.7,
            max_tokens: 500,
        })
    );

    await job.updateProgress(80);

    const responseText = response.choices[0]?.message?.content || 'No response generated';
    const promptTokens = response.usage?.prompt_tokens || 0;
    const completionTokens = response.usage?.completion_tokens || 0;

    // Calculate cost (GPT-4 Turbo pricing)
    const cost = (promptTokens / 1000) * 0.01 + (completionTokens / 1000) * 0.03;

    return {
        response: responseText,
        usage: {
            promptTokens,
            completionTokens,
            totalTokens: promptTokens + completionTokens,
            cost,
        },
    };
}

/**
 * Process a select experts job
 */
async function processSelectExperts(
    job: Job<SelectExpertsJobData>
): Promise<SelectExpertsResult> {
    const { topic, expertType, count = 2 } = job.data;

    console.log(`[Worker] Processing select-experts for topic: ${topic}`);

    const openai = getOpenAIClient();
    const model = process.env.OPENAI_MODEL || 'gpt-4-turbo';

    await job.updateProgress(20);

    const prompt = expertType === 'historical'
        ? `Select ${count} historical figures who would have opposing perspectives on: "${topic}". 
           Choose real historical figures known for their expertise and strong opinions.`
        : `Create ${count} AI expert personas with opposing perspectives on: "${topic}".
           Give each a unique identifier and specialized expertise.`;

    const response = await withOpenAIRetry(() =>
        openai.chat.completions.create({
            model,
            messages: [
                {
                    role: 'system',
                    content: `You are an expert at selecting debaters. Return JSON with an array of experts.
Each expert should have: name, background (2-3 sentences), stance (pro or con), perspective (their viewpoint), expertise (array of 3-5 areas).`,
                },
                { role: 'user', content: prompt },
            ],
            response_format: { type: 'json_object' },
            temperature: 0.7,
        })
    );

    await job.updateProgress(70);

    const result = JSON.parse(response.choices[0]?.message?.content || '{"experts":[]}');
    
    // Add IDs if missing
    const experts = (result.experts || []).map((e: any, i: number) => ({
        id: e.id || `expert-${Date.now()}-${i}`,
        name: e.name,
        background: e.background,
        stance: i === 0 ? 'pro' : 'con',
        perspective: e.perspective,
        expertise: e.expertise || [],
    }));

    return { experts };
}

/**
 * Process an extract topics job
 */
async function processExtractTopics(
    job: Job<ExtractTopicsJobData>
): Promise<ExtractTopicsResult> {
    const { content, maxTopics = 5 } = job.data;

    console.log(`[Worker] Processing extract-topics`);

    const openai = getOpenAIClient();
    const model = process.env.OPENAI_MODEL || 'gpt-4-turbo';

    await job.updateProgress(20);

    // Truncate content if too long
    const truncatedContent = content.length > 8000 
        ? content.substring(0, 8000) + '...' 
        : content;

    const response = await withOpenAIRetry(() =>
        openai.chat.completions.create({
            model,
            messages: [
                {
                    role: 'system',
                    content: `Extract ${maxTopics} debate-worthy topics from the content. 
Return JSON with topics array, each having: title, confidence (0-1), keywords (array), summary.`,
                },
                { role: 'user', content: truncatedContent },
            ],
            response_format: { type: 'json_object' },
            temperature: 0.5,
        })
    );

    await job.updateProgress(80);

    const result = JSON.parse(response.choices[0]?.message?.content || '{"topics":[]}');

    return {
        topics: result.topics || [],
    };
}

/**
 * Process a generate summary job
 */
async function processGenerateSummary(
    job: Job<GenerateSummaryJobData>
): Promise<GenerateSummaryResult> {
    const { messages, topic } = job.data;

    console.log(`[Worker] Processing generate-summary for: ${topic}`);

    const openai = getOpenAIClient();
    const model = process.env.OPENAI_MODEL || 'gpt-4-turbo';

    await job.updateProgress(20);

    // Format messages for summarization
    const debateTranscript = messages
        .map(m => `${m.speaker || m.role}: ${m.content}`)
        .join('\n\n');

    const response = await withOpenAIRetry(() =>
        openai.chat.completions.create({
            model,
            messages: [
                {
                    role: 'system',
                    content: `Summarize this debate on "${topic}". 
Return JSON with: summary (2-3 paragraphs), keyPoints (array of key arguments from both sides).`,
                },
                { role: 'user', content: debateTranscript },
            ],
            response_format: { type: 'json_object' },
            temperature: 0.5,
        })
    );

    await job.updateProgress(80);

    const result = JSON.parse(response.choices[0]?.message?.content || '{}');

    return {
        summary: result.summary || 'No summary generated',
        keyPoints: result.keyPoints || [],
    };
}

/**
 * Main job processor
 */
async function processJob(job: Job<LLMJobData>): Promise<any> {
    const { jobId, type } = job.data;

    console.log(`[Worker] Processing job ${jobId} of type ${type}`);

    // Update job status to processing
    await prisma.job.update({
        where: { id: jobId },
        data: { 
            status: 'PROCESSING',
            startedAt: new Date(),
            attempts: { increment: 1 },
        },
    });

    try {
        let result;

        switch (type) {
            case 'GENERATE_RESPONSE':
                result = await processGenerateResponse(job as Job<GenerateResponseJobData>);
                break;
            case 'SELECT_EXPERTS':
                result = await processSelectExperts(job as Job<SelectExpertsJobData>);
                break;
            case 'EXTRACT_TOPICS':
                result = await processExtractTopics(job as Job<ExtractTopicsJobData>);
                break;
            case 'GENERATE_SUMMARY':
                result = await processGenerateSummary(job as Job<GenerateSummaryJobData>);
                break;
            default:
                throw new Error(`Unknown job type: ${type}`);
        }

        // Update job as completed
        await prisma.job.update({
            where: { id: jobId },
            data: {
                status: 'COMPLETED',
                progress: 100,
                result: result as any,
                completedAt: new Date(),
            },
        });

        console.log(`[Worker] Completed job ${jobId}`);
        return result;

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`[Worker] Job ${jobId} failed:`, errorMessage);

        // Update job as failed
        await prisma.job.update({
            where: { id: jobId },
            data: {
                status: 'FAILED',
                error: errorMessage,
                completedAt: new Date(),
            },
        });

        throw error;
    }
}

/**
 * Start the worker
 */
export function startWorker(): Worker<LLMJobData> {
    if (llmWorker) {
        console.log('[Worker] Worker already running');
        return llmWorker;
    }

    const connection = getRedisConnection();

    llmWorker = new Worker<LLMJobData>(
        QUEUE_NAMES.LLM_JOBS,
        processJob,
        {
            connection,
            concurrency: 3, // Process up to 3 jobs at once
            limiter: {
                max: 10, // Max 10 jobs per minute (OpenAI rate limits)
                duration: 60000,
            },
        }
    );

    // Event handlers
    llmWorker.on('completed', (job) => {
        console.log(`[Worker] Job ${job.id} completed successfully`);
    });

    llmWorker.on('failed', (job, error) => {
        console.error(`[Worker] Job ${job?.id} failed:`, error.message);
    });

    llmWorker.on('error', (error) => {
        console.error('[Worker] Worker error:', error);
    });

    console.log('[Worker] LLM worker started');
    return llmWorker;
}

/**
 * Stop the worker gracefully
 */
export async function stopWorker(): Promise<void> {
    if (llmWorker) {
        await llmWorker.close();
        llmWorker = null;
        console.log('[Worker] Worker stopped');
    }
}

/**
 * Check if worker is running
 */
export function isWorkerRunning(): boolean {
    return llmWorker !== null;
}
