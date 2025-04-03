import {
    ParsedDocument,
    TopicExtractionResult,
    TopicExtractorOptions,
    Topic,
    Argument
} from '@/types/content-processing';
import { compareTwoStrings } from 'string-similarity';

const DEFAULT_OPTIONS: TopicExtractorOptions = {
    minConfidence: 0.6,
    maxTopics: 5,
    extractCounterpoints: true,
    language: 'english',
};

/**
 * Extract debate topics from text content
 * @param text The text content to extract topics from
 * @returns An array of extracted topics with arguments
 */
export async function extractTopicsFromText(text: string) {
    try {
        console.log('Extracting topics from text');

        // Check for empty text
        if (!text || text.trim() === '') {
            console.warn('Empty text provided to topic extractor');
            return [];
        }

        // Create a topic extractor instance
        const extractor = new TopicExtractor();

        // Parse the document
        const parsedDocument: ParsedDocument = {
            content: text,
            sections: [{
                title: 'Main Content',
                content: text
            }]
        };

        // Extract topics
        console.log('Running topic extraction');

        let extractionResult;
        try {
            extractionResult = await extractor.extractTopics(parsedDocument);
        } catch (error) {
            console.error('Error during topic extraction:', error);

            // Use a fallback extraction method or return empty results
            extractionResult = {
                topics: [],
                args: []
            };

            // Try to extract some basic topics using a simplified approach
            try {
                console.log('Using fallback topic extraction method');

                // Split content into paragraphs
                const paragraphs = text.split(/\n\s*\n/);

                // Look for capitalized phrases that might be topics
                const potentialTopics = new Set<string>();
                const regex = /\b[A-Z][a-z]+(?:\s+[A-Z]?[a-z]+){1,3}\b/g;

                paragraphs.forEach(paragraph => {
                    const matches = paragraph.match(regex);
                    if (matches) {
                        matches.forEach(match => potentialTopics.add(match));
                    }
                });

                // Convert to topics array
                if (potentialTopics.size > 0) {
                    extractionResult.topics = Array.from(potentialTopics).slice(0, 3).map(title => ({
                        title,
                        confidence: 0.7,
                        relatedTopics: []
                    }));

                    // Add a basic argument for each topic
                    extractionResult.args = extractionResult.topics.map(topic => ({
                        topicTitle: topic.title,
                        text: `Analysis of ${topic.title}`,
                        type: 'support',
                        confidence: 0.7
                    }));
                }
            } catch (fallbackError) {
                console.error('Fallback extraction also failed:', fallbackError);
                // Keep empty results
            }
        }

        // Process the result - transform to the format expected by the UI
        const displayTopics = extractionResult.topics.map(topic => {
            const topicArguments = extractionResult.args
                .filter(arg => arg.topicTitle === topic.title)
                .map(arg => ({
                    claim: arg.text || `Argument about ${topic.title}`,
                    evidence: `Analysis of the document reveals that ${arg.text || 'this topic'} is significant.`,
                    type: arg.type
                }));

            // Ensure we always have at least one argument
            const topicArgs = topicArguments.length > 0 ? topicArguments : [
                {
                    claim: `Key aspect of ${topic.title}`,
                    evidence: `The document discusses important aspects of ${topic.title}.`
                }
            ];

            // Return in the format expected by the UI
            return {
                title: topic.title,
                confidence: topic.confidence,
                arguments: topicArgs
            };
        });

        console.log(`Extracted ${displayTopics.length} topics for display`);
        console.log('Topics for display:', JSON.stringify(displayTopics, null, 2));
        return displayTopics;
    } catch (error) {
        console.error('Error extracting topics:', error);
        throw new Error(`Failed to extract topics: ${error.message}`);
    }
}

export class TopicExtractor {
    private options: TopicExtractorOptions;

    constructor(options: Partial<TopicExtractorOptions> = {}) {
        this.options = { ...DEFAULT_OPTIONS, ...options };
    }

    /**
     * Extract topics from a document
     */
    public async extractTopics(document: ParsedDocument): Promise<TopicExtractionResult> {
        try {
            console.log('Starting topic extraction process');
            const topics: Topic[] = [];
            const args: Argument[] = [];

            // Simple approach to find potential topics
            const sentences = this.splitIntoSentences(document.content);
            const keywords = this.extractPotentialTopics(document.content);

            console.log(`Found ${keywords.length} potential topics`);

            // Process each keyword as a potential topic
            for (const keyword of keywords) {
                // Check keyword length - too short keywords are often not useful
                if (keyword.length < 5) continue;

                // Create a topic with the keyword
                const topicTitle = this.formatTopicTitle(keyword);

                // Check if similar topic already exists
                if (topics.some(t => this.isSimilarTopic(t.title, topicTitle))) continue;

                // Calculate topic confidence based on frequency and relevance
                const confidence = this.calculateTopicConfidence(topicTitle, document.content);

                // Only add topics with sufficient confidence
                if (confidence >= this.options.minConfidence) {
                    // Add the topic
                    const topic: Topic = {
                        title: topicTitle,
                        confidence,
                        relatedTopics: []
                    };
                    topics.push(topic);

                    // Find relevant sentences for this topic
                    const relevantSentences = sentences.filter(sentence =>
                        this.isSentenceRelevantToTopic(sentence, topicTitle)
                    );

                    // Extract arguments from relevant sentences
                    for (const sentence of relevantSentences) {
                        // Check if sentence makes a claim
                        if (this.isClaim(sentence)) {
                            args.push({
                                topicTitle,
                                text: sentence,
                                type: 'support',
                                confidence: this.calculateArgumentConfidence(sentence, topicTitle)
                            });
                        }

                        // Extract counterpoints if enabled
                        if (this.options.extractCounterpoints && this.isCounterpoint(sentence)) {
                            args.push({
                                topicTitle,
                                text: sentence,
                                type: 'counter',
                                confidence: this.calculateArgumentConfidence(sentence, topicTitle)
                            });
                        }
                    }
                }

                // Limit number of topics
                if (topics.length >= this.options.maxTopics) break;
            }

            // Sort topics by confidence
            const sortedTopics = topics.sort((a, b) => b.confidence - a.confidence);

            // Sort arguments by confidence
            const sortedArgs = args.sort((a, b) => b.confidence - a.confidence);

            console.log(`Finished extraction with ${sortedTopics.length} topics and ${sortedArgs.length} arguments`);

            return {
                topics: sortedTopics,
                args: sortedArgs
            };
        } catch (error) {
            console.error('Error in topic extraction:', error);
            throw new Error(`Topic extraction failed: ${error.message}`);
        }
    }

