/**
 * PerplexityService
 * 
 * A dedicated service for handling Perplexity API calls for recommended readings.
 * This separates the Perplexity API functionality from the OpenAI debate responses.
 */

import { type Expert } from '@/types/expert';

// Interface for reading results
export interface PerplexityReading {
    id: string;
    url: string;
    title: string;
    snippet: string;
    published_date?: string;
    author?: string;
    source?: string;
}

// Interface for reading errors
export interface ReadingError {
    expert: string;
    error: string;
}

export class PerplexityService {
    private static instance: PerplexityService;
    private isLoading = false;
    private cache = new Map<string, PerplexityReading[]>();
    private lastFetchTime = new Map<string, number>();
    private readonly CACHE_LIFETIME = 1000 * 60 * 30; // 30 minutes

    private constructor() { }

    public static getInstance(): PerplexityService {
        if (!PerplexityService.instance) {
            PerplexityService.instance = new PerplexityService();
        }
        return PerplexityService.instance;
    }

    /**
     * Get recommended readings for a single expert
     */
    public async getExpertReadings(expertName: string, topic: string): Promise<PerplexityReading[]> {
        const cacheKey = `${expertName}:${topic}`;

        // Check cache first if not expired
        if (this.cache.has(cacheKey)) {
            const lastFetch = this.lastFetchTime.get(cacheKey) || 0;
            if (Date.now() - lastFetch < this.CACHE_LIFETIME) {
                console.log(`Using cached Perplexity results for ${expertName} on ${topic}`);
                return this.cache.get(cacheKey) || [];
            }
        }

        try {
            console.log(`Fetching Perplexity readings for ${expertName} on topic: ${topic}`);

            const response = await fetch('/api/perplexity/single-expert', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ expertName, topic })
            });

            if (!response.ok) {
                // If rate limited, return empty but don't cache
                if (response.status === 429) {
                    console.warn(`Perplexity API rate limited for ${expertName}`);
                    return [];
                }
                throw new Error(`API error: ${response.status}`);
            }

            const data = await response.json();
            const readings = data.readings || [];

            // Cache the successful result
            this.cache.set(cacheKey, readings);
            this.lastFetchTime.set(cacheKey, Date.now());

            return readings;
        } catch (error) {
            console.error(`Error fetching Perplexity readings for ${expertName}:`, error);
            return [];
        }
    }

    /**
     * Get recommended readings for multiple experts
     */
    public async getMultiExpertReadings(
        experts: Expert[],
        topic: string
    ): Promise<{ results: Record<string, PerplexityReading[]>, errors: ReadingError[] }> {
        const results: Record<string, PerplexityReading[]> = {};
        const errors: ReadingError[] = [];

        // Set loading state
        this.isLoading = true;

        try {
            // Process each expert in parallel
            await Promise.all(experts.map(async (expert) => {
                try {
                    const expertName = expert.name;
                    const readings = await this.getExpertReadings(expertName, topic);
                    results[expertName] = readings;
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                    errors.push({
                        expert: expert.name,
                        error: errorMessage
                    });
                    results[expert.name] = [];
                }
            }));

            return { results, errors };
        } catch (error) {
            console.error('Error in getMultiExpertReadings:', error);

            // If global error, add it for all experts
            if (errors.length === 0) {
                errors.push({
                    expert: 'all',
                    error: error instanceof Error ? error.message : 'Failed to fetch recommended readings'
                });
            }

            return { results, errors };
        } finally {
            this.isLoading = false;
        }
    }

    /**
     * Check if the service is currently loading
     */
    public isLoadingReadings(): boolean {
        return this.isLoading;
    }

    /**
     * Clear the cache
     */
    public clearCache(): void {
        this.cache.clear();
        this.lastFetchTime.clear();
    }
} 