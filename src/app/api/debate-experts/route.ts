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

// Add a migration helper at the top of the file
function migrateExpertType(type: string): 'historical' | 'ai' {
    return type === 'domain' ? 'ai' : (type as 'historical' | 'ai');
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
                const expertType = migrateExpertType(body.expertType);
                console.log(`Selecting ${expertType} experts for topic: ${body.topic}`);

                const experts = await selectExperts(body.topic, expertType);

                // Ensure experts are updated for client with proper types
                if (expertType === 'ai') {
                    experts.forEach(expert => {
                        // Make sure all experts of this type have proper naming convention
                        if (!expert.name.startsWith('AI ')) {
                            const expertiseArea = expert.expertise && expert.expertise.length > 0
                                ? expert.expertise[0]
                                : "Subject";
                            expert.name = `AI ${expertiseArea} Expert`;
                        }

                        // Ensure they have an identifier
                        if (!expert.identifier) {
                            expert.identifier = `AI-${Math.floor(1000 + Math.random() * 9000)}`;
                        }
                    });
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