/**
 * Direct Perplexity API Test
 * 
 * This is a standalone test to verify the Perplexity API key works correctly.
 * Run with: node perplexity-direct-test.js
 */

// Load environment variables from .env.local
require('dotenv').config({ path: '.env.local' });

async function testPerplexityApiKey() {
    console.log('Testing Perplexity API key validity...');

    const apiKey = process.env.PERPLEXITY_API_KEY;
    if (!apiKey) {
        console.log('❌ No API key found in environment variables.');
        return false;
    }

    console.log(`API key found: ${apiKey.substring(0, 5)}...${apiKey.substring(apiKey.length - 4)}`);

    // Test if it starts with the correct prefix
    if (!apiKey.startsWith('pplx-')) {
        console.log('❌ API key has incorrect format. Should start with "pplx-"');
        return false;
    }

    try {
        console.log('Making test request to the Perplexity API...');
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

        console.log(`Response status: ${response.status} ${response.statusText}`);

        if (response.status === 401) {
            console.log('❌ API key is invalid or revoked (401 Unauthorized)');
            const errorBody = await response.text();
            console.log('Error details:', errorBody);
            return false;
        }

        if (!response.ok) {
            console.log(`❌ API request failed with status: ${response.status}`);
            const errorBody = await response.text();
            console.log('Error details:', errorBody);
            return false;
        }

        const data = await response.json();
        if (!data.results || !Array.isArray(data.results)) {
            console.log('❌ Invalid response format');
            console.log('Response:', data);
            return false;
        }

        console.log('✅ API key is valid and working!');
        console.log('Sample result:', data.results[0]?.title || 'No results');
        return true;
    } catch (error) {
        console.log('❌ Error testing API key:', error.message);
        return false;
    }
}

async function checkEnvironment() {
    console.log('\nEnvironment variables:');
    console.log(`NODE_ENV: ${process.env.NODE_ENV || 'not set'}`);
    console.log(`USE_MOCK_DATA: ${process.env.USE_MOCK_DATA || 'not set'}`);
    console.log(`MOCK_API: ${process.env.MOCK_API || 'not set'}`);

    if (process.env.USE_MOCK_DATA === 'true') {
        console.log('⚠️ Warning: USE_MOCK_DATA is set to true, which will force mock data in the application.');
    }
}

async function main() {
    console.log('======== Perplexity API Direct Test ========');

    await checkEnvironment();

    const apiKeyValid = await testPerplexityApiKey();

    console.log('\n======== Test Result ========');
    if (apiKeyValid) {
        console.log('✅ Perplexity API key is valid and working');
        console.log('\nRECOMMENDATION:');
        console.log('1. Make sure USE_MOCK_DATA=false in .env.local');
        console.log('2. Restart your Next.js application');
    } else {
        console.log('❌ Perplexity API key is not working');
        console.log('\nRECOMMENDATION:');
        console.log('1. Get a new API key from https://www.perplexity.ai/api');
        console.log('2. Update PERPLEXITY_API_KEY in .env.local');
        console.log('3. Set USE_MOCK_DATA=false in .env.local');
        console.log('4. Restart your Next.js application');
    }
}

main().catch(error => {
    console.error('Error running test:', error);
}); 