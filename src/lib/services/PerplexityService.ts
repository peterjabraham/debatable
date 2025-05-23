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
    year?: string;
    isPrimarySource?: boolean; // Indicates if this is a primary source written by the historical figure
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
     * Get recommended readings for a topic, with special handling for historical experts
     */
    public async getTopicReadings(topic: string, expert?: Expert): Promise<PerplexityReading[]> {
        // Create a unique cache key that includes the expert type if available
        const expertType = expert?.type || 'general';
        const expertName = expert?.name || 'Topic Expert';
        const cacheKey = `topic:${topic}:${expertType}:${expertName}`;

        // Check cache first if not expired
        if (this.cache.has(cacheKey)) {
            const lastFetch = this.lastFetchTime.get(cacheKey) || 0;
            if (Date.now() - lastFetch < this.CACHE_LIFETIME) {
                console.log(`Using cached Perplexity results for topic: ${topic} (expert type: ${expertType})`);
                return this.cache.get(cacheKey) || [];
            }
        }

        try {
            console.log(`Fetching Perplexity readings for topic: "${topic}" (expert type: ${expertType}, name: ${expertName})`);

            const response = await fetch('/api/perplexity/single-expert', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                // Pass expert type to API for specialized historical content
                body: JSON.stringify({
                    expertName,
                    topic,
                    expertType: expertType === 'historical' ? 'historical' : 'ai'
                })
            });

            console.log(`Perplexity API response status: ${response.status}`);

            if (!response.ok) {
                // If rate limited, return empty but don't cache
                if (response.status === 429) {
                    console.warn(`Perplexity API rate limited for topic: ${topic}`);
                    return [];
                }

                // Log the full error response
                try {
                    const errorText = await response.text();
                    console.error(`Perplexity API error (${response.status}) for topic ${topic}:`, errorText);
                } catch (textError) {
                    console.error(`Failed to read error response: ${textError}`);
                }

                // Log the error but don't throw - just return empty results
                console.warn(`Perplexity API error for topic ${topic}: HTTP ${response.status}`);
                return [];
            }

            // Log the full successful response
            try {
                const responseText = await response.clone().text();
                console.log(`Perplexity API raw response (first 100 chars): ${responseText.substring(0, 100)}...`);
            } catch (textError) {
                console.warn(`Could not log raw response: ${textError}`);
            }

            const data = await response.json();
            console.log(`Perplexity API response readings count: ${data.readings ? data.readings.length : 0}`);

            const readings = data.readings || [];

            // Log the readings we got
            if (readings.length > 0) {
                console.log(`Received ${readings.length} readings for topic ${topic}:`,
                    readings.map((r: any) => ({
                        title: r.title,
                        source: r.source,
                        isPrimary: r.isPrimarySource ? 'YES' : 'No',
                        year: r.year || 'N/A'
                    })));
            } else {
                console.warn(`No readings returned from API for topic: "${topic}"`);
            }

            // Cache the successful result
            this.cache.set(cacheKey, readings);
            this.lastFetchTime.set(cacheKey, Date.now());

            return readings;
        } catch (error) {
            console.error(`Error fetching Perplexity readings for topic ${topic}:`, error);
            return [];
        }
    }

    /**
     * Get recommended readings for multiple experts on a topic
     * Now with special handling for historical experts' writings
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
            // Check if we have any historical experts
            const hasHistoricalExperts = experts.some(expert => expert.type === 'historical');

            console.log(`Getting topic-based readings for: ${topic} (includes historical experts: ${hasHistoricalExperts ? 'YES' : 'no'})`);

            // If we have at least one historical expert, process each expert separately for personalized results
            if (hasHistoricalExperts) {
                console.log('Processing each expert individually to get personalized historical readings');

                // Process each expert in parallel
                await Promise.all(experts.map(async (expert) => {
                    try {
                        // Get readings specialized for this expert
                        const expertReadings = await this.getTopicReadings(topic, expert);

                        // Store the readings for this expert
                        results[expert.name] = expertReadings;

                        if (expertReadings.length === 0) {
                            console.warn(`No readings found for expert: ${expert.name} (${expert.type})`);
                        } else {
                            console.log(`Retrieved ${expertReadings.length} readings for ${expert.name} (${expert.type})`);
                        }
                    } catch (expertError) {
                        console.error(`Error getting readings for ${expert.name}:`, expertError);
                        results[expert.name] = [];
                        errors.push({
                            expert: expert.name,
                            error: expertError instanceof Error ? expertError.message : 'Unknown error'
                        });
                    }
                }));

                // Check if we have any results at all
                const totalReadings = Object.values(results).reduce((sum, readings) => sum + readings.length, 0);
                if (totalReadings === 0) {
                    console.warn(`No readings found for any experts on topic: "${topic}"`);
                    errors.push({
                        expert: 'all',
                        error: 'No reading recommendations available at this time.'
                    });
                }
            } else {
                // Standard approach for non-historical experts - get a single set of readings
                try {
                    // Get readings based solely on the topic without expert specialization
                    const readings = await this.getTopicReadings(topic);

                    // Share the same readings across all experts
                    experts.forEach(expert => {
                        results[expert.name] = readings;
                    });

                    // If we got no readings, add a general error
                    if (readings.length === 0) {
                        console.warn(`No readings found for topic: "${topic}"`);
                        errors.push({
                            expert: 'all',
                            error: 'No reading recommendations available at this time.'
                        });
                    } else {
                        console.log(`Successfully retrieved ${readings.length} readings for topic: "${topic}"`);
                    }
                } catch (error) {
                    console.error('Error fetching topic readings:', error);
                    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                    errors.push({
                        expert: 'all',
                        error: 'Unable to retrieve reading recommendations'
                    });

                    // Set empty results for all experts
                    experts.forEach(expert => {
                        results[expert.name] = [];
                    });
                }
            }

            return { results, errors };
        } catch (error) {
            console.error('Error in getMultiExpertReadings:', error);

            // If global error, add it for all experts
            errors.push({
                expert: 'all',
                error: error instanceof Error ? error.message : 'Failed to fetch recommended readings'
            });

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