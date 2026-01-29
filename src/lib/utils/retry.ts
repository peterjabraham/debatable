/**
 * Retry Utilities
 * 
 * Provides exponential backoff retry logic for API calls.
 */

export interface RetryOptions {
    maxAttempts?: number;
    initialDelayMs?: number;
    maxDelayMs?: number;
    backoffMultiplier?: number;
    retryableErrors?: string[];
    onRetry?: (attempt: number, error: Error, delayMs: number) => void;
}

const DEFAULT_OPTIONS: Required<Omit<RetryOptions, 'onRetry'>> = {
    maxAttempts: 3,
    initialDelayMs: 1000,
    maxDelayMs: 30000,
    backoffMultiplier: 2,
    retryableErrors: [
        'ECONNRESET',
        'ETIMEDOUT',
        'ECONNREFUSED',
        'rate_limit_exceeded',
        'server_error',
        '429',
        '500',
        '502',
        '503',
        '504',
    ],
};

/**
 * Check if an error is retryable
 */
function isRetryableError(error: any, retryableErrors: string[]): boolean {
    const errorString = String(error?.message || error?.code || error).toLowerCase();
    
    // Check if error matches any retryable pattern
    return retryableErrors.some(pattern => 
        errorString.includes(pattern.toLowerCase())
    );
}

/**
 * Calculate delay with jitter for exponential backoff
 */
function calculateDelay(
    attempt: number,
    initialDelayMs: number,
    maxDelayMs: number,
    backoffMultiplier: number
): number {
    // Exponential backoff: delay = initial * multiplier^attempt
    const exponentialDelay = initialDelayMs * Math.pow(backoffMultiplier, attempt - 1);
    
    // Cap at max delay
    const cappedDelay = Math.min(exponentialDelay, maxDelayMs);
    
    // Add jitter (±25%) to prevent thundering herd
    const jitter = cappedDelay * 0.25 * (Math.random() * 2 - 1);
    
    return Math.round(cappedDelay + jitter);
}

/**
 * Sleep for a given number of milliseconds
 */
function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry a function with exponential backoff
 */
export async function withRetry<T>(
    fn: () => Promise<T>,
    options: RetryOptions = {}
): Promise<T> {
    const {
        maxAttempts,
        initialDelayMs,
        maxDelayMs,
        backoffMultiplier,
        retryableErrors,
    } = { ...DEFAULT_OPTIONS, ...options };

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));

            // Check if we should retry
            if (attempt >= maxAttempts) {
                console.error(`[Retry] All ${maxAttempts} attempts failed`);
                throw lastError;
            }

            if (!isRetryableError(error, retryableErrors)) {
                console.error('[Retry] Non-retryable error:', lastError.message);
                throw lastError;
            }

            // Calculate delay
            const delayMs = calculateDelay(attempt, initialDelayMs, maxDelayMs, backoffMultiplier);

            console.warn(
                `[Retry] Attempt ${attempt}/${maxAttempts} failed: ${lastError.message}. ` +
                `Retrying in ${delayMs}ms...`
            );

            // Call onRetry callback if provided
            options.onRetry?.(attempt, lastError, delayMs);

            // Wait before retrying
            await sleep(delayMs);
        }
    }

    // This should never be reached, but TypeScript needs it
    throw lastError || new Error('Unknown error');
}

/**
 * Create a retry wrapper for OpenAI API calls
 */
export function createOpenAIRetry(options: RetryOptions = {}) {
    const openAIOptions: RetryOptions = {
        maxAttempts: 3,
        initialDelayMs: 2000,
        maxDelayMs: 60000,
        backoffMultiplier: 2,
        retryableErrors: [
            'rate_limit_exceeded',
            'server_error',
            'timeout',
            '429',
            '500',
            '502',
            '503',
            '504',
            'ECONNRESET',
            'ETIMEDOUT',
        ],
        ...options,
    };

    return <T>(fn: () => Promise<T>) => withRetry(fn, openAIOptions);
}

// Pre-configured retry function for OpenAI
export const withOpenAIRetry = createOpenAIRetry();
