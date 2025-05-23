import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import nodeFetch from 'node-fetch';

/**
 * This route verifies if the Perplexity API key is valid
 * and checks if it's correctly set in the .env.local file
 */

export async function GET(request: Request) {
    try {
        // Check if we have a key in the environment
        const perplexityKey = process.env.PERPLEXITY_API_KEY;
        console.log('🔍 Verifying Perplexity API key in environment');

        const results: Record<string, any> = {
            environment: process.env.NODE_ENV,
            keyInEnvironment: !!perplexityKey,
            keyLength: perplexityKey ? perplexityKey.length : 0,
            validFormat: false,
            canReadEnvFile: false,
            keyInEnvFile: false,
            apiTest: null,
            recommendations: []
        };

        // Check if the key format is valid
        if (perplexityKey) {
            const validKeyPattern = /^pplx-[A-Za-z0-9]{24,}$/;
            results.validFormat = validKeyPattern.test(perplexityKey);

            // Mask key for security
            const maskedKey = `${perplexityKey.substring(0, 5)}...${perplexityKey.substring(perplexityKey.length - 4)}`;
            results.maskedKey = maskedKey;
        }

        // Try to read the .env.local file
        try {
            const envFilePath = path.join(process.cwd(), '.env.local');
            console.log(`🔍 Checking for .env.local file at ${envFilePath}`);

            if (fs.existsSync(envFilePath)) {
                results.canReadEnvFile = true;
                const envFileContent = fs.readFileSync(envFilePath, 'utf8');

                // Search for the Perplexity API key line
                const keyLineRegex = /PERPLEXITY_API_KEY=([^\n]+)/;
                const match = envFileContent.match(keyLineRegex);

                if (match && match[1]) {
                    results.keyInEnvFile = true;

                    // Check if the key in file matches the key in environment
                    const keyInFile = match[1].trim();
                    results.keyInFileMatchesEnvironment = keyInFile === perplexityKey;

                    // Only show the first few characters of the key from the file for security
                    if (keyInFile.length > 8) {
                        results.keyInFileFirstChars = keyInFile.substring(0, 5) + '...';
                        results.keyInFileLength = keyInFile.length;
                    }
                } else {
                    console.warn('⚠️ PERPLEXITY_API_KEY line not found in .env.local file');
                }
            } else {
                console.warn('⚠️ .env.local file not found');
            }
        } catch (fileError) {
            console.error('🔴 Error reading .env.local file:', fileError);
        }

        // Test the API key with a simple request if we have one
        if (perplexityKey) {
            try {
                console.log('🔍 Testing Perplexity API key with a simple request');

                const response = await nodeFetch('https://api.perplexity.ai/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${perplexityKey}`
                    },
                    body: JSON.stringify({
                        model: 'llama-3-sonar-small-32k-online',
                        messages: [
                            { role: 'user', content: 'Say "test successful" in JSON format' }
                        ]
                    })
                });

                results.apiTest = {
                    status: response.status,
                    statusText: response.statusText,
                    ok: response.ok
                };

                if (response.ok) {
                    try {
                        // Get the response as text first
                        const responseText = await response.text();

                        // Try to parse as JSON
                        try {
                            const data = JSON.parse(responseText);
                            results.apiTest.response = {
                                received: true,
                                parsed: true,
                                contentSample: data.choices?.[0]?.message?.content?.substring(0, 50) + '...' || 'No content'
                            };
                        } catch (jsonError) {
                            results.apiTest.response = {
                                received: true,
                                parsed: false,
                                textSample: responseText.substring(0, 50) + '...'
                            };
                        }
                    } catch (textError) {
                        results.apiTest.response = {
                            received: false,
                            error: 'Could not read response text'
                        };
                    }
                } else {
                    try {
                        const errorText = await response.text();
                        results.apiTest.error = errorText.substring(0, 100) + '...';
                    } catch (textError) {
                        results.apiTest.error = 'Could not read error response';
                    }
                }
            } catch (apiError) {
                results.apiTest = {
                    error: apiError instanceof Error ? apiError.message : 'Unknown API error',
                    stack: apiError instanceof Error ? apiError.stack : undefined
                };
            }
        }

        // Generate recommendations based on issues found
        if (!results.keyInEnvironment) {
            results.recommendations.push(
                'PERPLEXITY_API_KEY is not set in the environment. Make sure it\'s in your .env.local file and the server has been restarted.'
            );
        } else if (!results.validFormat) {
            results.recommendations.push(
                'The API key format appears to be invalid. It should start with "pplx-" followed by a long string of characters.'
            );
        }

        if (results.canReadEnvFile && !results.keyInEnvFile) {
            results.recommendations.push(
                'PERPLEXITY_API_KEY is not found in your .env.local file. Add it with the format: PERPLEXITY_API_KEY=your_key_here'
            );
        }

        if (results.keyInEnvironment && results.keyInEnvFile && !results.keyInFileMatchesEnvironment) {
            results.recommendations.push(
                'The API key in .env.local doesn\'t match the one loaded in the environment. Restart the dev server to load the latest changes.'
            );
        }

        if (results.apiTest && !results.apiTest.ok) {
            results.recommendations.push(
                `The API key is not working. Error: ${results.apiTest.status} ${results.apiTest.statusText}. Check if the key is correct and has the necessary permissions.`
            );
        }

        return NextResponse.json(results);
    } catch (error) {
        console.error('🔴 Error verifying Perplexity API key:', error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined
        });
    }
} 