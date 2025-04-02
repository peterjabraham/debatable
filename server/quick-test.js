/**
 * Quick API Test Script
 * Tests the Express server's request deduplication
 */

const http = require('http');

// Configuration
const config = {
    host: 'localhost',
    port: 3030,
    endpoints: ['/api/debate', '/api/climate-debate'],
    requests: 20,
    interval: 100 // ms
};

// Track results
const results = {
    successful: 0,
    failed: 0,
    duplicates: 0,
    total: 0,
    startTime: Date.now(),
    responseTimes: []
};

/**
 * Make an HTTP request
 */
function makeRequest(endpoint, method = 'GET', callback) {
    const options = {
        hostname: config.host,
        port: config.port,
        path: endpoint,
        method: method,
        headers: {
            'Content-Type': 'application/json'
        }
    };

    const startTime = Date.now();

    const req = http.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
            data += chunk;
        });

        res.on('end', () => {
            const responseTime = Date.now() - startTime;
            results.responseTimes.push(responseTime);

            try {
                const response = JSON.parse(data);
                results.total++;

                if (res.statusCode === 200) {
                    results.successful++;
                    if (response.deduplicated) {
                        results.duplicates++;
                    }
                } else {
                    results.failed++;
                }

                callback(null, {
                    status: res.statusCode,
                    data: response,
                    responseTime
                });
            } catch (error) {
                results.failed++;
                results.total++;
                callback(error);
            }
        });
    });

    req.on('error', (error) => {
        results.failed++;
        results.total++;
        callback(error);
    });

    if (method === 'POST') {
        req.write(JSON.stringify({ action: 'test', timestamp: Date.now() }));
    }

    req.end();
}

/**
 * Run a series of requests
 */
function runTest() {
    console.log('=== Express API Quick Test ===');
    console.log(`Server: ${config.host}:${config.port}`);
    console.log(`Testing ${config.endpoints.length} endpoints with ${config.requests} requests each`);
    console.log('Starting...\n');

    let completed = 0;
    const totalRequests = config.endpoints.length * config.requests;

    // Run requests for each endpoint
    config.endpoints.forEach(endpoint => {
        for (let i = 0; i < config.requests; i++) {
            // Alternate between GET and POST
            const method = i % 2 === 0 ? 'GET' : 'POST';

            // Stagger requests slightly to simulate real traffic
            setTimeout(() => {
                makeRequest(endpoint, method, (error, response) => {
                    if (error) {
                        console.error(`Error [${endpoint}]: ${error.message}`);
                    } else {
                        console.log(`${method} ${endpoint} - ${response.status} - Deduplicated: ${response.data.deduplicated || false}`);
                    }

                    // Check if we're done
                    completed++;
                    if (completed === totalRequests) {
                        printResults();
                    }
                });
            }, i * config.interval);
        }
    });
}

/**
 * Print the test results
 */
function printResults() {
    const endTime = Date.now();
    const duration = endTime - results.startTime;
    const avgResponseTime = results.responseTimes.reduce((sum, time) => sum + time, 0) / results.responseTimes.length;
    const duplicateRate = results.total > 0 ? (results.duplicates / results.total) * 100 : 0;

    console.log('\n=== Test Results ===');
    console.log(`Total requests: ${results.total}`);
    console.log(`Successful: ${results.successful}`);
    console.log(`Failed: ${results.failed}`);
    console.log(`Duplicates detected: ${results.duplicates}`);
    console.log(`Duplication rate: ${duplicateRate.toFixed(2)}%`);
    console.log(`Test duration: ${duration}ms`);
    console.log(`Average response time: ${avgResponseTime.toFixed(2)}ms`);

    const passed = results.failed === 0;

    if (passed) {
        console.log('\n✅ TEST PASSED');
    } else {
        console.log('\n❌ TEST FAILED');
    }

    // Exit with appropriate code
    process.exit(passed ? 0 : 1);
}

// Run the test
runTest(); 