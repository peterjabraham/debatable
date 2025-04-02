import { NextResponse } from 'next/server';
import { generateDebateResponseServer } from '@/lib/openai';

/**
 * Debate Response API Route
 * 
 * This route is specifically for generating debate responses using OpenAI.
 * It's intentionally separated from recommended readings functionality.
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

        // Format the messages for OpenAI
        const formattedMessages = [...messages];

        // If this is the first message and we have arguments, include them
        if (messages.length === 0 && topicArguments && topicArguments.length > 0) {
            // Get an argument appropriate for this expert
            const expertArgument = topicArguments[0]; // Just use the first one for simplicity

            // Add a system message with the argument
            formattedMessages.unshift({
                role: 'system',
                content: `The debate topic is: ${topic}. Consider this key point: ${typeof expertArgument === 'string'
                        ? expertArgument
                        : (expertArgument.claim || expertArgument.text || JSON.stringify(expertArgument))
                    }`
            });
        }

        // Generate the debate response from OpenAI
        const response = await generateDebateResponseServer(
            formattedMessages,
            expert
        );

        return NextResponse.json({
            response: response.response,
            usage: response.usage,
            expert: expert.name
        });

    } catch (error) {
        console.error('[Debate Response API] Error:', error);
        return NextResponse.json(
            { error: 'Failed to generate debate response', message: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        );
    }
} 