    /**
     * Split text into sentences
     */
    private splitIntoSentences(text: string): string[] {
        return text.match(/[^.!?]+[.!?]+/g)?.map(s => s.trim()) || [];
    }

    /**
     * Extract potential topics from text
     */
    private extractPotentialTopics(text: string): string[] {
        // Simple approach: extract noun phrases and frequent terms
        const words = text.toLowerCase().match(/\b[a-z]{4,}(?:\s+[a-z]+)?\b/g) || [];

        // Count word frequencies
        const wordCounts = new Map<string, number>();
        for (const word of words) {
            wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
        }

        // Get words that appear multiple times and sort by frequency
        const frequentWords = [...wordCounts.entries()]
            .filter(([_, count]) => count > 1)
            .sort((a, b) => b[1] - a[1])
            .map(([word]) => word);

        // Extract multi-word phrases
        const phrases = this.extractPhrases(text);

        // Combine frequent words and phrases, prioritizing phrases
        return [...phrases, ...frequentWords.slice(0, 15)];
    }

    /**
     * Extract meaningful phrases from text
     */
    private extractPhrases(text: string): string[] {
        // Look for capitalized phrases that might indicate topics
        const potentialTopics = text.match(/\b[A-Z][a-z]+(?:\s+[A-Z]?[a-z]+){1,3}\b/g) || [];

        console.log(`Extracted ${potentialTopics.length} potential capitalized topics from text`);
        if (potentialTopics.length > 0) {
            console.log('Sample topics:', potentialTopics.slice(0, 5));
        }

        // Create distinct list of topics (case-insensitive)
        const uniqueTopics = [...new Set(potentialTopics.map(p => p.toLowerCase()))];

        return uniqueTopics;
    }

    /**
     * Format a keyword into a proper topic title
     */
    private formatTopicTitle(keyword: string): string {
        // Capitalize the first letter of each word
        return keyword
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    }

    /**
     * Check if a sentence is relevant to a topic
     */
    private isSentenceRelevantToTopic(sentence: string, topic: string): boolean {
        const similarity = compareTwoStrings(
            sentence.toLowerCase(),
            topic.toLowerCase()
        );
        return similarity > 0.2;
    }

    /**
     * Check if two topics are similar
     */
    private isSimilarTopic(topic1: string, topic2: string): boolean {
        const similarity = compareTwoStrings(
            topic1.toLowerCase(),
            topic2.toLowerCase()
        );
        return similarity > 0.7;
    }

    /**
     * Calculate topic confidence based on prominence in the document
     */
    private calculateTopicConfidence(topic: string, content: string): number {
        // Simple confidence calculation based on frequency and position
        const topicLower = topic.toLowerCase();
        const contentLower = content.toLowerCase();

        // Check how many times the topic appears
        const regex = new RegExp(`\\b${topicLower.replace(/\s+/g, '\\s+')}\\b`, 'g');
        const matches = contentLower.match(regex) || [];
        const frequency = matches.length;

        // Check if topic appears in the first paragraph (more important)
        const firstParagraph = contentLower.split('\n')[0] || '';
        const inFirstParagraph = firstParagraph.includes(topicLower);

        // Calculate confidence score
        let confidence = Math.min(0.5 + (frequency * 0.1), 0.95);
        if (inFirstParagraph) confidence += 0.1;

        return Math.min(confidence, 1.0);
    }

    /**
     * Calculate argument confidence
     */
    private calculateArgumentConfidence(sentence: string, topic: string): number {
        // Calculate based on relevance to topic
        const similarity = compareTwoStrings(
            sentence.toLowerCase(),
            topic.toLowerCase()
        );

        // Adjust based on sentence features
        let confidence = similarity * 0.7;

        // Boost confidence for sentences with claim indicators
        if (/\b(?:should|must|need|important|significant|crucial|essential|critical)\b/i.test(sentence)) {
            confidence += 0.15;
        }

        // Boost confidence for sentences with evidence indicators
        if (/\b(?:because|since|therefore|thus|consequently|as a result|research|study|evidence|data|statistics)\b/i.test(sentence)) {
            confidence += 0.1;
        }

        return Math.min(confidence, 0.98);
    }

    /**
     * Check if a sentence is likely to be a claim
     */
    private isClaim(sentence: string): boolean {
        // Look for claim indicators
        return /\b(?:should|must|need|important|significant|crucial|essential|critical|argue|assert|claim|maintain|contend)\b/i.test(sentence);
    }

    /**
     * Check if a sentence is likely to be a counterpoint
     */
    private isCounterpoint(sentence: string): boolean {
        // Look for counterpoint indicators
        return /\b(?:however|but|although|though|contrary|despite|yet|while|on the other hand|opponents|critics|challenge|dispute)\b/i.test(sentence);
    }
} 