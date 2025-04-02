/**
 * Perplexity API Test Script
 * 
 * Run with: node scripts/test-perplexity.js
 */

// Load environment variables from .env.local
require('dotenv').config({ path: '.env.local' });
const fetch = require('node-fetch');

async function testPerplexityApi() {
    console.log('======== Perplexity API Test ========');

    // Check environment variables
    const apiKey = process.env.PERPLEXITY_API_KEY;
    const useMockData = process.env.USE_MOCK_DATA === 'true';

    console.log('Environment:');
    console.log(`- API Key: ${apiKey ? `${apiKey.substring(0, 5)}...${apiKey.substring(apiKey.length - 4)}` : 'Not found'}`);
    console.log(`- USE_MOCK_DATA: ${useMockData}`);

    if (!apiKey) {
        console.error('Error: No Perplexity API key found in environment variables');
        return;
    }

    if (!apiKey.startsWith('pplx-')) {
        console.error('Error: API key has incorrect format. Should start with "pplx-"');
        return;
    }

    try {
        console.log('\nMaking test request to Perplexity API...');

        const response = await fetch('https://api.perplexity.ai/search', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                query: 'climate change research papers',
                max_results: 3
            })
        });

        console.log(`Response status: ${response.status} ${response.statusText}`);

        if (!response.ok) {
            console.error('Error: API request failed');
            const errorText = await response.text();
            console.error('Error details:', errorText);
            return;
        }

        const data = await response.json();
        console.log('\nAPI Response:');
        console.log(JSON.stringify(data, null, 2).substring(0, 500) + '...');

        if (!data.results || !Array.isArray(data.results)) {
            console.error('Error: Invalid response format');
            return;
        }

        console.log('\nResults:');
        data.results.forEach((result, index) => {
            console.log(`${index + 1}. ${result.title}`);
            console.log(`   URL: ${result.url}`);
            console.log(`   Snippet: ${result.snippet.substring(0, 100)}...`);
            console.log('');
        });

        console.log('Test completed successfully!');
    } catch (error) {
        console.error('Error:', error.message);
    }
}

testPerplexityApi(); 