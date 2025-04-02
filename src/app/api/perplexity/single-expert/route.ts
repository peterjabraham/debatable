import { NextResponse } from 'next/server';
import { getExpertRecommendedReading } from '@/lib/api/perplexity';

/**
 * Perplexity API Route for Single Expert
 * 
 * This route handles fetching recommended readings for a single expert
 * and is used by client-side code to avoid CORS issues.
 */

export async function POST(request: Request) {
    try {
        // Parse request body
        const { expertName, topic } = await request.json();
        console.log(`Perplexity Single Expert API: Processing request for ${expertName} on topic: ${topic}`);

        if (!expertName || !topic) {
            const error = 'Missing required parameters: expertName and topic';
            console.error(error);
            return NextResponse.json({ error }, { status: 400 });
        }

        // For development/testing, allow mock data
        if (process.env.NODE_ENV === 'development' && process.env.USE_MOCK_DATA === 'true') {
            console.log('Using mock data for development');

            // Generate mock readings with consistent formatting
            const mockReadings = [
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

            return NextResponse.json({ readings: mockReadings });
        }

        try {
            // Call the getExpertRecommendedReading function which now handles server-side fetching
            console.log(`Fetching recommended readings for ${expertName} on topic: ${topic}`);
            const readings = await getExpertRecommendedReading(expertName, topic);
            console.log(`Retrieved ${readings.length} readings for ${expertName}`);

            return NextResponse.json({
                readings,
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('Error fetching recommended readings:', error);
            return NextResponse.json(
                { error: 'Failed to fetch recommended readings', message: error instanceof Error ? error.message : 'Unknown error' },
                { status: 500 }
            );
        }
    } catch (error) {
        console.error('Error in Perplexity single expert API route:', error);
        return NextResponse.json(
            { error: 'Server error', message: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        );
    }
} 