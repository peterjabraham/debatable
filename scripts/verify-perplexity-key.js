/**
 * Perplexity API Key Verification
 * 
 * This script tests the validity of your Perplexity API key
 * by making a direct request to the Chat Completions API.
 */

require('dotenv').config({ path: '.env.local' });
const nodeFetch = require('node-fetch');

async function verifyPerplexityApiKey() {
    const apiKey = process.env.PERPLEXITY_API_KEY;

    if (!apiKey) {
        console.error('❌ ERROR: No Perplexity API key found in .env.local');
        return false;
    }

    console.log(`API Key found: ${apiKey.substring(0, 5)}...${apiKey.substring(apiKey.length - 4)}`);

    if (!apiKey.startsWith('pplx-')) {
        console.error('❌ ERROR: API key has incorrect format. It should start with "pplx-"');
        return false;
    }

    console.log('Making request to Perplexity Chat Completions API...');

    try {
        const response = await nodeFetch('https://api.perplexity.ai/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: 'sonar',
                messages: [
                    {
                        role: 'system',
                        content: 'You are a helpful assistant.'
                    },
                    {
                        role: 'user',
                        content: 'What is the capital of France?'
                    }
                ]
            })
        });

        console.log(`Response status: ${response.status} ${response.statusText}`);

        if (response.status === 401) {
            console.error('❌ AUTH ERROR: API key is invalid or expired (401 Unauthorized)');
            const errorText = await response.text();
            console.error('Error details:', errorText);
            return false;
        }

        if (!response.ok) {
            console.error(`❌ API ERROR: Request failed with status ${response.status}`);
            const errorText = await response.text();
            console.error('Error details:', errorText);
            return false;
        }

        // Successfully got a response
        const data = await response.json();

        if (data.choices && data.choices.length > 0) {
            console.log('✅ SUCCESS: API key is valid and working!');
            console.log('\nSample response:');
            console.log(data.choices[0].message.content.substring(0, 100) + '...');

            console.log('\nModel used:', data.model);
            console.log('Usage:', data.usage);
            return true;
        } else {
            console.error('❌ ERROR: Response format is unexpected', data);
            return false;
        }
    } catch (error) {
        console.error('❌ ERROR: Failed to make API request:', error.message);
        return false;
    }
}

async function main() {
    console.log('======== Perplexity API Key Verification ========\n');

    const isValid = await verifyPerplexityApiKey();

    console.log('\n======== Verification Result ========');
    if (isValid) {
        console.log('✅ Your Perplexity API key is valid and working!');
        console.log('\nNext steps:');
        console.log('1. Make sure USE_MOCK_DATA=false in your .env.local file');
        console.log('2. Restart your Next.js development server');
        console.log('3. Your application should now use real Perplexity API data');
    } else {
        console.log('❌ Your Perplexity API key is NOT working.');
        console.log('\nTroubleshooting steps:');
        console.log('1. Check if your API key is correct and has not expired');
        console.log('2. Ensure your account has access to the Chat Completions API');
        console.log('3. Get a new API key from https://www.perplexity.ai/ if needed');
        console.log('4. Update your .env.local file with the new key');
    }
}

main().catch(error => {
    console.error('Unhandled error during verification:', error);
    process.exit(1);
}); 