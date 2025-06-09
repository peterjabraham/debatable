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
 * Also validates URL format for specific source types
 * @param url - The URL to validate
 * @param source - The source type for additional validation
 * @returns Promise<boolean> - true if URL is accessible, false otherwise
 */
async function validateUrl(url: string, source?: string): Promise<boolean> {
    try {
        // Enhanced fake URL detection
        if (isFakeUrl(url)) {
            console.log(`[validateUrl] Detected fake URL: ${url}`);
            return false;
        }

        // Validate URL format for specific source types
        if (source) {
            const sourceValidation = validateSourceUrlFormat(url, source);
            if (!sourceValidation.isValid) {
                console.log(`[validateUrl] Invalid ${source} URL format: ${url} - ${sourceValidation.reason}`);
                return false;
            }
        }

        console.log(`[validateUrl] Testing URL accessibility: ${url}`);

        // Use HEAD request to check if URL exists without downloading content
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout for validation

        const response = await nodeFetch(url, {
            method: 'HEAD',
            signal: controller.signal,
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; DebateApp/1.0; URL Validator)',
                'Accept': '*/*',
                'Accept-Language': 'en-US,en;q=0.9',
            },
            // Follow redirects for better validation
            redirect: 'follow'
        });

        clearTimeout(timeoutId);

        // Consider 200-299 as valid, some sites return 202, 204, etc.
        const isValid = response.status >= 200 && response.status < 300;
        console.log(`[validateUrl] URL ${url} validation result: ${isValid ? 'VALID' : 'INVALID'} (status: ${response.status})`);

        // Additional check: if HEAD fails, try GET with partial content
        if (!isValid && response.status !== 404) {
            console.log(`[validateUrl] HEAD failed, trying GET request for: ${url}`);
            try {
                const getController = new AbortController();
                const getTimeoutId = setTimeout(() => getController.abort(), 5000);

                const getResponse = await nodeFetch(url, {
                    method: 'GET',
                    signal: getController.signal,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (compatible; DebateApp/1.0; URL Validator)',
                        'Range': 'bytes=0-1023', // Only get first 1KB
                    }
                });

                clearTimeout(getTimeoutId);
                const getIsValid = getResponse.status >= 200 && getResponse.status < 300;
                console.log(`[validateUrl] GET validation for ${url}: ${getIsValid ? 'VALID' : 'INVALID'} (status: ${getResponse.status})`);
                return getIsValid;
            } catch (getError) {
                console.log(`[validateUrl] GET request also failed for ${url}: ${getError.message}`);
                return false;
            }
        }

        return isValid;
    } catch (error) {
        console.log(`[validateUrl] URL ${url} validation failed: ${error.message}`);
        return false;
    }
}

/**
 * Validates URL format for specific source types
 * @param url - The URL to validate
 * @param source - The source type
 * @returns Object with validation result and reason
 */
function validateSourceUrlFormat(url: string, source: string): { isValid: boolean; reason?: string } {
    const lowerUrl = url.toLowerCase();

    switch (source.toLowerCase()) {
        case 'youtube video':
        case 'youtube':
            if (!lowerUrl.includes('youtube.com/watch?v=') && !lowerUrl.includes('youtu.be/')) {
                return { isValid: false, reason: 'Must be a YouTube video URL (youtube.com/watch?v= or youtu.be/)' };
            }
            break;

        case 'reddit discussion':
        case 'reddit':
            if (!lowerUrl.includes('reddit.com/r/') || !lowerUrl.includes('/comments/')) {
                return { isValid: false, reason: 'Must be a specific Reddit discussion URL with /comments/' };
            }
            break;

        case 'podcast episode':
        case 'podcast':
            if (!lowerUrl.includes('spotify.com') && !lowerUrl.includes('podcasts.apple.com') &&
                !lowerUrl.includes('podcast') && !lowerUrl.includes('anchor.fm')) {
                return { isValid: false, reason: 'Must be from a recognized podcast platform' };
            }
            break;

        case 'book':
            if (!lowerUrl.includes('books.google.com') && !lowerUrl.includes('amazon.com') &&
                !lowerUrl.includes('gutenberg.org') && !lowerUrl.includes('archive.org')) {
                return { isValid: false, reason: 'Must be from Google Books, Amazon, Project Gutenberg, or Archive.org' };
            }
            break;

        case 'academic paper':
        case 'academic':
            if (!lowerUrl.includes('scholar.google.com') && !lowerUrl.includes('researchgate.net') &&
                !lowerUrl.includes('arxiv.org') && !lowerUrl.includes('.edu') &&
                !lowerUrl.includes('doi.org') && !lowerUrl.includes('jstor.org')) {
                return { isValid: false, reason: 'Must be from Google Scholar, ResearchGate, arXiv, or academic institution' };
            }
            break;
    }

    return { isValid: true };
}

