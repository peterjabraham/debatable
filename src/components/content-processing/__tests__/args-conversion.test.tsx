/**
 * This file tests the args/arguments conversion logic used in ContentUploader.tsx
 */
import { describe, it, expect } from 'vitest';

describe('Args to Arguments Conversion', () => {
    it('should properly convert args to arguments format', () => {
        // Mock response data format from backend
        const mockApiResponse = {
            topics: [
                {
                    title: 'Climate Change Solutions',
                    confidence: 0.85,
                    // Using 'args' instead of 'arguments' (backend format)
                    args: [
                        {
                            claim: 'Carbon tax implementation',
                            evidence: 'Economic incentives can effectively reduce emissions.',
                        },
                        {
                            claim: 'Renewable energy transition',
                            evidence: 'Solar and wind power are becoming cost-competitive with fossil fuels.',
                        }
                    ]
                },
                {
                    title: 'Already correct format',
                    confidence: 0.75,
                    // This one already has the correct 'arguments' format
                    arguments: [
                        {
                            claim: 'Correct format',
                            evidence: 'This topic already has the correct format',
                        }
                    ]
                }
            ]
        };

        // Mock the conversion function from ContentUploader
        function convertArgsFormat(data) {
            if (!data.topics || !Array.isArray(data.topics)) {
                return data;
            }

            return {
                ...data,
                topics: data.topics.map(topic => {
                    // Check for both 'arguments' and 'args' properties
                    const hasArguments = !!topic.arguments;
                    const hasArgs = !!topic.args;

                    // If the topic has 'args' but not 'arguments', convert the format
                    if (!hasArguments && hasArgs) {
                        return {
                            ...topic,
                            arguments: topic.args
                        };
                    }

                    return topic;
                })
            };
        }

        // Run the conversion
        const convertedData = convertArgsFormat(mockApiResponse);

        // Verify all topics now have 'arguments'
        expect(convertedData.topics[0]).toHaveProperty('arguments');
        expect(convertedData.topics[0].arguments).toEqual(mockApiResponse.topics[0].args);
        expect(convertedData.topics[0].arguments).toHaveLength(2);

        // The second topic should remain unchanged
        expect(convertedData.topics[1].arguments).toEqual(mockApiResponse.topics[1].arguments);

        // First argument should have correct structure
        const firstArg = convertedData.topics[0].arguments[0];
        expect(firstArg.claim).toBe('Carbon tax implementation');
        expect(firstArg.evidence).toBe('Economic incentives can effectively reduce emissions.');
    });

    it('should handle null or undefined args gracefully', () => {
        const mockData = {
            topics: [
                {
                    title: 'Empty topic',
                    confidence: 0.5,
                    // No arguments or args property
                },
                {
                    title: 'Null args',
                    confidence: 0.6,
                    args: null
                }
            ]
        };

        function convertArgsFormat(data) {
            if (!data.topics || !Array.isArray(data.topics)) {
                return data;
            }

            return {
                ...data,
                topics: data.topics.map(topic => {
                    const hasArguments = !!topic.arguments;
                    const hasArgs = !!topic.args;

                    if (!hasArguments && hasArgs) {
                        return {
                            ...topic,
                            arguments: topic.args
                        };
                    }

                    return topic;
                })
            };
        }

        const convertedData = convertArgsFormat(mockData);

        // The conversion should not add arguments property when none exists
        expect(convertedData.topics[0]).not.toHaveProperty('arguments');

        // When args is null, it shouldn't be copied
        expect(convertedData.topics[1]).not.toHaveProperty('arguments');
    });
}); 