import { NextRequest, NextResponse } from 'next/server';
import { Message } from '@/types/message';
import { Expert } from '@/types/expert';
import { v4 as uuidv4 } from 'uuid';
import { DebateStorage } from '@/lib/storage/debate-storage';
import { selectExperts } from '@/lib/ai/expert-selector';

// Handle all debate-related API requests
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
        console.error('Error in debate-broken API:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

// Handle GET requests
export async function GET(request: NextRequest) {
    return NextResponse.json({
        status: 'success',
        message: 'Debate Broken API is working',
        timestamp: new Date().toISOString()
    });
}

// Helper functions for POST actions
async function handleSelectExperts(req: any) {
    const { topic, expertType = 'historical', count = 2 } = req;

    if (!topic) {
        return NextResponse.json({ error: 'Topic is required' }, { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    try {
        const experts = await selectExperts(topic, expertType, count);
        return NextResponse.json({ experts }, { status: 200, headers: { 'Content-Type': 'application/json' } });
    } catch (error: any) {
        console.error('Error selecting experts:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to select experts' },
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
    }
}

async function handleInitializeDebate(body: any) {
    const { topic, expertType, userId } = body;

    if (!topic || !expertType || !userId) {
        return NextResponse.json(
            { error: 'Missing required fields: topic, expertType, userId' },
            { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
    }

    try {
        const debateId = uuidv4();
        const experts = await selectExperts(topic, expertType, 2);

        const debateStorage = await DebateStorage.getInstance();
        await debateStorage.initializeDebate(debateId, topic, experts, userId);

        return NextResponse.json({ debateId, topic, experts }, { status: 200, headers: { 'Content-Type': 'application/json' } });
    } catch (error: any) {
        console.error('Error initializing debate:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to initialize debate' },
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
    }
} 