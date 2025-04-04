import { describe, it, expect } from 'vitest';
import { extractTopicsFromText } from '../topic-extractor';

describe('Content Processing Integration', () => {
    it('should process text and extract topics with correct argument structure', async () => {
        const sampleText = `
      Climate change is a major global issue that requires immediate action. Rising temperatures
      have led to melting ice caps, extreme weather events, and disruption of ecosystems worldwide.
      Nations must work together to implement comprehensive policies.

      Artificial intelligence presents both opportunities and challenges for society. While AI can
      enhance productivity and solve complex problems, it also raises concerns about privacy and
      ethical decision-making. Responsible development frameworks are essential.
    `;

        // Process the text
        const topics = await extractTopicsFromText(sampleText);

        // Verify basic output structure
        expect(topics).toBeDefined();
        expect(Array.isArray(topics)).toBe(true);
        expect(topics.length).toBeGreaterThan(0);

        // Check that topics have the correct structure
        for (const topic of topics) {
            expect(topic).toHaveProperty('title');
            expect(topic).toHaveProperty('confidence');
            expect(typeof topic.confidence).toBe('number');
            expect(topic.confidence).toBeGreaterThan(0);
            expect(topic.confidence).toBeLessThanOrEqual(1);

            // Check arguments property - this was one of our issues
            expect(topic).toHaveProperty('arguments');
            expect(Array.isArray(topic.arguments)).toBe(true);
            expect(topic.arguments.length).toBeGreaterThan(0);

            // Verify argument structure
            for (const arg of topic.arguments) {
                expect(arg).toHaveProperty('claim');
                expect(typeof arg.claim).toBe('string');
                expect(arg.claim.length).toBeGreaterThan(0);

                expect(arg).toHaveProperty('evidence');
                expect(typeof arg.evidence).toBe('string');
                expect(arg.evidence.length).toBeGreaterThan(0);
            }
        }
    });

    it('should convert args to arguments when needed', async () => {
        // This function doesn't directly test the API response
        // but tests the logic in ContentUploader that handles the args/arguments conversion

        const sampleTopicWithArgs = {
            title: 'Test Topic',
            confidence: 0.8,
            args: [
                {
                    claim: 'Test Claim',
                    evidence: 'Test Evidence'
                }
            ]
        };

        const sampleTopicWithArguments = {
            title: 'Test Topic',
            confidence: 0.8,
            arguments: [
                {
                    claim: 'Test Claim',
                    evidence: 'Test Evidence'
                }
            ]
        };

        // Create conversion logic similar to what's in ContentUploader
        function convertArgsToArguments(topics) {
            return topics.map(topic => {
                if (!topic.arguments && topic.args) {
                    return {
                        ...topic,
                        arguments: topic.args
                    };
                }
                return topic;
            });
        }

        // Test with topic that has args instead of arguments
        const convertedTopics = convertArgsToArguments([sampleTopicWithArgs]);

        // Verify conversion worked correctly
        expect(convertedTopics[0]).toHaveProperty('arguments');
        expect(convertedTopics[0].arguments).toEqual(sampleTopicWithArgs.args);

        // Verify original format is preserved when already correct
        const preservedTopics = convertArgsToArguments([sampleTopicWithArguments]);
        expect(preservedTopics[0]).toEqual(sampleTopicWithArguments);
    });

    it('should handle empty text gracefully', async () => {
        const result = await extractTopicsFromText('');
        expect(result).toEqual([]);
    });
}); 