/**
 * Perplexity API Client
 * 
 * This module provides functions to interact with the Perplexity API
 * for fetching relevant links and information based on topics.
 * 
 * NOTE: This implementation uses the Chat Completions API instead of the Search API
 * since the current API key only has access to chat completions.
 */

// Import node-fetch for server-side fetching
import nodeFetch from 'node-fetch';

// Define the Perplexity API key and base URL
const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;
const PERPLEXITY_API_BASE_URL = 'https://api.perplexity.ai';

// Use the appropriate fetch implementation based on environment
const fetchImpl = typeof window === 'undefined' ? nodeFetch : window.fetch;

// Interface for search result
interface PerplexitySearchResult {
    id: string;
    url: string;
    title: string;
    snippet: string;
    published_date?: string;
    author?: string;
    source?: string;
    isValidUrl?: boolean; // Add flag to track URL validation
}

/**
 * Validates if a URL is accessible and returns a 200 status
 * @param url - The URL to validate
 * @returns Promise<boolean> - true if URL is accessible, false otherwise
 */
async function validateUrl(url: string): Promise<boolean> {
    try {
        // Skip validation for obviously fake URLs
        if (!url || url.includes('example.com') || url.includes('placeholder') || !url.startsWith('http')) {
            console.log(`[validateUrl] Skipping obviously fake URL: ${url}`);
            return false;
        }

        console.log(`[validateUrl] Checking URL: ${url}`);

        // Use HEAD request to check if URL exists without downloading content
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout for validation

        const response = await nodeFetch(url, {
            method: 'HEAD',
            signal: controller.signal,
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; DebateApp/1.0; URL Validator)',
            },
            // Don't follow redirects to avoid infinite loops
            redirect: 'manual'
        });

        clearTimeout(timeoutId);

        // Consider 200, 301, 302 as valid (redirects are often valid)
        const isValid = response.status === 200 || (response.status >= 300 && response.status < 400);
        console.log(`[validateUrl] URL ${url} validation result: ${isValid ? 'VALID' : 'INVALID'} (status: ${response.status})`);

        return isValid;
    } catch (error) {
        console.log(`[validateUrl] URL ${url} validation failed: ${error.message}`);
        return false;
    }
}

/**
 * Validates multiple URLs in parallel with a limit on concurrent requests
 * @param readings - Array of readings with URLs to validate
 * @returns Promise<PerplexitySearchResult[]> - Array with only valid URLs
 */
async function validateReadingUrls(readings: any[]): Promise<PerplexitySearchResult[]> {
    console.log(`[validateReadingUrls] Starting validation of ${readings.length} URLs`);

    const validatedReadings = await Promise.all(
        readings.map(async (reading, index) => {
            const isValidUrl = await validateUrl(reading.url);
            return {
                ...reading,
                isValidUrl,
                id: reading.id || `perplexity-${Date.now()}-${index}`,
            };
        })
    );

    // Filter to only include valid URLs
    const validReadings = validatedReadings.filter(reading => reading.isValidUrl);
    const invalidCount = validatedReadings.length - validReadings.length;

    console.log(`[validateReadingUrls] Validation complete. Valid: ${validReadings.length}, Invalid: ${invalidCount}`);

    if (invalidCount > 0) {
        console.log('[validateReadingUrls] Removed invalid URLs:',
            validatedReadings.filter(r => !r.isValidUrl).map(r => r.url)
        );
    }

    return validReadings;
}

/**
 * Extracts JSON from a markdown-formatted string
 * The Chat API often returns JSON wrapped in a markdown code block
 */
