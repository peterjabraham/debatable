import { describe, it, expect, vi } from 'vitest';
import { extractTopicsFromText, TopicExtractor } from '../topic-extractor';
import { compareTwoStrings } from 'string-similarity';

// Mock string-similarity
vi.mock('string-similarity', () => ({
    compareTwoStrings: vi.fn().mockReturnValue(0.5) // Default medium similarity
}));

describe('Topic Extractor', () => {
    describe('extractTopicsFromText', () => {
        it('should extract topics from provided text', async () => {
            // Sample text with clear topics
            const sampleText = `
        Climate change is a major global challenge. Rising temperatures have led to melting ice caps,
        extreme weather events, and disruption of ecosystems worldwide. Nations must work together to
        reduce carbon emissions and transition to renewable energy sources.

        Artificial intelligence is transforming many industries. While AI can enhance productivity and
        solve complex problems, it also raises concerns about job displacement and ethical decision-making.
        Frameworks for responsible AI development are essential.
      `;

            const result = await extractTopicsFromText(sampleText);

            // Check result structure
            expect(result).toBeDefined();
            expect(Array.isArray(result)).toBe(true);
            expect(result.length).toBeGreaterThan(0);

            // Check topic structure
            const firstTopic = result[0];
            expect(firstTopic).toHaveProperty('title');
            expect(firstTopic).toHaveProperty('confidence');
            expect(firstTopic).toHaveProperty('arguments');
            expect(Array.isArray(firstTopic.arguments)).toBe(true);

            // Check argument structure
            if (firstTopic.arguments.length > 0) {
                const firstArg = firstTopic.arguments[0];
                expect(firstArg).toHaveProperty('claim');
                expect(firstArg).toHaveProperty('evidence');
            }
        });

        it('should return empty array for empty text', async () => {
            const result = await extractTopicsFromText('');
            expect(result).toEqual([]);
        });

        it('should throw error when processing fails', async () => {
            // Mock implementation to force an error
            vi.spyOn(TopicExtractor.prototype, 'extractTopics').mockImplementation(() => {
                throw new Error('Extraction failed');
            });

            await expect(extractTopicsFromText('This will fail')).rejects.toThrow('Failed to extract topics');

            // Restore the original implementation
            vi.restoreAllMocks();
        });

        it('should always include at least one argument for each topic', async () => {
            // Mock TopicExtractor to return topics with no arguments
            vi.spyOn(TopicExtractor.prototype, 'extractTopics').mockResolvedValue({
                topics: [
                    { title: 'Test Topic', confidence: 0.8, relatedTopics: [] }
                ],
                args: [] // No arguments
            });

            const result = await extractTopicsFromText('Test content');

            // Verify that we auto-generated arguments
            expect(result[0].arguments.length).toBeGreaterThan(0);
            expect(result[0].arguments[0]).toHaveProperty('claim');
            expect(result[0].arguments[0]).toHaveProperty('evidence');
        });
    });

    describe('TopicExtractor class', () => {
        it('should correctly initialize with default options', () => {
            const extractor = new TopicExtractor();

            // Access private options through any to verify defaults
            // This is just for testing purposes
            const options = (extractor as any).options;

            expect(options.minConfidence).toBe(0.6);
            expect(options.maxTopics).toBe(5);
            expect(options.extractCounterpoints).toBe(true);
            expect(options.language).toBe('english');
        });

        it('should extract topics with custom options', async () => {
            // Create with custom options
            const extractor = new TopicExtractor({
                minConfidence: 0.4,
                maxTopics: 3,
                extractCounterpoints: false
            });

            // Mock string similarity for predictable results
            vi.mocked(compareTwoStrings)
                .mockReturnValueOnce(0.8) // High relevance for first check
                .mockReturnValue(0.3);    // Medium relevance for others

            const parsedDoc = {
                content: 'Climate change is an important global issue that requires immediate attention.'
            };

            const result = await extractor.extractTopics(parsedDoc);

            expect(result).toHaveProperty('topics');
            expect(result).toHaveProperty('args');
            expect(Array.isArray(result.topics)).toBe(true);

            // Ensure topics have correct structure
            if (result.topics.length > 0) {
                const topic = result.topics[0];
                expect(topic).toHaveProperty('title');
                expect(topic).toHaveProperty('confidence');
                expect(typeof topic.confidence).toBe('number');
            }
        });

        it('should handle errors in the extraction process', async () => {
            const extractor = new TopicExtractor();

            // Force an error in one of the private methods
            vi.spyOn(extractor as any, 'splitIntoSentences').mockImplementation(() => {
                throw new Error('Failed to split sentences');
            });

            await expect(extractor.extractTopics({ content: 'Test' }))
                .rejects.toThrow('Topic extraction failed');
        });

        it('should properly transform argument structure', async () => {
            // Create extractor with test implementation that returns a specific structure
            vi.spyOn(TopicExtractor.prototype as any, 'extractPotentialTopics').mockReturnValue(['climate change']);
            vi.spyOn(TopicExtractor.prototype as any, 'calculateTopicConfidence').mockReturnValue(0.8);
            vi.spyOn(TopicExtractor.prototype as any, 'isSentenceRelevantToTopic').mockReturnValue(true);
            vi.spyOn(TopicExtractor.prototype as any, 'isClaim').mockReturnValue(true);
            vi.spyOn(TopicExtractor.prototype as any, 'calculateArgumentConfidence').mockReturnValue(0.7);

            const parsedDoc = {
                content: 'Climate change requires action. We must reduce emissions.'
            };

            const extractor = new TopicExtractor();
            const result = await extractor.extractTopics(parsedDoc);

            expect(result.topics.length).toBeGreaterThan(0);
            expect(result.args.length).toBeGreaterThan(0);

            // Verify args are linked to topics by topicTitle
            if (result.args.length > 0 && result.topics.length > 0) {
                expect(result.args[0].topicTitle).toBe(result.topics[0].title);
            }
        });
    });
}); 