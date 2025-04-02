import { NextResponse } from 'next/server';

const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;
const PERPLEXITY_API_BASE_URL = 'https://api.perplexity.ai';

export async function POST(request: Request) {
    try {
        console.log('Perplexity API route called');

        // Check if API key is available
        if (!PERPLEXITY_API_KEY) {
            console.error('Perplexity API key is not configured');
            return NextResponse.json(
                { error: 'Perplexity API is not configured' },
                { status: 500 }
            );
        }

        const { experts, topic } = await request.json();
        console.log('Request params:', { experts, topic });

        if (!Array.isArray(experts) || !topic) {
            console.log('Invalid request parameters:', { experts, topic });
            return NextResponse.json(
                { error: 'Invalid request parameters' },
                { status: 400 }
            );
        }

        const results: Record<string, any[]> = {};

        // Fetch results for each expert in parallel
        await Promise.all(
            experts.map(async (expert) => {
                const query = `${expert} ${topic} research papers academic articles`;
                console.log('Making Perplexity API request for expert:', expert, 'with query:', query);

                try {
                    const response = await fetch(`${PERPLEXITY_API_BASE_URL}/search`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${PERPLEXITY_API_KEY}`
                        },
                        body: JSON.stringify({
                            query,
                            max_results: 5,
                            search_depth: 'advanced'
                        })
                    });

                    if (!response.ok) {
                        console.error('Perplexity API error:', {
                            status: response.status,
                            statusText: response.statusText,
                            expert,
                            query
                        });
                        throw new Error(`Perplexity API error: ${response.status} ${response.statusText}`);
                    }

                    const data = await response.json();
                    console.log('Perplexity API response for expert:', expert, 'data:', data);
                    results[expert] = data.results;
                } catch (error) {
                    console.error(`Error fetching results for expert ${expert}:`, error);
                    // Return empty array for this expert if there's an error
                    results[expert] = [];
                }
            })
        );

        console.log('Final results:', results);
        return NextResponse.json(results);
    } catch (error) {
        console.error('Error in Perplexity API route:', error);
        return NextResponse.json(
            { error: 'Failed to fetch recommended readings' },
            { status: 500 }
        );
    }
} 