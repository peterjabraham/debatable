/**
 * Perplexity Chat API Test for Recommended Readings
 * 
 * This script demonstrates using the Chat Completions API to generate recommended readings
 * as an alternative to the Search API.
 */

require('dotenv').config({ path: '.env.local' });
const https = require('https');

async function makeRequest(options, data) {
    return new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
            let responseData = '';

            res.on('data', (chunk) => {
                responseData += chunk;
            });

            res.on('end', () => {
                try {
                    const jsonData = JSON.parse(responseData);
                    resolve({ statusCode: res.statusCode, data: jsonData });
                } catch (e) {
                    resolve({ statusCode: res.statusCode, data: responseData });
                }
            });
        });

        req.on('error', (error) => {
            reject(error);
        });

        req.write(data);
        req.end();
    });
}

async function getRecommendedReadingsWithChatAPI(expertRole, topic) {
    const apiKey = process.env.PERPLEXITY_API_KEY;

    if (!apiKey) {
        console.error('ERROR: No API key found in .env.local file');
        return null;
    }

    console.log(`Getting recommended readings for ${expertRole} on topic: ${topic}`);

    const prompt = `
    As an ${expertRole}, please provide 3 recommended academic readings related to "${topic}".
    Format each recommendation with a title, URL, and short description (snippet).
    
    Return the results in the following JSON format:
    [
        {
            "title": "Title of Paper 1",
            "url": "https://example.com/paper1",
            "snippet": "Brief description of the paper and why it's relevant"
        },
        {
            "title": "Title of Paper 2",
            "url": "https://example.com/paper2",
            "snippet": "Brief description of the paper and why it's relevant"
        },
        {
            "title": "Title of Paper 3",
            "url": "https://example.com/paper3",
            "snippet": "Brief description of the paper and why it's relevant"
        }
    ]
    `;

    const options = {
        hostname: 'api.perplexity.ai',
        path: '/chat/completions',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        }
    };

    const data = JSON.stringify({
        model: 'sonar',
        messages: [
            {
                role: 'system',
                content: 'You are a helpful assistant specialized in providing academic reading recommendations. Always return results in valid JSON format.'
            },
            {
                role: 'user',
                content: prompt
            }
        ]
        // The response_format parameter is not supported by this version of the API
    });

    try {
        const response = await makeRequest(options, data);

        if (response.statusCode === 200 && response.data.choices && response.data.choices.length > 0) {
            const content = response.data.choices[0].message.content;

            // Parse the JSON content from the response
            try {
                // The Perplexity API returns the JSON in a markdown code block, so we need to extract it
                console.log('Raw content from API:', content.substring(0, 200) + '...');

                // Extract JSON from markdown code block if present
                let jsonContent = content;
                const jsonBlockRegex = /```(?:json)?\s*(\[[\s\S]*?\])\s*```/;
                const jsonMatch = content.match(jsonBlockRegex);

                if (jsonMatch && jsonMatch[1]) {
                    jsonContent = jsonMatch[1];
                    console.log('Extracted JSON from markdown code block');
                }

                // Parse the JSON
                const parsedContent = JSON.parse(jsonContent);

                if (Array.isArray(parsedContent)) {
                    return parsedContent;
                } else if (parsedContent.readings || parsedContent.results) {
                    return parsedContent.readings || parsedContent.results;
                } else {
                    console.error('Invalid response format:', parsedContent);
                    return null;
                }
            } catch (e) {
                console.error('Failed to parse JSON from response:', e.message);

                // As a fallback, let's try to manually construct readings from the full content
                try {
                    // Look for patterns that might indicate titles, URLs, and snippets
                    const titles = content.match(/title['"]\s*:\s*['"](.*?)['"]/g);
                    const urls = content.match(/url['"]\s*:\s*['"](.*?)['"]/g);
                    const snippets = content.match(/snippet['"]\s*:\s*['"](.*?)['"]/g);

                    if (titles && urls && snippets && titles.length === urls.length && urls.length === snippets.length) {
                        console.log('Manually extracting readings from content');

                        const manualReadings = [];
                        for (let i = 0; i < titles.length; i++) {
                            const title = titles[i].match(/:\s*['"](.*?)['"]/)[1];
                            const url = urls[i].match(/:\s*['"](.*?)['"]/)[1];
                            const snippet = snippets[i].match(/:\s*['"](.*?)['"]/)[1];

                            manualReadings.push({ title, url, snippet });
                        }

                        return manualReadings;
                    }
                } catch (manualError) {
                    console.error('Failed manual extraction:', manualError.message);
                }

                return null;
            }
        } else {
            console.error('API request failed:', response.statusCode, response.data);
            return null;
        }
    } catch (error) {
        console.error('Error making API request:', error);
        return null;
    }
}

// Test the function with some example experts and topics
async function runTest() {
    console.log('====== Testing Recommended Readings with Chat API ======');

    const testCases = [
        { role: 'Environmental Scientist', topic: 'climate change impact on biodiversity' },
        { role: 'Economist', topic: 'carbon pricing policies' },
    ];

    for (const test of testCases) {
        console.log(`\n----- Testing ${test.role} on topic: ${test.topic} -----`);

        const readings = await getRecommendedReadingsWithChatAPI(test.role, test.topic);

        if (readings) {
            console.log('✅ Successfully generated recommended readings!');
            console.log('Number of recommendations:', readings.length);

            readings.forEach((reading, index) => {
                console.log(`\nReading ${index + 1}:`);
                console.log(`Title: ${reading.title}`);
                console.log(`URL: ${reading.url}`);
                console.log(`Snippet: ${reading.snippet.substring(0, 150)}...`);
            });
        } else {
            console.log('❌ Failed to generate recommended readings');
        }
    }

    console.log('\n====== Recommendation ======');
    console.log('Since your API key works with the Chat Completions API but not the Search API,');
    console.log('you could update your code to use the Chat Completions API for generating');
    console.log('recommended readings instead of using the Search API.');
}

runTest().catch(error => {
    console.error('Fatal error running test:', error);
}); 