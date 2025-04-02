/**
 * Perplexity API Client
 * 
 * This module provides functions to interact with the Perplexity API
 * for fetching relevant links and information based on expert names and topics.
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

/**
 * Server-side fetch implementation for Perplexity API
 * This function handles the API call on the server
 */
async function serverFetchFromPerplexity(url: string, options: any) {
    try {
        console.log('Server fetch:', url);
        const response = await nodeFetch(url, options);
        return response;
    } catch (error) {
        console.error('Server fetch error:', error);
        throw error;
    }
}

/**
 * Fetches recommended reading links using the Chat Completions API
 * 
 * @param expertName - The name or role of the expert
 * @param topic - The debate topic
 * @returns Promise with an array of search results
 */
export async function getExpertRecommendedReading(
    expertName: string,
    topic: string
): Promise<PerplexitySearchResult[]> {
    try {
        // Check for mock data flag
        if (process.env.USE_MOCK_DATA === 'true') {
            console.log('Using mock data for recommended readings');
            return generateMockReadings(expertName, topic);
        }

        // Handle client-side vs server-side
        const isClient = typeof window !== 'undefined';

        if (isClient) {
            // In the browser, use the API route to avoid CORS issues
            console.log('Running in client environment, using API route');
            try {
                const response = await fetch('/api/perplexity/single-expert', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        expertName,
                        topic
                    })
                });

                if (!response.ok) {
                    throw new Error(`API route error: ${response.status}`);
                }

                const data = await response.json();
                return data.readings || [];
            } catch (clientError) {
                console.error('Error fetching through API route:', clientError);
                return generateMockReadings(expertName, topic);
            }
        }

        // Server-side code - direct API access
        console.log('Running in server environment, using direct API access');

        // Create a prompt for the Chat API
        const prompt = `
        As a ${expertName}, please provide 3 recommended academic readings related to "${topic}".
        Format each recommendation with a title, URL, and short description (snippet).
        
        Return the results in the following JSON format:
        [
            {
                "title": "Title of Paper 1",
                "url": "https://example.com/paper1",
                "snippet": "Brief description of the paper and why it's relevant"
            },
            {
                "title": "Title of Paper 2",
                "url": "https://example.com/paper2",
                "snippet": "Brief description of the paper and why it's relevant"
            },
            {
                "title": "Title of Paper 3",
                "url": "https://example.com/paper3",
                "snippet": "Brief description of the paper and why it's relevant"
            }
        ]
        `;

        // Make the request to the Perplexity Chat API
        try {
            const requestOptions = {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${PERPLEXITY_API_KEY}`
                },
                body: JSON.stringify({
                    model: 'sonar',
                    messages: [
                        {
                            role: 'system',
                            content: 'You are a helpful assistant specialized in providing academic reading recommendations. Always format your response as valid JSON.'
                        },
                        {
                            role: 'user',
                            content: prompt
                        }
                    ]
                })
            };

            // Use the server-specific implementation for Node.js
            const response = await serverFetchFromPerplexity(
                `${PERPLEXITY_API_BASE_URL}/chat/completions`,
                requestOptions
            );

            if (!response.ok) {
                console.error(`Perplexity API error: ${response.status} ${response.statusText}`);
                return generateMockReadings(expertName, topic);
            }

            const data = await response.json();

            if (!data.choices || !data.choices.length) {
                console.error('Invalid response format from Perplexity API');
                return generateMockReadings(expertName, topic);
            }

            // Extract and process the content
            const content = data.choices[0].message.content;
            const readings = extractJsonFromMarkdown(content);

            // Add IDs to readings if they don't have them
            return readings.map((reading: any, index: number) => ({
                id: reading.id || `perplexity-${Date.now()}-${index}`,
                url: reading.url,
                title: reading.title,
                snippet: reading.snippet
            }));
        } catch (fetchError) {
            console.error('Network error fetching from Perplexity API:', fetchError);
            console.log('Falling back to mock data due to network error');
            return generateMockReadings(expertName, topic);
        }
    } catch (error) {
        console.error('Error in getExpertRecommendedReading:', error);
        return generateMockReadings(expertName, topic);
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

        // Check for mock data flag
        if (process.env.USE_MOCK_DATA === 'true') {
            console.log('Using mock data for multi-expert recommended readings');
            return generateMockMultiExpertReadings(experts);
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
                return generateMockMultiExpertReadings(experts);
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
                        readings: generateMockReadings(expertName, topic),
                        error: error.message
                    };
                });
        });

        // Wait for all requests to complete
        return await Promise.all(promises);
    } catch (error) {
        console.error('Error in getMultiExpertRecommendedReading:', error);

        // Generate mock data for all experts as fallback
        return Array.isArray(experts) ? experts.map(expert => {
            const expertName = 'role' in expert ? expert.role : expert.name;
            const topic = 'role' in expert ? expert.topic :
                Array.isArray(expert.expertise) ? expert.expertise[0] :
                    (expert.expertise as string || 'general topics');

            return {
                expert: expertName,
                readings: generateMockReadings(expertName, topic),
                error: 'Failed to fetch real data'
            };
        }) : [];
    }
}

/**
 * Generates mock readings for development/testing when API is unavailable
 */
function generateMockReadings(expertName: string, topic: string): PerplexitySearchResult[] {
    console.log(`Generating mock readings for ${expertName} on topic: ${topic}`);

    return [
        {
            id: `mock-${Date.now()}-1`,
            url: 'https://example.com/paper1',
            title: `${expertName}'s Research on ${topic}`,
            snippet: `This is a mock research paper about ${expertName}'s area of expertise related to ${topic}. It contains valuable insights and data.`
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
}

/**
 * Generates mock readings for multiple experts when API is unavailable
 */
function generateMockMultiExpertReadings(experts: any[]): any[] {
    return experts.map(expert => {
        const expertName = 'role' in expert ? expert.role : expert.name;
        const topic = 'role' in expert ? expert.topic :
            Array.isArray(expert.expertise) ? expert.expertise[0] :
                (expert.expertise as string || 'general topics');

        return {
            expert: expertName,
            readings: generateMockReadings(expertName, topic)
        };
    });
} 