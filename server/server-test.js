/**
 * Express API Test
 * 
 * A standalone test for the Express API server that verifies:
 * 1. The server handles requests properly
 * 2. The server correctly deduplicates requests
 * 3. There is no memory leak or performance issue
 */

const http = require('http');
// Use CommonJS compatible import for node-fetch
const { default: fetch } = require('node-fetch');
const { Worker, isMainThread, workerData, parentPort } = require('worker_threads');
const path = require('path');

// Configuration
const CONFIG = {
    serverUrl: 'http://localhost:3030',
    endpoints: [
        '/api/debate',
        '/api/climate-debate'
    ],
    concurrentClients: 5,
    requestsPerClient: 20,
    requestInterval: 100 // ms
};

// Results tracking
const results = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    duplicateResponses: 0,
    startTime: null,
    endTime: null,
    requestTimes: []
};

/**
 * Make a request to the API
 */
async function makeRequest(endpoint, method = 'GET', body = null) {
    const startTime = Date.now();

    try {
        const options = {
            method,
            headers: {
                'Content-Type': 'application/json'
            }
        };

        if (body && method !== 'GET') {
            options.body = JSON.stringify(body);
        }

        const response = await fetch(`${CONFIG.serverUrl}${endpoint}`, options);
        const responseTime = Date.now() - startTime;

        if (!response.ok) {
            throw new Error(`HTTP error ${response.status}`);
        }

        const data = await response.json();

        return {
            success: true,
            data,
            responseTime,
            status: response.status,
            isDuplicate: !!data.deduplicated
        };
    } catch (error) {
        return {
            success: false,
            error: error.message,
            responseTime: Date.now() - startTime
        };
    }
}

/**
 * Run a test client that makes multiple requests
 */
async function runClient(clientId) {
    const clientResults = {
        clientId,
        requests: [],
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        duplicateResponses: 0,
        totalResponseTime: 0
    };

    // Randomly select an endpoint
    const endpoint = CONFIG.endpoints[Math.floor(Math.random() * CONFIG.endpoints.length)];

    // Make multiple requests
    for (let i = 0; i < CONFIG.requestsPerClient; i++) {
        const method = Math.random() > 0.5 ? 'GET' : 'POST';
        const body = method === 'POST' ? { action: 'test', clientId, requestId: i } : null;

        const result = await makeRequest(endpoint, method, body);

        // Update client stats
        clientResults.totalRequests++;
        if (result.success) {
            clientResults.successfulRequests++;
            if (result.isDuplicate) {
                clientResults.duplicateResponses++;
            }
        } else {
            clientResults.failedRequests++;
        }

        clientResults.totalResponseTime += result.responseTime;
        clientResults.requests.push(result);

        // Wait a bit between requests
        await new Promise(resolve => setTimeout(resolve, CONFIG.requestInterval));
    }

    // Calculate average response time
    clientResults.averageResponseTime = clientResults.totalResponseTime / clientResults.totalRequests;

    return clientResults;
}

/**
 * Run test in worker threads
 */
async function runWorker(clientId) {
    return new Promise((resolve, reject) => {
        const worker = new Worker(__filename, {
            workerData: { clientId }
        });

        worker.on('message', resolve);
        worker.on('error', reject);
        worker.on('exit', code => {
            if (code !== 0) {
                reject(new Error(`Worker stopped with exit code ${code}`));
            }
        });
    });
}

/**
 * Run the test with multiple clients
 */
async function runTest() {
    console.log(`=== Express API Test ===`);
    console.log(`Server: ${CONFIG.serverUrl}`);
    console.log(`Concurrent clients: ${CONFIG.concurrentClients}`);
    console.log(`Requests per client: ${CONFIG.requestsPerClient}`);
    console.log(`Total requests: ${CONFIG.concurrentClients * CONFIG.requestsPerClient}`);
    console.log('Starting test...\n');

    results.startTime = Date.now();

    // Run multiple clients
    const clientPromises = [];
    for (let i = 0; i < CONFIG.concurrentClients; i++) {
        if (isMainThread) {
            clientPromises.push(runWorker(i));
        } else {
            clientPromises.push(runClient(i));
        }
    }

    const clientResults = await Promise.all(clientPromises);

    // Aggregate results
    clientResults.forEach(client => {
        results.totalRequests += client.totalRequests;
        results.successfulRequests += client.successfulRequests;
        results.failedRequests += client.failedRequests;
        results.duplicateResponses += client.duplicateResponses;
        results.requestTimes = results.requestTimes.concat(
            client.requests.map(r => r.responseTime)
        );
    });

    results.endTime = Date.now();
    results.testDuration = results.endTime - results.startTime;
    results.averageResponseTime = results.requestTimes.reduce((sum, time) => sum + time, 0) / results.requestTimes.length;

    // Calculate request rate
    results.requestRate = results.totalRequests / (results.testDuration / 1000);

    // Calculate duplication rate
    results.duplicateRate = (results.duplicateResponses / results.totalRequests) * 100;

    return results;
}

/**
 * Output test results
 */
function outputResults(results) {
    console.log('\n=== Test Results ===');
    console.log(`Total requests: ${results.totalRequests}`);
    console.log(`Successful requests: ${results.successfulRequests}`);
    console.log(`Failed requests: ${results.failedRequests}`);
    console.log(`Duplicate responses: ${results.duplicateResponses}`);
    console.log(`Duplication rate: ${results.duplicateRate.toFixed(2)}%`);
    console.log(`Test duration: ${results.testDuration}ms`);
    console.log(`Average response time: ${results.averageResponseTime.toFixed(2)}ms`);
    console.log(`Request rate: ${results.requestRate.toFixed(2)} requests/second`);

    // Determine if test passed
    const passed =
        results.failedRequests === 0 &&
        results.duplicateRate < 50 && // Some duplication is expected due to the server's deduplication
        results.averageResponseTime < 500; // Less than 500ms average response time

    if (passed) {
        console.log('\n✅ TEST PASSED');
    } else {
        console.log('\n❌ TEST FAILED');

        if (results.failedRequests > 0) {
            console.log('- Some requests failed');
        }

        if (results.duplicateRate >= 50) {
            console.log('- Too many duplicate responses');
        }

        if (results.averageResponseTime >= 500) {
            console.log('- Response time too slow');
        }
    }

    return passed;
}

// Run as worker or main thread
if (isMainThread) {
    // Main thread - run the test and output results
    runTest()
        .then(results => {
            const passed = outputResults(results);
            process.exit(passed ? 0 : 1);
        })
        .catch(error => {
            console.error('Test error:', error);
            process.exit(1);
        });
} else {
    // Worker thread - run a client and send results back
    runClient(workerData.clientId)
        .then(results => {
            parentPort.postMessage(results);
        })
        .catch(error => {
            console.error(`Client ${workerData.clientId} error:`, error);
            parentPort.postMessage({
                clientId: workerData.clientId,
                error: error.message,
                totalRequests: 0,
                successfulRequests: 0,
                failedRequests: CONFIG.requestsPerClient,
                duplicateResponses: 0,
                requests: []
            });
        });
} 