/**
 * Jest configuration for Great Debate document analysis tests
 */

module.exports = {
    // Automatically clear mock calls, instances, contexts and results before every test
    clearMocks: true,

    // Indicates whether the coverage information should be collected while executing the test
    collectCoverage: true,

    // The directory where Jest should output its coverage files
    coverageDirectory: "coverage",

    // A list of paths to directories that Jest should use to search for files in
    roots: [
        "<rootDir>/tests"
    ],

    // The test environment that will be used for testing
    testEnvironment: "node",

    // The glob patterns Jest uses to detect test files
    testMatch: [
        "**/__tests__/**/*.ts?(x)",
        "**/?(*.)+(spec|test).ts?(x)"
    ],

    // An array of regexp pattern strings that are matched against all test paths, matched tests are skipped
    testPathIgnorePatterns: [
        "/node_modules/"
    ],

    // A map from regular expressions to paths to transformers
    transform: {
        '^.+\\.(ts|tsx)$': 'ts-jest',
    },

    // Indicates whether each individual test should be reported during the run
    verbose: true,

    moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
    },

    setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
}; 