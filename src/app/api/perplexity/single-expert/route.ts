import { NextResponse } from 'next/server';
import { getExpertRecommendedReading } from '@/lib/api/perplexity';

/**
 * Perplexity API Route for Topic Recommendations
 * 
 * This route handles fetching recommended readings for a specific topic.
 * It accepts an expertName parameter for caching, and an expertType parameter
 * to differentiate between historical figures and AI experts.
 */

export async function POST(request: Request) {
    try {
        // Parse request body
        const { expertName, topic, expertType } = await request.json();
        console.log(`Perplexity Topic API: Processing request for topic: "${topic}" (expert: ${expertName}, type: ${expertType || 'not specified'})`);

        if (!topic) {
            const error = 'Missing required parameter: topic';
            console.error(error);
            return NextResponse.json({ error }, { status: 400 });
        }

        try {
            // Call the getExpertRecommendedReading function which handles server-side fetching
            // The function now focuses on topic and can provide specialized results for historical experts
            console.log(`Fetching recommended readings for topic: "${topic}" with expert type: ${expertType || 'not specified'}`);

            // Check if API key is configured
            if (!process.env.PERPLEXITY_API_KEY) {
                console.error("PERPLEXITY_API_KEY environment variable is not set");
                return NextResponse.json(
                    { error: 'Perplexity API configuration missing', readings: [] },
                    { status: 200 } // Return 200 but with empty readings to avoid breaking the UI
                );
            }

            console.log(`PERPLEXITY_API_KEY is ${process.env.PERPLEXITY_API_KEY ? 'set (length: ' + process.env.PERPLEXITY_API_KEY.length + ')' : 'not set'}`);

            try {
                // Pass the expertType to get specialized historical content if applicable
                const readings = await getExpertRecommendedReading(
                    expertName || 'Topic Expert',
                    topic,
                    expertType as 'historical' | 'ai' | undefined
                );

                console.log(`Retrieved ${readings.length} readings for topic: "${topic}" (expert type: ${expertType || 'not specified'})`);

                // Log the readings we got
                if (readings.length > 0) {
                    console.log(`Readings:`, readings.map(r => ({
                        title: r.title,
                        source: r.source,
                        isPrimary: r.isPrimarySource ? 'YES' : 'No',
                        year: r.year || 'N/A'
                    })));
                } else {
                    console.warn(`No readings returned from Perplexity API for topic: "${topic}"`);
                    // Include diagnostic info about the request
                    console.log(`Diagnostic info for empty readings - API key validity: ${process.env.PERPLEXITY_API_KEY ? 'Key present' : 'Missing'}, key length: ${process.env.PERPLEXITY_API_KEY?.length || 0}`);
                }

                return NextResponse.json({
                    readings,
                    timestamp: new Date().toISOString()
                });

            } catch (error) {
                console.error('Error fetching recommended readings:', error);

                // Extract more detailed error information
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                const errorStack = error instanceof Error ? error.stack : '';

                console.error(`Detailed error: ${errorMessage}`);
                console.error(`Stack trace: ${errorStack}`);

                // Add diagnostic information
                console.error(`API key info: Key ${process.env.PERPLEXITY_API_KEY ? 'exists' : 'missing'}, Length: ${process.env.PERPLEXITY_API_KEY?.length || 0}`);

                if (errorMessage.includes('authentication failed') || errorMessage.includes('API key')) {
                    console.error('Authentication error detected - please check your Perplexity API key');
                    return NextResponse.json(
                        { error: 'Authentication error with Perplexity API', message: errorMessage, readings: [] },
                        { status: 200 } // Return 200 with empty readings to avoid breaking the UI
                    );
                }

                if (errorMessage.includes('rate limit')) {
                    console.error('Rate limit error detected - Perplexity API rate limit reached');
                    return NextResponse.json(
                        { error: 'Rate limit exceeded with Perplexity API', message: errorMessage, readings: [] },
                        { status: 200 } // Return 200 with empty readings to avoid breaking the UI
                    );
                }

                // Default error response
                return NextResponse.json(
                    { error: 'Failed to fetch recommended readings', message: errorMessage, readings: [] },
                    { status: 200 } // Return 200 with empty readings to avoid breaking the UI
                );
            }
        } catch (error) {
            console.error('Error in Perplexity topic API route:', error);
            return NextResponse.json(
                { error: 'Server error', message: error instanceof Error ? error.message : 'Unknown error', readings: [] },
                { status: 200 } // Return 200 with empty readings to avoid breaking the UI
            );
        }
    } catch (error) {
        console.error('Error in Perplexity topic API route:', error);
        return NextResponse.json(
            { error: 'Server error', message: error instanceof Error ? error.message : 'Unknown error', readings: [] },
            { status: 200 } // Return 200 with empty readings to avoid breaking the UI
        );
    }
} 