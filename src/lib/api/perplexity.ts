/**
 * Perplexity API Client
 * 
 * This module provides functions to interact with the Perplexity API
 * for fetching relevant links and information based on expert names and topics.
 */

import { makeRequest } from './requestManager';

// Define the Perplexity API key environment variable
const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;

// Define the Perplexity API base URL
const PERPLEXITY_API_BASE_URL = 'https://api.perplexity.ai';

// Interface for Perplexity API response
interface PerplexitySearchResult {
    id: string;
    url: string;
    title: string;
    snippet: string;
    published_date?: string;
    author?: string;
    source?: string;
}

interface PerplexityApiResponse {
    query: string;
    results: PerplexitySearchResult[];
    search_id: string;
}

/**
 * Fetches recommended reading links from Perplexity API based on expert name and topic
 * 
 * @param expertName - The name of the expert
 * @param topic - The debate topic
 * @returns Promise with an array of search results
 */
export async function getExpertRecommendedReading(
    expertName: string,
    topic: string
): Promise<PerplexitySearchResult[]> {
    try {
        // Create a search query that combines the expert name and topic
        const query = `${expertName} ${topic} research papers academic articles`;

        // Make the request to the Perplexity API
        const response = await fetch(`${PERPLEXITY_API_BASE_URL}/search`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${PERPLEXITY_API_KEY}`
            },
            body: JSON.stringify({
                query,
                max_results: 5, // Limit to 5 results per expert
                search_depth: 'advanced' // Use advanced search for better results
            })
        });

        if (!response.ok) {
            throw new Error(`Perplexity API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json() as PerplexityApiResponse;

        // Return the results
        return data.results;
    } catch (error) {
        console.error('Error fetching expert recommended reading:', error);
        // Return an empty array in case of error
        return [];
    }
}

/**
 * Fetches recommended reading links for multiple experts on a topic
 * 
 * @param experts - Array of expert names
 * @param topic - The debate topic
 * @returns Promise with a map of expert names to their recommended reading links
 */
export async function getMultiExpertRecommendedReading(
    experts: string[],
    topic: string
): Promise<Record<string, PerplexitySearchResult[]>> {
    console.log('getMultiExpertRecommendedReading called with:', { experts, topic });
    console.log('NEXT_PUBLIC_USE_REAL_API:', process.env.NEXT_PUBLIC_USE_REAL_API);

    try {
        console.log('Making request to /api/perplexity');
        const response = await fetch('/api/perplexity', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ experts, topic }),
        });

        if (!response.ok) {
            console.error('API error:', {
                status: response.status,
                statusText: response.statusText,
                experts,
                topic
            });
            throw new Error(`API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        console.log('API response:', data);
        return data;
    } catch (error) {
        console.error('Error fetching multi-expert recommended reading:', error);
        throw error; // Let the component handle the error
    }
}

/**
 * Mocks the Perplexity API response for testing or when the API is unavailable
 * 
 * @param expertName - The name of the expert
 * @param topic - The debate topic
 * @returns Mock search results
 */
export function getMockExpertRecommendedReading(
    expertName: string,
    topic: string
): PerplexitySearchResult[] {
    // Generate a deterministic but unique ID based on expert and topic
    const generateId = (text: string) => {
        return Array.from(text)
            .reduce((acc, char) => acc + char.charCodeAt(0), 0)
            .toString(16);
    };

    // Create mock results
    return [
        {
            id: `${generateId(expertName + topic + '1')}`,
            url: `https://example.com/papers/${expertName.toLowerCase().replace(/\s+/g, '-')}-1`,
            title: `${expertName}'s Research on ${topic} - Key Findings`,
            snippet: `Comprehensive analysis by ${expertName} exploring the implications of ${topic} with groundbreaking insights and methodologies.`
        },
        {
            id: `${generateId(expertName + topic + '2')}`,
            url: `https://example.com/papers/${expertName.toLowerCase().replace(/\s+/g, '-')}-2`,
            title: `The Future of ${topic}: ${expertName}'s Perspective`,
            snippet: `In this seminal paper, ${expertName} discusses future trends and developments in ${topic}, offering a unique perspective based on years of research.`,
            published_date: '2023-05-15'
        },
        {
            id: `${generateId(expertName + topic + '3')}`,
            url: `https://example.com/papers/${expertName.toLowerCase().replace(/\s+/g, '-')}-3`,
            title: `Critical Analysis of ${topic} Developments`,
            snippet: `${expertName} provides a critical analysis of recent developments in ${topic}, challenging conventional wisdom and proposing alternative frameworks.`,
            published_date: '2022-11-03',
            author: expertName
        }
    ];
} 