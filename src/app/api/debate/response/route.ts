import { NextResponse } from 'next/server';
import { generateDebateResponseServer } from '@/lib/openai'; // Restore this import

// REMOVE Edge runtime - let it be default serverless
// export const runtime = 'edge';

/**
 * Debate Response API Route (Original - Non-Streaming)
 * 
 * This route is specifically for generating debate responses using OpenAI.
 */
export async function POST(request: Request) {
    try {
        const { expert, messages, topic, topicArguments } = await request.json();

        if (!expert || !messages) {
            return NextResponse.json(
                { error: 'Missing required fields: expert and messages' },
                { status: 400 }
            );
        }

        // Prepare messages (add system message with arguments if needed)
        const formattedMessages = [...messages];
        if (messages.length === 0 && topicArguments && topicArguments.length > 0) {
            const expertArgument = topicArguments[0]; // Simple example
            formattedMessages.unshift({
                role: 'system',
                content: `The debate topic is: ${topic || 'the discussion'}. Consider this key point: ${typeof expertArgument === 'string' ? expertArgument : (expertArgument.claim || expertArgument.text || JSON.stringify(expertArgument))}`
            });
        }

        // Generate the debate response using the imported function
        const response = await generateDebateResponseServer(
            formattedMessages,
            expert
        );

        // Return the full response as JSON
        return NextResponse.json({
            response: response.response,
            usage: response.usage,
            expert: expert.name // Send expert name back for context if needed
        });

    } catch (error) {
        console.error('[Debate Response API - Original] Error:', error);
        return NextResponse.json(
            { error: 'Failed to generate debate response', message: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        );
    }
} 