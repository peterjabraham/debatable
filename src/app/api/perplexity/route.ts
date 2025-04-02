import { NextResponse } from 'next/server';
import { getExpertRecommendedReading } from '@/lib/api/perplexity';
import { rateLimitTracker } from '@/lib/api/perplexity'; // Import the rate limit tracker

/**
 * Perplexity API Route
 * 
 * This route proxies requests to the Perplexity API.
 * It now uses the Chat Completions API instead of the Search API
 * because our API key only has access to chat completions.
 */

// Cache for API responses
const responseCache = new Map<string, { data: any, timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function POST(request: Request) {
    try {
        console.log('Perplexity API route called');

        // Parse request body
        const { experts, topic } = await request.json();
        console.log('Request params:', {
            experts: Array.isArray(experts) ? `${experts.length} experts` : 'invalid',
            topic: topic || 'not provided'
        });

        if (!Array.isArray(experts) || experts.length === 0) {
            const error = 'Invalid request parameters: experts must be a non-empty array';
            console.error(error);
            return NextResponse.json({ error }, { status: 400 });
        }

        // Create a cache key based on the request
        const cacheKey = `${JSON.stringify(experts)}-${topic}`;

        // Check cache first
        const cachedResponse = responseCache.get(cacheKey);
        if (cachedResponse && (Date.now() - cachedResponse.timestamp < CACHE_TTL)) {
            console.log('Returning cached response for', cacheKey);
            return NextResponse.json(cachedResponse.data);
        }

        // Check for global rate limiting - if we're rate limited, respond with 429
        if (rateLimitTracker.isRateLimited) {
            console.log(`API is rate limited until ${new Date(rateLimitTracker.cooldownUntil).toISOString()}`);
            const retryAfter = Math.ceil((rateLimitTracker.cooldownUntil - Date.now()) / 1000);

            return NextResponse.json(
                {
                    error: "Too many requests to Perplexity API",
                    retryAfter,
                    message: "Server is cooling down from rate limits, please try again later"
                },
                {
                    status: 429,
                    headers: {
                        'Retry-After': retryAfter.toString(),
                        'X-RateLimit-Reset': new Date(rateLimitTracker.cooldownUntil).toISOString()
                    }
                }
            );
        }

        // Process each expert SEQUENTIALLY to avoid rate limits
        const results: Record<string, any[]> = {};
        const errors: Record<string, string> = {};

        // Using a sequential for loop instead of Promise.all
        for (const expert of experts) {
            try {
                const expertName = expert.name || expert.role;
                const expertTopic = topic || (expert.topic || '');

                console.log(`Processing expert: ${expertName} with topic: ${expertTopic}`);

                // Add a delay between API calls to avoid rate limits
                if (Object.keys(results).length > 0) {
                    // Wait 2 seconds between calls to stay comfortably under rate limits
                    await new Promise(resolve => setTimeout(resolve, 2000));

                    // If we became rate limited during processing, stop and return what we have
                    if (rateLimitTracker.isRateLimited) {
                        console.log('Rate limited during processing, returning partial results');
                        break;
                    }
                }

                // Use the getExpertRecommendedReading function which handles server-side fetching
                const readings = await getExpertRecommendedReading(expertName, expertTopic);
                console.log(`Retrieved ${readings.length} readings for ${expertName}`);

                results[expertName] = readings;
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                console.error(`Error processing expert ${expert.name || expert.role}:`, errorMessage);
                errors[expert.name || expert.role] = errorMessage;

                // If we're rate limited, don't try to process more experts
                if (rateLimitTracker.isRateLimited) {
                    break;
                }
            }
        }

        // Cache successful responses
        if (Object.keys(results).length > 0) {
            const responseData = {
                ...results,
                timestamp: new Date().toISOString()
            };

            responseCache.set(cacheKey, {
                data: responseData,
                timestamp: Date.now()
            });

            console.log('Completed API requests with results for', Object.keys(results).length, 'experts');

            // If there were errors, include them in the response
            if (Object.keys(errors).length > 0) {
                console.log('Some errors occurred:', errors);
                return NextResponse.json({
                    ...responseData,
                    errors
                });
            }

            return NextResponse.json(responseData);
        } else {
            // All experts failed
            return NextResponse.json(
                {
                    error: "Failed to retrieve data for any experts",
                    errors,
                    message: "Please try again later"
                },
                { status: 500 }
            );
        }
    } catch (error) {
        console.error('Error in Perplexity API route:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to fetch recommended readings' },
            { status: 500 }
        );
    }
}

/**
 * Generates mock results for development/testing
 */
function generateMockResults(experts: any[], topic: string) {
    const mockResults: Record<string, any[]> = {};

    experts.forEach(expert => {
        mockResults[expert.name] = [
            {
                id: `mock-${Date.now()}-1`,
                url: 'https://example.com/paper1',
                title: `${expert.name}'s Research on ${topic}`,
                snippet: `This is a mock research paper about ${expert.name}'s area of expertise related to ${topic}. It contains valuable insights and data.`
            },
            {
                id: `mock-${Date.now()}-2`,
                url: 'https://example.com/paper2',
                title: `Recent Developments in ${topic}`,
                snippet: 'This paper explores recent developments and breakthroughs in the field with practical applications.'
            },
            {
                id: `mock-${Date.now()}-3`,
                url: 'https://example.com/paper3',
                title: 'Comprehensive Literature Review',
                snippet: 'A thorough review of existing literature that synthesizes current knowledge and identifies gaps.'
            }
        ];
    });

    return mockResults;
} 