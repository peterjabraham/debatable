import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

export async function GET(request: NextRequest) {
    try {
        // Force using the real API regardless of other settings
        const openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
        });

        // Log key format for debugging
        const keyFormat = process.env.OPENAI_API_KEY ?
            process.env.OPENAI_API_KEY.substring(0, 7) + "..." :
            "NO_KEY_FOUND";

        // Get environment variables
        const environment = {
            NODE_ENV: process.env.NODE_ENV,
            NEXT_PUBLIC_USE_REAL_API: process.env.NEXT_PUBLIC_USE_REAL_API,
            USE_MOCK_DATA: process.env.USE_MOCK_DATA,
            OPENAI_MODEL: process.env.OPENAI_MODEL,
        };

        // Make a simple request to verify the API works
        const chatCompletion = await openai.chat.completions.create({
            messages: [{ role: 'user', content: 'Say "API is working correctly!"' }],
            model: process.env.OPENAI_MODEL || 'gpt-4o',
            max_tokens: 50,
        });

        const response = chatCompletion.choices[0]?.message?.content;

        return NextResponse.json({
            success: true,
            apiKeyFormat: keyFormat,
            environment,
            response,
            usage: chatCompletion.usage,
        });
    } catch (error) {
        console.error('API test failed:', error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : String(error),
                apiKeyFormat: process.env.OPENAI_API_KEY?.substring(0, 7) + "...",
                environment: {
                    NODE_ENV: process.env.NODE_ENV,
                    NEXT_PUBLIC_USE_REAL_API: process.env.NEXT_PUBLIC_USE_REAL_API,
                    USE_MOCK_DATA: process.env.USE_MOCK_DATA,
                },
            },
            { status: 500 }
        );
    }
} 