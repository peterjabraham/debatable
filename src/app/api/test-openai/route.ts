import { NextRequest, NextResponse } from 'next/server';
import openai, { getModel } from '@/lib/ai/openai-client';

export async function GET(request: NextRequest) {
    try {
        // Get the OpenAI API key from environment
        const apiKey = process.env.OPENAI_API_KEY;
        const model = getModel();

        // Log information for debugging
        console.log(`Testing OpenAI with model: ${model}`);
        console.log(`API Key format: ${apiKey?.substring(0, 7)}...`);

        // Attempt to call OpenAI API directly
        const response = await openai.chat.completions.create({
            model: model,
            messages: [
                { role: 'system', content: 'You are a helpful assistant.' },
                { role: 'user', content: 'Generate a short response about AI debates.' }
            ],
            temperature: 0.7,
            max_tokens: 100
        });

        // Return success response with OpenAI data
        return NextResponse.json({
            success: true,
            message: 'OpenAI API test successful',
            response: response.choices[0]?.message?.content || 'No content received',
            model: model,
            usage: response.usage,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error testing OpenAI API:', error);

        // Return error response with details
        return NextResponse.json({
            success: false,
            message: 'OpenAI API test failed',
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date().toISOString()
        }, { status: 500 });
    }
} 