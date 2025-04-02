/**
 * Perplexity API Key Validation Test
 * 
 * This script tests the validity of the Perplexity API key in different ways
 * to diagnose why we're not getting real data.
 */

require('dotenv').config({ path: '.env.local' });
const https = require('https');

// Log environment info
console.log('====== Environment Info ======');
console.log(`API Key: ${process.env.PERPLEXITY_API_KEY ? `${process.env.PERPLEXITY_API_KEY.substring(0, 5)}...${process.env.PERPLEXITY_API_KEY.substring(process.env.PERPLEXITY_API_KEY.length - 4)}` : 'Not set'}`);
console.log(`USE_MOCK_DATA: ${process.env.USE_MOCK_DATA === 'true' ? 'true' : 'false'}`);
console.log(`Environment: ${process.env.NODE_ENV || 'not set'}`);

// Helper function to make HTTPS requests
function makeRequest(options, data = null) {
    return new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
            let responseData = '';

            // Log status code and headers
            console.log(`Status Code: ${res.statusCode}`);
            console.log(`Status Message: ${res.statusMessage}`);
            console.log('Headers:', res.headers);

            res.on('data', (chunk) => {
                responseData += chunk;
            });

            res.on('end', () => {
                try {
                    // Try to parse as JSON, fall back to text if it fails
                    try {
                        const jsonData = JSON.parse(responseData);
                        resolve({ statusCode: res.statusCode, headers: res.headers, data: jsonData });
                    } catch (e) {
                        resolve({ statusCode: res.statusCode, headers: res.headers, data: responseData });
                    }
                } catch (e) {
                    reject(new Error(`Failed to parse response: ${e.message}`));
                }
            });
        });

        req.on('error', (error) => {
            reject(error);
        });

        if (data) {
            req.write(data);
        }

        req.end();
    });
}

// Test the API key in different ways
async function runTests() {
    const apiKey = process.env.PERPLEXITY_API_KEY;

    if (!apiKey) {
        console.error('ERROR: No API key found in .env.local file');
        return;
    }

    console.log('\n====== Testing API Key Format ======');
    if (!apiKey.startsWith('pplx-')) {
        console.log('❌ API key has incorrect format. Should start with "pplx-"');
    } else {
        console.log('✅ API key has correct format (starts with "pplx-")');
    }

    console.log('\n====== Test 1: Search API ======');
    try {
        const searchOptions = {
            hostname: 'api.perplexity.ai',
            path: '/search',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            }
        };

        const searchData = JSON.stringify({
            query: 'climate change research',
            max_results: 1
        });

        console.log('Making request to /search endpoint...');
        const searchResponse = await makeRequest(searchOptions, searchData);

        if (searchResponse.statusCode === 200) {
            console.log('✅ Search API test passed!');
            console.log('Sample result:', searchResponse.data.results ? searchResponse.data.results[0].title : 'No results');
        } else {
            console.log(`❌ Search API test failed with status ${searchResponse.statusCode}`);
            console.log('Error details:', searchResponse.data);
        }
    } catch (error) {
        console.error('❌ Search API test error:', error.message);
    }

    console.log('\n====== Test 2: Chat Completions API ======');
    try {
        const chatOptions = {
            hostname: 'api.perplexity.ai',
            path: '/chat/completions',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            }
        };

        const chatData = JSON.stringify({
            model: 'sonar',
            messages: [
                {
                    role: 'system',
                    content: 'Be precise and concise.'
                },
                {
                    role: 'user',
                    content: 'How many stars are there in our galaxy?'
                }
            ]
        });

        console.log('Making request to /chat/completions endpoint...');
        const chatResponse = await makeRequest(chatOptions, chatData);

        if (chatResponse.statusCode === 200) {
            console.log('✅ Chat Completions API test passed!');
            console.log('Response:', chatResponse.data.choices ? chatResponse.data.choices[0].message.content.substring(0, 100) + '...' : 'No content');
        } else {
            console.log(`❌ Chat Completions API test failed with status ${chatResponse.statusCode}`);
            console.log('Error details:', chatResponse.data);
        }
    } catch (error) {
        console.error('❌ Chat Completions API test error:', error.message);
    }

    console.log('\n====== Recommendations ======');
    if (apiKey.startsWith('pplx-')) {
        console.log('1. Your API key has the correct format but may be invalid or expired.');
        console.log('2. Get a new API key from https://www.perplexity.ai/ and update your .env.local file.');
        console.log('3. Make sure USE_MOCK_DATA=false in your .env.local file.');
        console.log('4. Restart your Next.js application after updating the API key.');
    } else {
        console.log('1. Your API key has an incorrect format. Perplexity API keys should start with "pplx-".');
        console.log('2. Get a valid API key from https://www.perplexity.ai/ and update your .env.local file.');
    }
}

// Run the tests
runTests().catch(error => {
    console.error('Fatal error running tests:', error);
}); 