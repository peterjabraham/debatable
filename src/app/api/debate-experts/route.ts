import { NextRequest, NextResponse } from 'next/server';
import { selectExperts } from '../../../lib/ai/expert-selector';

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
                const experts = await selectExperts(body.topic);
                return NextResponse.json({
                    status: 'success',
                    experts
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