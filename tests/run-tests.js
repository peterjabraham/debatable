/**
 * Test Runner Script
 * 
 * This script runs all the tests and verifies if the duplicate API request issue is resolved.
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const config = require('./test-config');

// Ensure the results directory exists
if (!fs.existsSync(config.outputDir)) {
    fs.mkdirSync(config.outputDir, { recursive: true });
}

// Log levels
const LOG_LEVELS = {
    INFO: '\x1b[36m%s\x1b[0m', // Cyan
    SUCCESS: '\x1b[32m%s\x1b[0m', // Green
    WARNING: '\x1b[33m%s\x1b[0m', // Yellow
    ERROR: '\x1b[31m%s\x1b[0m', // Red
};

// Logger utility
const logger = {
    info: (message) => console.log(LOG_LEVELS.INFO, message),
    success: (message) => console.log(LOG_LEVELS.SUCCESS, message),
    warning: (message) => console.log(LOG_LEVELS.WARNING, message),
    error: (message) => console.log(LOG_LEVELS.ERROR, message),
};

// Test result tracker
const testResults = {
    totalTests: 0,
    passedTests: 0,
    failedTests: 0,
    tests: []
};

/**
 * Run a test and report results
 */
function runTest(testName, testScript, options = {}) {
    logger.info(`\n----- Running Test: ${testName} -----`);

    const startTime = Date.now();
    testResults.totalTests++;

    try {
        // Run the test script
        const testPath = path.join(__dirname, testScript);

        if (!fs.existsSync(testPath)) {
            throw new Error(`Test script not found: ${testPath}`);
        }

        const output = execSync(`node ${testPath}`, {
            encoding: 'utf8',
            stdio: 'inherit' // Show output in real-time
        });

        const endTime = Date.now();
        const duration = endTime - startTime;

        // Check if test results JSON file exists
        const resultFile = path.join(config.outputDir, `${testName}-results.json`);
        let testSucceeded = false;

        if (fs.existsSync(resultFile)) {
            const results = JSON.parse(fs.readFileSync(resultFile, 'utf8'));

            // Check against success criteria
            const duplicateRate = parseFloat(results.summary.duplicateRate);
            const duplicateRequests = results.summary.duplicates;
            const totalRequests = results.summary.total;

            testSucceeded =
                duplicateRate <= config.successCriteria.maxDuplicateRate &&
                duplicateRequests <= config.successCriteria.maxDuplicateRequests &&
                totalRequests <= config.successCriteria.maxTotalRequests;

            if (testSucceeded) {
                logger.success(`✅ Test passed! Duplicate rate: ${duplicateRate}%, ` +
                    `Duplicate requests: ${duplicateRequests}, ` +
                    `Total requests: ${totalRequests}`);
                testResults.passedTests++;
            } else {
                logger.error(`❌ Test failed! Duplicate rate: ${duplicateRate}%, ` +
                    `Duplicate requests: ${duplicateRequests}, ` +
                    `Total requests: ${totalRequests}`);
                testResults.failedTests++;
            }
        } else {
            // If no results file is found, assume failure
            logger.error(`❌ Test failed! No results file found.`);
            testSucceeded = false;
            testResults.failedTests++;
        }

        // Record test results
        testResults.tests.push({
            name: testName,
            script: testScript,
            duration,
            success: testSucceeded,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        logger.error(`❌ Test execution error: ${error.message}`);
        testResults.tests.push({
            name: testName,
            script: testScript,
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        });
        testResults.failedTests++;
    }
}

/**
 * Print final test report
 */
function printReport() {
    const totalDuration = testResults.tests.reduce((sum, test) => sum + (test.duration || 0), 0);

    logger.info('\n=========================================');
    logger.info('            TEST SUMMARY                ');
    logger.info('=========================================');
    logger.info(`Total Tests: ${testResults.totalTests}`);

    if (testResults.passedTests === testResults.totalTests) {
        logger.success(`All tests passed! ✅`);
    } else {
        logger.error(`Tests Failed: ${testResults.failedTests} / ${testResults.totalTests} ❌`);
    }

    logger.info(`Total Duration: ${(totalDuration / 1000).toFixed(2)}s`);
    logger.info('=========================================');

    // Print individual test results
    logger.info('\nDetailed Results:');
    testResults.tests.forEach(test => {
        const status = test.success ? '✅ PASS' : '❌ FAIL';
        const duration = test.duration ? `(${(test.duration / 1000).toFixed(2)}s)` : '';

        if (test.success) {
            logger.success(`${status} - ${test.name} ${duration}`);
        } else {
            logger.error(`${status} - ${test.name} ${duration}`);
            if (test.error) {
                logger.error(`       Error: ${test.error}`);
            }
        }
    });

    // Save test report
    const reportPath = path.join(config.outputDir, 'test-report.json');
    fs.writeFileSync(reportPath, JSON.stringify({
        timestamp: new Date().toISOString(),
        summary: {
            total: testResults.totalTests,
            passed: testResults.passedTests,
            failed: testResults.failedTests,
            success: testResults.failedTests === 0
        },
        tests: testResults.tests
    }, null, 2));

    logger.info(`\nTest report saved to: ${reportPath}`);
}

// Run all tests
async function runAllTests() {
    logger.info('=== Starting API Duplication Tests ===');

    // Run server tests first
    runTest('api-duplication', 'api-duplication.test.js');

    // Run component tests
    runTest('component-request', 'component-request.test.js');

    // Print final report
    printReport();

    // Return success or failure
    return testResults.failedTests === 0;
}

// Exit with appropriate code
runAllTests()
    .then(success => {
        process.exit(success ? 0 : 1);
    })
    .catch(error => {
        console.error('Test runner error:', error);
        process.exit(1);
    }); 