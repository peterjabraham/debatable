import { NextRequest, NextResponse } from 'next/server';
import { generateDebateResponseServer } from '@/lib/openai';
import { v4 as uuidv4 } from 'uuid';

// Function to sanitize names for OpenAI API compatibility
function sanitizeNameForOpenAI(name: string | undefined): string | undefined {
    if (!name) return undefined;

    // Replace any characters that aren't alphanumeric, underscore, or hyphen with underscore
    // This matches OpenAI's requirements: '^[a-zA-Z0-9_-]+$'
    return name.replace(/[^a-zA-Z0-9_-]/g, '_');
}

// Mock topics for demo purposes
const MOCK_TOPICS = [
    {
        id: 'climate',
        title: 'Climate Change',
        description: 'Examining the global impact of climate change and potential solutions',
        tags: ['Environment', 'Science', 'Policy']
    },
    {
        id: 'ai-ethics',
        title: 'AI Ethics and Regulation',
        description: 'Discussing the ethical implications of artificial intelligence and appropriate regulatory frameworks',
        tags: ['Technology', 'Ethics', 'Policy']
    },
    {
        id: 'healthcare',
        title: 'Universal Healthcare',
        description: 'Exploring the benefits and challenges of universal healthcare systems',
        tags: ['Health', 'Policy', 'Economics']
    }
];

// Mock experts
const MOCK_EXPERTS = [
    {
        id: 'eco1',
        name: 'Dr. Maya Chen',
        expertise: ['Environmental Science', 'Climate Policy'],
        stance: 'pro',
        voiceId: 'mock-voice-1',
        backgroundKnowledge: 'Expert in climate studies with peer-reviewed publications'
    },
    {
        id: 'eco2',
        name: 'Jonathan Miller',
        expertise: ['Economic Development', 'Resource Management'],
        stance: 'con',
        voiceId: 'mock-voice-2',
        backgroundKnowledge: 'Former industry executive focused on sustainable business practices'
    }
];

export async function GET(request: NextRequest) {
    try {
        const url = new URL(request.url);
        const path = url.pathname;

        // General debate API - return topics
        if (path === '/api/debate') {
            return NextResponse.json({
                topics: MOCK_TOPICS,
                message: 'Here are some debate topics'
            });
        }

        // Expert retrieval for topic
        if (path.includes('/experts')) {
            const topicParam = url.searchParams.get('topic');
            const typeParam = url.searchParams.get('type') || 'domain';

            return NextResponse.json({
                experts: MOCK_EXPERTS,
                message: `Experts for topic: ${topicParam || 'general'}`
            });
        }

        // Default response
        return NextResponse.json({
            message: 'Debate API endpoints available',
            endpoints: ['/api/debate', '/api/debate/experts']
        });

    } catch (error) {
        console.error('[Debate API GET] Error:', error);
        return NextResponse.json(
            { error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const requestData = await request.json();

        // Extract data from request
        const { messages, expert, topic } = requestData;

        if (!messages || !expert) {
            return NextResponse.json(
                { error: 'Missing required parameters: messages, expert' },
                { status: 400 }
            );
        }

        // Process message names to ensure OpenAI compatibility
        const sanitizedMessages = messages.map(message => {
            // Use the apiName field if available, or sanitize the name or speaker field
            const name = message.apiName ||
                sanitizeNameForOpenAI(message.name || message.speaker);

            return {
                ...message,
                name: name
            };
        });

        try {
            // Attempt to use OpenAI API to generate a response
            console.log(`Generating debate response via OpenAI for expert ${expert.name}`);

            // Make sure expert name is sanitized too
            const sanitizedExpert = {
                ...expert,
                name: sanitizeNameForOpenAI(expert.name)
            };

            const result = await generateDebateResponseServer(sanitizedMessages, sanitizedExpert);

            return NextResponse.json({
                response: result.response,
                usage: result.usage,
                expert: expert.name,
                topic,
                timestamp: new Date().toISOString(),
                apiSource: 'openai'
            });

        } catch (openaiError) {
            // If OpenAI fails, log the error and fall back to mock data
            console.error('[Debate API] OpenAI error:', openaiError);
            console.log('[Debate API] Falling back to mock response');

            // Create a mock response
            const mockResponse = {
                response: `As ${expert.name}, I would offer this perspective on ${topic || 'this topic'}: 
                This is a sample response generated because the OpenAI API was not available.
                ${expert.stance === 'pro'
                        ? 'I generally support this position based on my expertise.'
                        : 'I have some reservations about this position based on my expertise.'}
                If you're seeing this message, it means we're using mock data instead of real AI responses.`,
                usage: {
                    promptTokens: 150,
                    completionTokens: 100,
                    totalTokens: 250,
                    cost: 0.01
                },
                expert: expert.name,
                topic,
                timestamp: new Date().toISOString(),
                apiSource: 'mock',
                error: openaiError instanceof Error ? openaiError.message : 'OpenAI API error'
            };

            return NextResponse.json(mockResponse);
        }
    } catch (error) {
        console.error('[Debate API POST] Error:', error);
        return NextResponse.json(
            { error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        );
    }
} 