function extractJsonFromMarkdown(content: string): any {
    try {
        // Try to parse as-is first
        return JSON.parse(content);
    } catch (e) {
        // Extract JSON from markdown code block if present
        const jsonBlockRegex = /```(?:json)?\s*(\[[\s\S]*?\])\s*```/;
        const jsonMatch = content.match(jsonBlockRegex);

        if (jsonMatch && jsonMatch[1]) {
            try {
                return JSON.parse(jsonMatch[1]);
            } catch (jsonError) {
                console.error('Failed to parse extracted JSON:', jsonError);
            }
        }

        // As a last resort, try to manually extract data using regex
        try {
            const titles = content.match(/title['"]\s*:\s*['"](.*?)['"]/g);
            const urls = content.match(/url['"]\s*:\s*['"](.*?)['"]/g);
            const snippets = content.match(/snippet['"]\s*:\s*['"](.*?)['"]/g);

            if (titles && urls && snippets && titles.length === urls.length && urls.length === snippets.length) {
                const manualReadings = [];
                for (let i = 0; i < titles.length; i++) {
                    const title = titles[i].match(/:\s*['"](.*?)['"]/)[1];
                    const url = urls[i].match(/:\s*['"](.*?)['"]/)[1];
                    const snippet = snippets[i].match(/:\s*['"](.*?)['"]/)[1];

                    manualReadings.push({
                        id: `manual-${Date.now()}-${i}`,
                        title,
                        url,
                        snippet
                    });
                }

                return manualReadings;
            }
        } catch (manualError) {
            console.error('Failed manual extraction:', manualError);
        }

        throw new Error('Could not extract valid JSON from response');
    }
}

// Helper function to sanitize names for OpenAI API
function sanitizeNameForOpenAI(name: string | undefined): string | undefined {
    if (!name) return undefined;
    // Added + to regex to handle consecutive invalid chars
    return name.replace(/[^a-zA-Z0-9_-]+/g, '_');
}

/**
 * Server-side fetch implementation for Perplexity API
 * This function handles the API call on the server
 */
async function serverFetchFromPerplexity(url: string, options: any) {
    try {
        // *** ADD LOGGING HERE ***
        const apiKeyUsed = options?.headers?.Authorization?.replace('Bearer ', '') || 'No API Key Found in Headers';
        console.log(`[serverFetchFromPerplexity] Attempting fetch to ${url}. Key used (masked): ${apiKeyUsed.substring(0, 5)}...${apiKeyUsed.substring(apiKeyUsed.length - 4)}`);

        // Log request details
        const requestBody = JSON.parse(options?.body || '{}');
        console.log(`[serverFetchFromPerplexity] Request model: ${requestBody.model || 'Not specified'}`);
        console.log(`[serverFetchFromPerplexity] Request timeout: ${options?.signal ? 'Set' : 'Not set'}`);

        // *** END LOGGING ***

        console.log('Server fetch:', url);
        const response = await nodeFetch(url, options);
        // Log response status immediately
        console.log(`[serverFetchFromPerplexity] Response status from ${url}: ${response.status}`);

        // Clone the response to debug specific error types
        if (!response.ok) {
            try {
                const clonedResponse = response.clone();
                const errorText = await clonedResponse.text();
                console.error(`[serverFetchFromPerplexity] Error response: ${errorText.substring(0, 200)}...`);

                // Check for specific error types
                if (response.status === 401 || response.status === 403) {
                    console.error('[serverFetchFromPerplexity] Authentication error - check API key');
                } else if (response.status === 429) {
                    console.error('[serverFetchFromPerplexity] Rate limit exceeded');
                } else if (response.status === 404) {
                    console.error('[serverFetchFromPerplexity] Endpoint not found');
                } else if (response.status === 400) {
                    console.error('[serverFetchFromPerplexity] Bad request - check model name and parameters');

                    // Log model name specifically for 400 errors as it might be invalid
                    if (requestBody.model) {
                        console.error(`[serverFetchFromPerplexity] Model name used: "${requestBody.model}"`);
                        console.error('[serverFetchFromPerplexity] Valid models are: "sonar", "sonar-pro", "sonar-reasoning", "sonar-reasoning-pro"');
                    }
                }
            } catch (parseError) {
                console.error('[serverFetchFromPerplexity] Could not parse error response:', parseError);
            }
        }

        return response;
    } catch (error) {
        console.error('[serverFetchFromPerplexity] Server fetch error:', error);
        // Check for timeout/abort errors
        if (error.name === 'AbortError') {
            console.error('[serverFetchFromPerplexity] Request timed out or was aborted');
        }
        throw error;
    }
}

/**
 * Fetches topic-focused recommended readings using the Chat Completions API
 * 
 * @param expertName - The name or role of the expert (not used in server logic, only for client caching)
 * @param topic - The debate topic (primary focus for recommendations)
 * @param expertType - Optional parameter to specify if the expert is 'historical' or 'ai'
 * @returns Promise with an array of search results
 */
export async function getExpertRecommendedReading(
    expertName: string,
    topic: string,
    expertType?: 'historical' | 'ai'
): Promise<PerplexitySearchResult[]> {
    try {
        // Handle client-side vs server-side
        const isClient = typeof window !== 'undefined';

        console.log(`[getExpertRecommendedReading] Starting request for topic: "${topic}" (expert: ${expertName}, type: ${expertType || 'not specified'})`);

        if (isClient) {
            // In the browser, use the API route
            console.log('[getExpertRecommendedReading] Running in client environment, using API route /api/perplexity/single-expert');
            try {
                const response = await fetch('/api/perplexity/single-expert', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ expertName, topic, expertType })
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    console.error(`[getExpertRecommendedReading] API route error: ${response.status}. Response: ${errorText}`);
                    throw new Error(`API route error: ${response.status}`);
                }

                const data = await response.json();
                console.log('[getExpertRecommendedReading] Successfully fetched from API route.')
                return data.readings || [];
            } catch (clientError) {
                console.error('[getExpertRecommendedReading] Error fetching through API route:', clientError);
                throw clientError;
            }
        }

        // Server-side code - direct API access
        console.log('[getExpertRecommendedReading] Running in server environment, using direct API access.');

        // *** ADD LOGGING HERE ***
        const perplexityKey = process.env.PERPLEXITY_API_KEY;
        if (!perplexityKey) {
            console.error('[getExpertRecommendedReading] PERPLEXITY_API_KEY environment variable is not set!');
            throw new Error('Perplexity API key not configured on server.');
        }
        console.log(`[getExpertRecommendedReading] Found PERPLEXITY_API_KEY. Length: ${perplexityKey.length}. Value (masked): ${perplexityKey.substring(0, 5)}...${perplexityKey.substring(perplexityKey.length - 4)}`);
        // *** END LOGGING ***

        // Create a prompt for the Chat API based on whether this is a historical expert or not
        let prompt: string;

        // For historical experts, we specifically want their original writings/publications
        if (expertType === 'historical') {
            prompt = `
            Please provide authentic readings BY the historical figure ${expertName} that are relevant to the topic of "${topic}".
            
            I need ONLY primary sources actually written or spoken by ${expertName} - books, essays, speeches, letters, or other published works.
            
            IMPORTANT: You must provide REAL, WORKING URLs that are currently accessible. Do not provide:
            - Example URLs (example.com) 
            - Placeholder URLs
            - URLs you are not certain exist
            - Broken or dead links
            
            Use legitimate sources like:
            - Project Gutenberg for public domain texts
            - Archive.org for historical documents
            - University digital libraries
            - Government archives and libraries
            - Established academic databases
            
            If there are no direct works by ${expertName} on this specific topic, find their writings that most closely relate to this issue
            or that articulate their general philosophy on related matters.
            
            For each recommendation, include:
            - Title of the work
            - Year published/delivered  
            - URL to access the full text if available (MUST be real and working)
            - Brief explanation of how this work relates to "${topic}" and what position ${expertName} takes
            
            Additionally, include 1-2 high-quality secondary sources (biographies, analyses) that specifically discuss ${expertName}'s views on this topic.
            
            If you cannot find real, accessible URLs for some works, provide fewer sources with working links rather than fake URLs.
            
            Return the results in the following JSON format:
            [
                {
                    "title": "Title of Work by ${expertName}",
                    "url": "https://real-working-url.com/work",
                    "source": "Book/Essay/Speech/Letter",
                    "year": "Year published",
                    "snippet": "Brief explanation of how this work relates to the topic and ${expertName}'s position"
                },
                {
                    "title": "Another Work by ${expertName}",
                    "url": "https://real-working-url.com/work2", 
                    "source": "Book/Essay/Speech/Letter",
                    "year": "Year published",
                    "snippet": "Brief explanation of how this work relates to the topic and ${expertName}'s position"
                },
                {
                    "title": "Biography/Analysis of ${expertName}'s views",
                    "url": "https://real-working-url.com/analysis",
                    "source": "Secondary Source",
                    "year": "Year published",
                    "snippet": "Brief explanation of how this source illuminates ${expertName}'s views on the topic"
                }
            ]
            `;
        } else {
            // Standard topic-based prompt for AI experts or unspecified types
            prompt = `
            Please provide diverse and balanced recommended readings on the topic of "${topic}".
            
            Include readings with DIFFERENT perspectives and viewpoints, making sure to cover both supportive and critical stances on the issue.
            
            IMPORTANT: You must provide REAL, WORKING URLs that are currently accessible. Do not provide:
            - Example URLs (example.com)
            - Placeholder URLs
            - URLs you are not certain exist
            - Broken or dead links
            
            Required sources (include at least one from each category):
            1. An academic paper or research publication (use Google Scholar, arXiv, or university sites)
            2. A book or book chapter (use Google Books, Amazon, or publisher sites)
            3. A relevant Reddit subreddit or topic area (use reddit.com/r/subredditname URLs, not specific posts)
            4. A well-regarded blog post, news article, or opinion piece (use major news sites)
            5. A video lecture, documentary, or podcast (use YouTube, Coursera, or podcast platforms)
            
            For controversial topics, ensure balanced representation from different viewpoints.
            
            Each recommendation should include:
            - Title
            - URL (MUST be a real, working, accessible link - verify it exists)
            - Source type (Academic, Book, Reddit Community, Blog/News, Media)
            - Brief description explaining the value and perspective it offers
            
            For Reddit: Provide subreddit URLs (reddit.com/r/subredditname) where ongoing discussions about the topic occur, rather than specific posts which may be deleted or archived.
            
            If you cannot find real URLs for a source type, provide fewer sources with working links rather than fake URLs.
            
            Return the results in the following JSON format:
            [
                {
                    "title": "Title of Resource 1",
                    "url": "https://real-working-url.com/resource1",
                    "source": "Academic Paper", 
                    "snippet": "Brief description of why this resource is valuable for understanding the topic"
                },
                {
                    "title": "Title of Resource 2",
                    "url": "https://real-working-url.com/resource2",
                    "source": "Book",
                    "snippet": "Brief description of why this resource is valuable and what perspective it offers"
                },
                {
                    "title": "Title of Resource 3",
                    "url": "https://reddit.com/r/relevantsubreddit",
                    "source": "Reddit Community",
                    "snippet": "Brief description of why this subreddit community provides valuable discussions and perspectives"
                },
                {
                    "title": "Title of Resource 4",
                    "url": "https://real-working-url.com/resource4",
                    "source": "News Article",
                    "snippet": "Brief description of the perspective this article provides on the topic"
                },
                {
                    "title": "Title of Resource 5",
                    "url": "https://real-working-url.com/resource5",
                    "source": "Video Lecture",
                    "snippet": "Brief description of what makes this video valuable for understanding the topic"
                }
            ]
            `;
        }

        // System message based on expert type
        const systemMessage = expertType === 'historical'
            ? 'You are a specialized historical research assistant with expertise in finding primary sources written by historical figures. You focus on identifying authentic writings, speeches, and publications that accurately represent the historical figure\'s actual views on specific topics. Always format your response as valid JSON. CRITICALLY IMPORTANT: Only provide URLs that actually exist and are accessible. Do not provide example.com URLs or fictional links.'
            : 'You are a helpful assistant specialized in finding diverse, high-quality reading materials on various topics. You excel at identifying valuable resources from different perspectives, ensuring a balanced view of both supporting and critical viewpoints. Always format your response as valid JSON. CRITICALLY IMPORTANT: Ensure all URLs are real, accessible links that currently exist. Use your knowledge of actual websites and verify URLs are properly formatted and likely to work.';

        // Make the request to the Perplexity Chat API
        try {
            const requestOptions = {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    // Ensure the correct key from process.env is used here
                    'Authorization': `Bearer ${perplexityKey}`
                },
                body: JSON.stringify({
                    // Use a reliable model like llama-3-sonar-small-32k-online or llama-3-sonar-large-32k-online
                    model: 'sonar',
                    messages: [
                        {
                            role: 'system',
                            content: systemMessage
                        },
                        {
                            role: 'user',
                            content: prompt
                        }
                    ]
                })
            };

            // Enhanced debugging for API key
            console.log(`[getExpertRecommendedReading] 🔑 API key check - Length: ${perplexityKey.length}, First chars: ${perplexityKey.substring(0, 5)}..., API URL: ${PERPLEXITY_API_BASE_URL}/chat/completions`);

            // Set timeout for API request
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

            // Use the server-specific implementation for Node.js
            const response = await serverFetchFromPerplexity(
                `${PERPLEXITY_API_BASE_URL}/chat/completions`,
                {
                    ...requestOptions,
                    signal: controller.signal
                }
            );

            // Clear timeout after response
            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`[getExpertRecommendedReading] Perplexity API error: ${response.status}. Response: ${errorText}`);

                // Check for common API key errors
                if (response.status === 401 || response.status === 403) {
                    console.error(`[getExpertRecommendedReading] 🔴 AUTHENTICATION ERROR: This appears to be an API key issue. Status: ${response.status}`);
                    console.error(`[getExpertRecommendedReading] 🔑 Key details: Length=${perplexityKey.length}, Prefix=${perplexityKey.substring(0, 5)}...`);
                    throw new Error(`Perplexity API authentication failed: ${response.status}. Please check your API key.`);
                }

                // Check for rate limiting
                if (response.status === 429) {
                    console.error(`[getExpertRecommendedReading] 🔴 RATE LIMIT EXCEEDED: Perplexity API rate limit reached. Status: ${response.status}`);
                    throw new Error(`Perplexity API rate limit exceeded. Please try again later.`);
                }

                // Don't fallback here, let the error propagate to the calling API route
                throw new Error(`Perplexity API request failed: ${response.status}. Response: ${errorText.substring(0, 200)}`);
            }

            const data = await response.json();

            if (!data.choices || !data.choices.length) {
                console.error('Invalid response format from Perplexity API');
                throw new Error('Invalid response format from Perplexity API');
            }

            // Extract and process the content
            const content = data.choices[0].message.content;
            console.log(`[getExpertRecommendedReading] Raw content from API (first 200 chars): ${content.substring(0, 200)}...`);

            try {
                const readings = extractJsonFromMarkdown(content);
                console.log(`[getExpertRecommendedReading] Successfully extracted ${readings.length} readings from response`);

                // Add IDs to readings if they don't have them and ensure year is included for historical experts
                const validatedReadings = await validateReadingUrls(readings.map((reading: any, index: number) => ({
                    id: reading.id || `perplexity-${Date.now()}-${index}`,
                    url: reading.url,
                    title: reading.title,
                    snippet: reading.snippet,
                    source: reading.source || "Resource",
                    year: reading.year || undefined,
                    isPrimarySource: expertType === 'historical' && reading.source !== 'Secondary Source'
                })));

                // Check if we have enough valid readings
                if (validatedReadings.length === 0) {
                    console.warn(`[getExpertRecommendedReading] No valid URLs found for topic: "${topic}". All ${readings.length} URLs were invalid.`);
                    // Return original readings but mark them as potentially invalid
                    return readings.map((reading: any, index: number) => ({
                        id: reading.id || `perplexity-${Date.now()}-${index}`,
                        url: reading.url,
                        title: reading.title,
                        snippet: reading.snippet + " (URL not verified)",
                        source: reading.source || "Resource",
                        year: reading.year || undefined,
                        isPrimarySource: expertType === 'historical' && reading.source !== 'Secondary Source',
                        isValidUrl: false
                    }));
                } else if (validatedReadings.length < readings.length / 2) {
                    console.warn(`[getExpertRecommendedReading] Many invalid URLs found for topic: "${topic}". Valid: ${validatedReadings.length}/${readings.length}`);
                }

                console.log(`[getExpertRecommendedReading] Returning ${validatedReadings.length} validated readings for topic: "${topic}"`);
                return validatedReadings;
            } catch (extractError) {
                console.error(`[getExpertRecommendedReading] Failed to extract readings from content: ${extractError}`);
                throw extractError;
            }

        } catch (fetchError) {
            console.error('[getExpertRecommendedReading] Network error fetching from Perplexity API:', fetchError);
            // Let the error propagate
            throw fetchError;
        }
    } catch (error) {
        console.error('[getExpertRecommendedReading] Error:', error);
        // Let the error propagate instead of falling back to mocks
        throw error;
    }
}

/**
 * Fetches recommended reading links for multiple experts on a topic
 * 
 * @param experts - Array of experts with their topics
 * @returns Promise with an array of expert readings
 */
export async function getMultiExpertRecommendedReading(
    experts: Array<{ role: string, topic: string }> | Array<{ name: string, type?: string, expertise?: string | string[] }>
): Promise<any[]> {
    try {
        if (!Array.isArray(experts) || experts.length === 0) {
            throw new Error('Invalid experts array');
        }

        // Handle client-side vs server-side
        const isClient = typeof window !== 'undefined';

        if (isClient) {
            // In the browser, use the API route to avoid CORS issues
            console.log('Running in client environment, using API route for multi-expert');
            try {
                const response = await fetch('/api/perplexity', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        experts,
                        topic: 'role' in experts[0] ? experts[0].topic : ''
                    })
                });

                if (!response.ok) {
                    throw new Error(`API route error: ${response.status}`);
                }

                const data = await response.json();

                // Convert the response format to what we expect
                return Object.entries(data).map(([expertName, readings]) => ({
                    expert: expertName,
                    readings
                }));
            } catch (clientError) {
                console.error('Error fetching through API route:', clientError);
                throw clientError;
            }
        }

        // Server-side code - process each expert in parallel
        console.log('Running in server environment, direct API access for multi-expert');
        const promises = experts.map(expert => {
            const expertName = 'role' in expert ? expert.role : expert.name;
            const topic = 'role' in expert ? expert.topic :
                Array.isArray(expert.expertise) ? expert.expertise[0] :
                    (expert.expertise as string || 'general topics');

            return getExpertRecommendedReading(expertName, topic)
                .then(readings => ({
                    expert: expertName,
                    readings
                }))
                .catch(error => {
                    console.error(`Error fetching readings for expert ${expertName}:`, error);
                    return {
                        expert: expertName,
                        readings: [],
                        error: error.message
                    };
                });
        });

        // Wait for all requests to complete
        return await Promise.all(promises);
    } catch (error) {
        console.error('Error in getMultiExpertRecommendedReading:', error);
        throw error;
    }
}