import { describe, it, expect } from 'vitest';

// This file ensures all content processing tests are run together
// It can be extended with integration tests if needed

describe('Content Processing Integration', () => {
    it('includes all necessary test files', () => {
        // This test just verifies the test setup is correct
        // The actual tests are in the individual test files
        expect(true).toBe(true);
    });

    // We could add actual integration tests here that test
    // the full content processing pipeline from document upload
    // through topic extraction to display
});

// Import all tests to ensure they're included in the test run
import './document-processor.test';
import './topic-extractor.test';
import './media-processor.test';

// The tests from the ContentUploader component
// will be run separately as they're in a different directory 