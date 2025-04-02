/**
 * Perplexity API Test
 * 
 * This file contains tests to diagnose issues with the Perplexity API integration.
 */

// First, we'll test direct API access to diagnose the issue
async function testDirectPerplexityApi() {
    console.log('======== Testing Direct Perplexity API Access ========');

    // Get API key from environment
    const apiKey = process.env.PERPLEXITY_API_KEY;
    console.log('API Key available:', apiKey ? `Yes (starts with ${apiKey.substring(0, 5)}...)` : 'No');

    if (!apiKey) {
        console.error('ERROR: No Perplexity API key found in environment variables');
        return false;
    }

    try {
        console.log('Making test request to Perplexity API...');
        const response = await fetch('https://api.perplexity.ai/search', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                query: 'climate change research papers',
                max_results: 1
            })
        });

        console.log('API Response Status:', response.status, response.statusText);

        if (!response.ok) {
            console.error('ERROR: API response not OK. Status:', response.status);
            const errorText = await response.text();
            console.error('Error response:', errorText);
            return false;
        }

        const data = await response.json();
        console.log('API Response Data:', JSON.stringify(data, null, 2).substring(0, 500) + '...');

        if (!data.results || !Array.isArray(data.results)) {
            console.error('ERROR: Invalid response format. Expected results array.');
            return false;
        }

        console.log('Success! API returned valid data.');
        return true;
    } catch (error) {
        console.error('ERROR: Exception during API call:', error);
        return false;
    }
}

// Test the client-side interface
async function testClientInterface() {
    console.log('\n======== Testing Client Interface ========');

    // Import the client function
    const { getMultiExpertRecommendedReading } = require('../../api/perplexity');

    try {
        console.log('Testing getMultiExpertRecommendedReading...');
        const experts = [
            { role: 'Environmental Scientist', topic: 'climate change' }
        ];

        console.log('Request data:', JSON.stringify(experts));

        const results = await getMultiExpertRecommendedReading(experts);
        console.log('Client results:', JSON.stringify(results, null, 2).substring(0, 500) + '...');

        return true;
    } catch (error) {
        console.error('ERROR: Exception in client interface:', error);
        return false;
    }
}

// Environment check
function checkEnvironmentVariables() {
    console.log('\n======== Checking Environment Variables ========');

    const relevantVars = [
        'PERPLEXITY_API_KEY',
        'USE_MOCK_DATA',
        'MOCK_API',
        'NODE_ENV'
    ];

    relevantVars.forEach(varName => {
        console.log(`${varName}: ${process.env[varName] || 'not set'}`);
    });

    if (process.env.USE_MOCK_DATA === 'true') {
        console.log('WARNING: USE_MOCK_DATA is set to true, which may force mock data usage');
    }
}

// Check mock data generation
function testMockData() {
    console.log('\n======== Testing Mock Data Generation ========');

    // Import the client function (has mock data generator)
    const { getMultiExpertRecommendedReading } = require('../../api/perplexity');

    // Set environment to force mock data
    const originalEnv = process.env.USE_MOCK_DATA;
    process.env.USE_MOCK_DATA = 'true';
    process.env.NODE_ENV = 'development';

    try {
        console.log('Environment context: USE_MOCK_DATA=true, NODE_ENV=development');

        // Mock experts data
        const experts = [
            { name: 'Test Expert', type: 'domain', expertise: 'testing' }
        ];

        // Check if we have a local mock data function
        if (typeof generateMockResults === 'function') {
            const mockResults = generateMockResults(experts);
            console.log('Mock data from local function:', JSON.stringify(mockResults, null, 2).substring(0, 500) + '...');
        } else {
            console.log('No local mock data function available to test directly');
        }

        // Reset environment
        process.env.USE_MOCK_DATA = originalEnv;
    } catch (error) {
        console.error('ERROR in mock data test:', error);
        // Reset environment
        process.env.USE_MOCK_DATA = originalEnv;
    }
}

// Main diagnostic function
async function runDiagnostics() {
    console.log('Starting Perplexity API diagnostics...');

    // Check environment variables first
    checkEnvironmentVariables();

    // Test direct API access
    const directApiSuccess = await testDirectPerplexityApi();

    // Test mock data
    testMockData();

    // Test client interface
    const clientSuccess = await testClientInterface();

    console.log('\n======== Diagnostic Summary ========');
    console.log('Direct API test:', directApiSuccess ? '✅ PASSED' : '❌ FAILED');
    console.log('Client interface test:', clientSuccess ? '✅ PASSED' : '❌ FAILED');

    if (!directApiSuccess) {
        console.log('\nRECOMMENDATION: The Perplexity API key may be invalid or expired.');
        console.log('Action: Obtain a new API key from https://www.perplexity.ai/api and update .env.local');
    }

    if (process.env.USE_MOCK_DATA === 'true') {
        console.log('\nRECOMMENDATION: Mock data is enabled. To use real data:');
        console.log('1. Set USE_MOCK_DATA=false in .env.local');
        console.log('2. Ensure you have a valid PERPLEXITY_API_KEY');
    }
}

// Run the diagnostics
runDiagnostics().catch(error => {
    console.error('Fatal error in diagnostics:', error);
}); 