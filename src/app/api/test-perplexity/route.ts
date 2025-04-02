import { NextResponse } from 'next/server';

export async function GET() {
    try {
        // Check environment variables
        const apiKey = process.env.PERPLEXITY_API_KEY;
        const useMockData = process.env.USE_MOCK_DATA === 'true';
        const mockApi = process.env.MOCK_API === 'true';
        const nodeEnv = process.env.NODE_ENV;
        const apiTimeout = process.env.PERPLEXITY_API_TIMEOUT || '30000';

        // Prepare the response
        const environmentInfo = {
            apiKeyExists: !!apiKey,
            apiKeyFormat: apiKey ? (apiKey.startsWith('pplx-') ? 'valid' : 'invalid') : 'missing',
            apiKeyFirstFive: apiKey ? apiKey.substring(0, 5) : 'none',
            apiKeyLastFour: apiKey ? apiKey.substring(apiKey.length - 4) : 'none',
            useMockData,
            mockApi,
            nodeEnv,
            apiTimeout
        };

        // Only test the API if we have a valid format key
        let apiTestResult = { tested: false, status: null, message: 'API not tested' };

        if (apiKey && apiKey.startsWith('pplx-')) {
            try {
                // Test the API key with a direct call
                const response = await fetch('https://api.perplexity.ai/search', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${apiKey}`
                    },
                    body: JSON.stringify({
                        query: 'test query',
                        max_results: 1
                    })
                });

                apiTestResult.tested = true;
                apiTestResult.status = response.status;

                if (response.ok) {
                    const data = await response.json();
                    apiTestResult.message = 'API key is valid and working';
                    apiTestResult.sample = data.results && data.results.length > 0
                        ? { title: data.results[0].title }
                        : 'No results returned';
                } else {
                    const errorText = await response.text();
                    apiTestResult.message = `API request failed: ${response.status} ${response.statusText}`;
                    apiTestResult.error = errorText;
                }
            } catch (error) {
                apiTestResult.tested = true;
                apiTestResult.status = 'error';
                apiTestResult.message = `Exception during API test: ${error.message}`;
            }
        }

        // Generate recommendations
        const recommendations = [];

        if (!apiKey) {
            recommendations.push('Add a Perplexity API key to your .env.local file');
        } else if (!apiKey.startsWith('pplx-')) {
            recommendations.push('Your API key has an invalid format. It should start with "pplx-"');
        } else if (apiTestResult.status !== 200) {
            recommendations.push('Your API key appears to be invalid or expired. Get a new one from Perplexity API.');
        }

        if (useMockData) {
            recommendations.push('Set USE_MOCK_DATA=false in .env.local to use real API data');
        }

        if (mockApi) {
            recommendations.push('Set MOCK_API=false in .env.local to use real API data');
        }

        // Return the complete diagnostic information
        return NextResponse.json({
            environment: environmentInfo,
            apiTest: apiTestResult,
            recommendations,
            mockDataForced: useMockData || (nodeEnv === 'development' && mockApi),
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        return NextResponse.json({
            error: 'Error running diagnostics',
            message: error.message
        }, { status: 500 });
    }
} 