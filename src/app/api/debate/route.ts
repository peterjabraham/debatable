import { NextRequest, NextResponse } from 'next/server';
import { generateDebateResponseServer } from '@/lib/openai';
import type { ExpertProfile } from '@/lib/openai';

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

export async function GET() {
    return NextResponse.json({
        status: 'ok',
        message: 'Debate API is running'
    });
}

export async function POST(request: Request) {
    try {
        const { topic, expert } = await request.json();

        if (!topic || !expert) {
            return NextResponse.json(
                { error: 'Missing required fields: topic and expert' },
                { status: 400 }
            );
        }

        // Generate debate response using OpenAI
        const response = await generateDebateResponseServer(
            [
                { role: 'system', content: 'You are a helpful assistant' },
                { role: 'user', content: `As ${expert.name}, what are your thoughts on ${topic}?` }
            ],
            expert as ExpertProfile
        );

        return NextResponse.json({
            ...response,
            apiSource: 'openai'
        });

    } catch (error) {
        console.error('[Debate API] Error:', error);
        return NextResponse.json(
            { error: 'Failed to generate debate response' },
            { status: 500 }
        );
    }
} 