import { NextResponse } from 'next/server';
import nodeFetch from 'node-fetch';

/**
 * Debug endpoint for Perplexity API
 * 
 * This route makes a simple direct call to the Perplexity API
 * to test if the API key is working correctly.
 */

export async function GET(request: Request) {
    console.log('🔍 Debug: Perplexity API test endpoint called');

    try {
        // Get API key
        const perplexityKey = process.env.PERPLEXITY_API_KEY;

        // Log key details (masked for security)
        if (!perplexityKey) {
            console.error('🔴 Debug: PERPLEXITY_API_KEY is not set!');
            return NextResponse.json({
                success: false,
                error: 'API key not configured',
                environment: process.env.NODE_ENV
            });
        }

        // Mask key for security in logs
        const maskedKey = `${perplexityKey.substring(0, 5)}...${perplexityKey.substring(perplexityKey.length - 4)}`;
        console.log(`🔑 Debug: Using Perplexity API key (masked): ${maskedKey}, length: ${perplexityKey.length}`);

        // Make a simple request to the API
        try {
            console.log('📤 Debug: Sending test request to Perplexity API');

            const response = await nodeFetch('https://api.perplexity.ai/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${perplexityKey}`
                },
                body: JSON.stringify({
                    model: 'llama-3-sonar-small-32k-online',
                    messages: [
                        {
                            role: 'system',
                            content: 'You are a helpful assistant.'
                        },
                        {
                            role: 'user',
                            content: 'Respond with a simple "Hello World" message formatted as JSON.'
                        }
                    ]
                })
            });

            console.log(`📥 Debug: Perplexity API response status: ${response.status}`);

            // Get response as text first for debugging
            const responseText = await response.text();
            console.log(`📄 Debug: Raw response (first 200 chars): ${responseText.substring(0, 200)}...`);

            // Try to parse as JSON
            let responseData;
            try {
                responseData = JSON.parse(responseText);
                console.log('✅ Debug: Successfully parsed JSON response');
            } catch (e) {
                console.error('🔴 Debug: Failed to parse response as JSON', e);
                responseData = { error: 'Invalid JSON response', text: responseText.substring(0, 500) };
            }

            return NextResponse.json({
                success: response.status === 200,
                status: response.status,
                response: responseData,
                apiKeyInfo: {
                    present: true,
                    length: perplexityKey.length,
                    masked: maskedKey
                }
            });

        } catch (fetchError) {
            console.error('🔴 Debug: Error making request to Perplexity API:', fetchError);
            return NextResponse.json({
                success: false,
                error: fetchError instanceof Error ? fetchError.message : 'Unknown fetch error',
                stack: fetchError instanceof Error ? fetchError.stack : undefined
            });
        }
    } catch (error) {
        console.error('🔴 Debug: Unexpected error:', error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined
        });
    }
} 