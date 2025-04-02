/**
 * Shared Test Configuration
 */

const path = require('path');

module.exports = {
    // Server URLs
    expressServerUrl: 'http://localhost:3030',
    nextjsServerUrl: 'http://localhost:3000',

    // API endpoints to test
    testEndpoints: [
        '/api/debate',
        '/api/climate-debate',
        '/api/debate?action=test',
        '/api/climate-debate?action=test'
    ],

    // Test durations
    shortTestDuration: 5000,   // 5 seconds
    standardTestDuration: 10000, // 10 seconds
    longTestDuration: 30000,   // 30 seconds

    // Output directories
    outputDir: path.join(__dirname, 'results'),

    // Component test settings
    componentTestPath: '/',  // Main app page

    // Miscellaneous
    browser: {
        headless: false,
        slowMo: 50,
        defaultTimeout: 30000
    },

    // Success criteria
    successCriteria: {
        maxDuplicateRate: 5, // 5% duplicate rate is acceptable
        maxTotalRequests: 100, // Maximum acceptable API requests during test
        maxDuplicateRequests: 5 // Maximum acceptable duplicate requests
    }
}; 