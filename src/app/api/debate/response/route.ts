import { StreamingTextResponse } from 'ai';
import { NextResponse } from 'next/server';

// No OpenAI client needed for this test

/**
 * Debate Response API Route (Streaming - Testing without Edge Runtime)
 * 
 * This route generates debate responses using OpenAI and streams them back.
 */
export async function POST(request: Request) {
    try {
        // Create a simple ReadableStream that sends "Hello, world!"
        const stream = new ReadableStream({
            start(controller) {
                const encoder = new TextEncoder();
                controller.enqueue(encoder.encode("Hello, world!"));
                controller.close();
            },
        });

        // Return just the StreamingTextResponse
        return new StreamingTextResponse(stream);

    } catch (error) {
        console.error('[Debate Response API - Test] Error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return new NextResponse(
            JSON.stringify({ error: 'Test failed', message: errorMessage }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
    }
} 