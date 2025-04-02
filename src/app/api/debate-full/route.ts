import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { selectExperts } from '../../../lib/ai/expert-selector';
import { DebateStorage } from '../../../lib/storage/debate-storage';
import { Expert } from '../../../types/expert';
import { Message } from '../../../types/message';

export async function GET(request: NextRequest) {
    return NextResponse.json({
        status: 'success',
        message: 'Debate-Full API is working',
        timestamp: new Date().toISOString()
    });
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { expert, topic, messages } = body;

        if (!expert || !topic || !messages) {
            return NextResponse.json(
                { error: 'Missing required fields: expert, topic, messages' },
                { status: 400 }
            );
        }

        // Instead of using generateResponse, return a mock response
        const mockResponse = {
            response: `This is a mock response for the debate on "${topic}" from ${expert.name}. The actual response would be generated in a deployed environment.`,
            usage: {
                promptTokens: 100,
                completionTokens: 50,
                totalTokens: 150,
                cost: 0.002
            }
        };

        return NextResponse.json(mockResponse);
    } catch (error) {
        console.error('Error in debate-full API:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
} 