/**
 * Validates multiple URLs in parallel with a limit on concurrent requests
 * @param readings - Array of readings with URLs to validate
 * @returns Promise<PerplexitySearchResult[]> - Array with only valid URLs
 */
async function validateReadingUrls(readings: any[]): Promise<PerplexitySearchResult[]> {
    console.log(`[validateReadingUrls] Starting validation of ${readings.length} URLs`);

    // Set overall timeout for validation process
    const validationPromise = Promise.all(
        readings.map(async (reading, index) => {
            const isValidUrl = await validateUrl(reading.url, reading.source);
            return {
                ...reading,
                isValidUrl,
                id: reading.id || `perplexity-${Date.now()}-${index}`,
            };
        })
    );

    // Add timeout wrapper to prevent validation from taking too long
    const timeoutPromise = new Promise<any[]>((_, reject) => {
        setTimeout(() => reject(new Error('URL validation timeout')), 30000); // 30 second overall timeout
    });

    let validatedReadings: any[];
    try {
        validatedReadings = await Promise.race([validationPromise, timeoutPromise]);
    } catch (error) {
        console.warn(`[validateReadingUrls] Validation timed out or failed: ${error.message}`);
        // Return all readings as unvalidated if validation times out
        return readings.map((reading, index) => ({
            ...reading,
            isValidUrl: false,
            id: reading.id || `perplexity-${Date.now()}-${index}`,
        }));
    }

    // Filter to only include valid URLs
    const validReadings = validatedReadings.filter(reading => reading.isValidUrl);
    const invalidCount = validatedReadings.length - validReadings.length;

    console.log(`[validateReadingUrls] Validation complete. Valid: ${validReadings.length}, Invalid: ${invalidCount}`);

    if (invalidCount > 0) {
        console.log('[validateReadingUrls] Removed invalid URLs:',
            validatedReadings.filter(r => !r.isValidUrl).map(r => ({ url: r.url, source: r.source, reason: 'Failed validation' }))
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
 * Enhanced fake URL detection
 * @param url - The URL to check
 * @returns boolean - true if URL appears fake
 */
function isFakeUrl(url: string): boolean {
    if (!url || typeof url !== 'string') return true;

    const lowerUrl = url.toLowerCase();

    // Common fake URL patterns
    const fakePatterns = [
        'example.com',
        'placeholder',
        'dummy',
        'fake',
        'test.com',
        'sample.com',
        'demo.com',
        'temp.com',
        'mock.com',
        'localhost',
        '127.0.0.1',
        'your-domain',
        'yourdomain',
        'insert-url',
        'replace-with',
        'book-title-here',
        'video-title-here',
        'article-title-here'
    ];

    // Check for fake patterns
    if (fakePatterns.some(pattern => lowerUrl.includes(pattern))) {
        return true;
    }

    // Check for incomplete URLs
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        return true;
    }

    // Check for URLs that are clearly placeholders
    if (url.includes('[') || url.includes(']') || url.includes('{') || url.includes('}')) {
        return true;
    }

    // Check for very short or suspicious URLs
    if (url.length < 10 || url.split('/').length < 3) {
        return true;
    }

    return false;
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
            Find PRIMARY SOURCES from ${expertName} on the topic of "${topic}" using web search. I need actual writings, speeches, or publications by this historical figure.

            Search for:
            - Original letters, speeches, or writings by ${expertName}
            - Historical documents authored by ${expertName}
            - Published works from ${expertName}'s lifetime
            - Primary source materials from archives and libraries

            SEARCH LOCATIONS:
            - Project Gutenberg (gutenberg.org)
            - Internet Archive (archive.org)
            - Google Books historical section
            - University digital libraries
            - National archives and library collections
            - Historical society databases

            For each source found:
            - Verify it's an authentic primary source by ${expertName}
            - Include the year/date of original publication
            - Provide real URLs to accessible documents
            - Give context about when and why it was written

            Return as JSON array:
            [
                {
                    "title": "Original title of the work",
                    "url": "Direct link to the primary source document",
                    "source": "Primary Source",
                    "snippet": "Context about the document and its relevance to ${topic}",
                    "year": "Year written/published",
                    "author": "${expertName}"
                }
            ]

            Focus on finding authentic historical documents, not modern analysis about ${expertName}.
            `;
        } else {
            // Enhanced search-focused prompt that leverages Perplexity's search capabilities
            prompt = `
            Find the most relevant and authoritative resources on "${topic}" using web search. I need 5 high-quality sources that provide comprehensive coverage of this topic.

            PRIORITIZE RELEVANCE AND QUALITY over source type diversity. Focus on finding the best available resources, which should naturally include a mix of:
            - Academic papers or research studies
            - Authoritative books or reports
            - Educational videos or documentaries
            - Insightful blog posts or articles
            - Podcast episodes with expert discussions
            - Relevant forum discussions with substantive analysis

            SEARCH STRATEGY:
            - Use current web search to find the most authoritative and recent sources
            - Look for content from recognized experts, institutions, or thought leaders
            - Prioritize sources with deep analysis rather than surface-level coverage
            - Include both mainstream and alternative perspectives when valuable
            - Ensure sources are currently accessible with working URLs

            QUALITY REQUIREMENTS:
            - Recent content preferred (last 5 years when possible)
            - Authoritative sources from credible publishers, institutions, or experts
            - Substantive content that provides real insights, not just summaries
            - Working URLs that lead to actual content
            - Diverse perspectives and approaches to the topic

            Return 5 resources as JSON array:
            [
                {
                    "title": "Exact title from the source",
                    "url": "Real, working URL found through search",
                    "source": "Descriptive source type (e.g., Academic Paper, Book, Blog Post, YouTube Video, Podcast Episode, News Article, etc.)",
                    "snippet": "Detailed description of content, perspective, and key insights (100+ words)",
                    "published_date": "Date or year if available",
                    "author": "Author/creator if available"
                }
            ]

            Focus on finding the most valuable and relevant resources available, letting quality and relevance drive selection rather than forcing specific source types.
            `;
        }

        // System message based on expert type
        const systemMessage = expertType === 'historical'
            ? 'You are a specialized historical research assistant with access to real-time web search. Use your search capabilities to find authentic primary sources written by historical figures. Focus on locating actual writings, speeches, and publications from verified archives and libraries. Search for sources on Project Gutenberg, Archive.org, Google Books, university digital libraries, and academic databases. Always verify URLs exist and are accessible. Return responses as valid JSON with working links to real historical documents.'
            : 'You are an expert research assistant with access to real-time web search capabilities. Use your search functionality to find current, high-quality resources on any topic. Search across academic databases, news sources, educational platforms, discussion forums, and multimedia content. Prioritize recent, authoritative sources from diverse perspectives. Always verify that URLs are real and currently accessible. Focus on finding substantive content that provides deep analysis rather than surface-level coverage. Return all results as valid JSON with working links.';

        // Make the request to the Perplexity Chat API
        try {
            // Try different models in order of preference
            const modelOptions = [
                'llama-3.1-sonar-large-128k-online', // Most advanced
                'llama-3.1-sonar-small-128k-online', // Smaller but still advanced
                'llama-3-sonar-large-32k-online',    // Previous generation large
                'sonar'                              // Basic fallback
            ];

            let lastError = null;

            for (const model of modelOptions) {
                try {
                    console.log(`[getExpertRecommendedReading] Attempting with model: ${model}`);

                    const requestOptions = {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            // Ensure the correct key from process.env is used here
                            'Authorization': `Bearer ${perplexityKey}`
                        },
                        body: JSON.stringify({
                            model: model,
                            messages: [
                                {
                                    role: 'system',
                                    content: systemMessage
                                },
                                {
                                    role: 'user',
                                    content: prompt
                                }
                            ],
                            // Add search-optimized parameters (skip for basic 'sonar' model)
                            ...(model !== 'sonar' ? {
                                temperature: 0.2, // Lower temperature for more focused, factual responses
                                max_tokens: 4000, // Ensure enough tokens for comprehensive responses
                                top_p: 0.9, // Use nucleus sampling for better quality
                                return_citations: true, // Enable citation return
                                return_images: false, // Disable images to focus on text content
                                stream: false // Ensure we get complete response
                            } : {
                                temperature: 0.3,
                                max_tokens: 2000
                            })
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
                        console.error(`[getExpertRecommendedReading] Model ${model} failed: ${response.status}. Response: ${errorText}`);

                        // If this model failed due to auth, all will fail
                        if (response.status === 401 || response.status === 403) {
                            console.error(`[getExpertRecommendedReading] 🔴 AUTHENTICATION ERROR: This appears to be an API key issue. Status: ${response.status}`);
                            console.error(`[getExpertRecommendedReading] 🔑 Key details: Length=${perplexityKey.length}, Prefix=${perplexityKey.substring(0, 5)}...`);
                            throw new Error(`Perplexity API authentication failed: ${response.status}. Please check your API key.`);
                        }

                        // If rate limited, try next model
                        if (response.status === 429) {
                            console.warn(`[getExpertRecommendedReading] Model ${model} rate limited, trying next model...`);
                            lastError = new Error(`Rate limit exceeded for model ${model}`);
                            continue;
                        }

                        // If model not available, try next
                        if (response.status === 404 || response.status === 400) {
                            console.warn(`[getExpertRecommendedReading] Model ${model} not available (${response.status}), trying next model...`);
                            lastError = new Error(`Model ${model} not available: ${response.status}`);
                            continue;
                        }

                        // Other errors, try next model
                        lastError = new Error(`Model ${model} failed: ${response.status}. ${errorText.substring(0, 200)}`);
                        continue;
                    }

                    // Success! Process the response
                    console.log(`[getExpertRecommendedReading] ✅ Success with model: ${model}`);

                    const data = await response.json();

                    if (!data.choices || !data.choices.length) {
                        console.error(`Invalid response format from Perplexity API (model: ${model})`);
                        lastError = new Error(`Invalid response format from model ${model}`);
                        continue;
                    }

                    // Extract and process the content
                    const content = data.choices[0].message.content;
                    console.log(`[getExpertRecommendedReading] Raw content from API (first 200 chars): ${content.substring(0, 200)}...`);

                    try {
                        const readings = extractJsonFromMarkdown(content);
                        console.log(`[getExpertRecommendedReading] Successfully extracted ${readings.length} readings from response using model: ${model}`);

                        // Quick pre-validation to catch obviously fake URLs
                        const preValidatedReadings = readings.filter((reading: any) => {
                            if (isFakeUrl(reading.url)) {
                                console.log(`[getExpertRecommendedReading] Rejected fake URL during pre-validation: ${reading.url}`);
                                return false;
                            }
                            return true;
                        });

                        console.log(`[getExpertRecommendedReading] Pre-validation: ${preValidatedReadings.length}/${readings.length} readings passed fake URL check`);

                        // If we lost too many readings to fake URLs, return empty with clear message
                        if (preValidatedReadings.length === 0) {
                            console.warn(`[getExpertRecommendedReading] All URLs were fake for topic: "${topic}". No valid sources available.`);
                            return [];
                        }

                        // Add IDs to readings if they don't have them and ensure year is included for historical experts
                        const processedReadings = preValidatedReadings.map((reading: any, index: number) => ({
                            id: reading.id || `perplexity-${Date.now()}-${index}`,
                            url: reading.url,
                            title: reading.title,
                            snippet: reading.snippet,
                            source: reading.source || "Resource",
                            year: reading.year || reading.published_date || undefined,
                            author: reading.author || undefined,
                            isPrimarySource: expertType === 'historical' && reading.source !== 'Secondary Source'
                        }));

                        // For non-historical experts, log source diversity for monitoring
                        if (expertType !== 'historical') {
                            const sourceTypes = processedReadings.map(r => r.source);
                            console.log(`[getExpertRecommendedReading] Source types found for "${topic}": ${sourceTypes.join(', ')}`);
                        }

                        const validatedReadings = await validateReadingUrls(processedReadings);

                        // Check if we have enough valid readings
                        if (validatedReadings.length === 0) {
                            console.warn(`[getExpertRecommendedReading] No valid URLs found for topic: "${topic}". All ${processedReadings.length} URLs failed validation.`);
                            return [];
                        } else if (validatedReadings.length < processedReadings.length / 2) {
                            console.warn(`[getExpertRecommendedReading] Many invalid URLs found for topic: "${topic}". Valid: ${validatedReadings.length}/${processedReadings.length}`);
                        }

                        // Add validation notes to valid readings
                        const finalReadings = validatedReadings.map(reading => ({
                            ...reading,
                            snippet: reading.snippet + " ✅",
                            isValidUrl: true,
                            modelUsed: model // Track which model was successful
                        }));

                        console.log(`[getExpertRecommendedReading] Returning ${finalReadings.length} validated readings for topic: "${topic}" using model: ${model}`);
                        return finalReadings;
                    } catch (extractError) {
                        console.error(`[getExpertRecommendedReading] Failed to extract readings from content (model: ${model}): ${extractError}`);
                        lastError = extractError;
                        continue;
                    }

                } catch (modelError) {
                    console.error(`[getExpertRecommendedReading] Error with model ${model}:`, modelError);
                    lastError = modelError;
                    continue;
                }
            }

            // If all models failed, throw the last error
            throw lastError || new Error('All models failed to provide results');

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

