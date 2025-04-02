import { NextResponse } from 'next/server';
import { getExpertRecommendedReading } from '@/lib/api/perplexity';

/**
 * Perplexity API Route
 * 
 * This route proxies requests to the Perplexity API.
 * It now uses the Chat Completions API instead of the Search API
 * because our API key only has access to chat completions.
 */

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

        // For development/testing, allow direct response with mock data
        if (process.env.NODE_ENV === 'development' && process.env.USE_MOCK_DATA === 'true') {
            console.log('Using mock data for development');
            return NextResponse.json(
                generateMockResults(experts, topic)
            );
        }

        // Process each expert in parallel
        const results: Record<string, any[]> = {};
        const errors: Record<string, string> = {};

        await Promise.all(
            experts.map(async (expert: any) => {
                try {
                    const expertName = expert.name || expert.role;
                    const expertTopic = topic || (expert.topic || '');

                    console.log(`Processing expert: ${expertName} with topic: ${expertTopic}`);

                    // Use the getExpertRecommendedReading function which handles server-side fetching
                    const readings = await getExpertRecommendedReading(expertName, expertTopic);
                    console.log(`Retrieved ${readings.length} readings for ${expertName}`);

                    results[expertName] = readings;
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                    console.error(`Error processing expert ${expert.name || expert.role}:`, errorMessage);
                    errors[expert.name || expert.role] = errorMessage;
                    results[expert.name || expert.role] = [];
                }
            })
        );

        // Return results (even if partial)
        console.log('Completed API requests with results for', Object.keys(results).length, 'experts');
        if (Object.keys(errors).length > 0) {
            console.log('Some errors occurred:', errors);
            // Include errors in the response
            return NextResponse.json({
                results,
                errors,
                timestamp: new Date().toISOString()
            });
        }

        return NextResponse.json({
            ...results,
            timestamp: new Date().toISOString()
        });
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