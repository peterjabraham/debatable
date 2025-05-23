import { NextRequest, NextResponse } from 'next/server';
import { selectExperts } from '../../../lib/ai/expert-selector';
import { Expert } from '@/types/expert';

// Helper to ensure AI experts have proper naming
function ensureProperAINames(experts: Expert[], expertType: 'historical' | 'ai'): Expert[] {
    if (expertType !== 'ai') return experts;

    return experts.map(expert => {
        // Check if the name already follows AI format
        if (expert.name.startsWith('AI ')) {
            return expert;
        }

        // Extract expertise to create a better AI name
        const expertiseArea = expert.expertise && expert.expertise.length > 0
            ? expert.expertise[0].replace(/^in\s+/i, '') // Remove "in " prefix if present
            : "Subject";

        // Create a properly formatted AI expert name
        return {
            ...expert,
            name: `AI ${expertiseArea} Expert`,
        };
    });
}

export async function GET() {
    console.log('GET /api/debate-experts called');
    return NextResponse.json({
        status: 'success',
        message: 'Debate Experts API GET is working',
        timestamp: new Date().toISOString()
    });
}

export async function POST(request: NextRequest) {
    console.log('POST /api/debate-experts called');
    try {
        const body = await request.json();
        console.log('Debate Experts API POST body:', body);

        // Handle test action
        if (body.action === 'test') {
            return NextResponse.json({
                status: 'success',
                message: 'Debate Experts API test endpoint is working',
                timestamp: new Date().toISOString()
            });
        }

        // Handle select-experts action
        if (body.action === 'select-experts') {
            if (!body.topic) {
                return NextResponse.json(
                    { error: 'Missing topic parameter' },
                    { status: 400 }
                );
            }

            try {
                // Use expert type from request or default to historical
                const expertType = body.expertType === 'ai' ? 'ai' : 'historical';
                console.log(`Selecting ${expertType} experts for topic: ${body.topic}`);

                // Extract and log topicArguments if they exist
                let topicArguments = body.topicArguments || [];
                if (topicArguments.length > 0) {
                    console.log(`Topic includes ${topicArguments.length} arguments for context`);
                }

                // Pass the topic arguments to the expert selector for better context
                let experts = await selectExperts(
                    body.topic,
                    expertType,
                    body.count || 2,
                    topicArguments
                );

                // Ensure AI experts have proper naming format
                if (expertType === 'ai') {
                    experts = ensureProperAINames(experts, expertType);
                    console.log('Processed AI expert names:', experts.map(e => e.name));
                }

                return NextResponse.json({
                    status: 'success',
                    experts,
                    expertType
                });
            } catch (error) {
                console.error('Error selecting experts:', error);
                return NextResponse.json(
                    {
                        status: 'error',
                        error: error instanceof Error ? error.message : 'Failed to select experts'
                    },
                    { status: 500 }
                );
            }
        }

        // Handle suggest-historical-figures action
        if (body.action === 'suggest-historical-figures') {
            if (!body.topic) {
                return NextResponse.json(
                    { error: 'Missing topic parameter' },
                    { status: 400 }
                );
            }

            try {
                console.log(`Suggesting historical figures for topic: ${body.topic}`);

                // Extract topicArguments if they exist
                let topicArguments = body.topicArguments || [];
                if (topicArguments.length > 0) {
                    console.log(`Topic includes ${topicArguments.length} arguments for context`);
                }

                // Get more historical figures than the normal expert selection for user choice
                const historicalFigures = await selectExperts(
                    body.topic,
                    'historical',
                    body.count || 6, // Request more options
                    topicArguments,
                    { provideSuggestions: true } // Flag to indicate this is for user selection
                );

                // Enhance the figures with additional selection-relevant data
                const enhancedFigures = historicalFigures.map((figure, index) => ({
                    ...figure,
                    // Ensure each figure has necessary selection metadata
                    relevanceReason: figure.perspective || `Relevant to ${body.topic} based on their historical expertise`,
                    timeperiod: figure.title || 'Historical period not specified',
                    notableWorks: figure.expertise || [],
                    stance: figure.stance || (index % 2 === 0 ? 'pro' : 'con') // Alternate stances for balance
                }));

                return NextResponse.json({
                    status: 'success',
                    historicalFigures: enhancedFigures,
                    topic: body.topic,
                    count: enhancedFigures.length
                });
            } catch (error) {
                console.error('Error suggesting historical figures:', error);
                return NextResponse.json(
                    {
                        status: 'error',
                        error: error instanceof Error ? error.message : 'Failed to suggest historical figures'
                    },
                    { status: 500 }
                );
            }
        }

        // Default response for other actions
        return NextResponse.json({
            status: 'error',
            message: 'Unknown action',
            receivedAction: body.action,
            timestamp: new Date().toISOString()
        }, { status: 400 });
    } catch (error) {
        console.error('Error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
} 