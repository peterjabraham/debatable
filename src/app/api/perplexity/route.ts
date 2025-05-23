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