import {
    ParsedDocument,
    TopicExtractionResult,
    TopicExtractorOptions,
    Topic,
    Argument
} from '@/types/content-processing';
import { DebateTopic } from '@/types/content';
import { compareTwoStrings } from 'string-similarity';
import openai from '@/lib/ai/openai-client';

const DEFAULT_OPTIONS: TopicExtractorOptions = {
    minConfidence: 0.6,
    maxTopics: 5,
    extractCounterpoints: true,
    language: 'english',
};

/**
 * Enhanced topic extraction with OpenAI and content-type specific prompts
 */
export async function extractTopicsFromText(
    text: string,
    sourceType: 'pdf' | 'youtube' | 'podcast' | 'general' = 'general'
): Promise<DebateTopic[]> {
    try {
        console.log(`[Topic Extractor] Extracting topics from ${sourceType} content`);

        // Check for empty text
        if (!text || text.trim() === '') {
            console.warn('[Topic Extractor] Empty text provided');
            return [];
        }

        // Use OpenAI for better topic extraction
        const topics = await generateTopicsWithOpenAI(text, sourceType);

        if (topics && topics.length > 0) {
            console.log(`[Topic Extractor] Successfully extracted ${topics.length} topics using OpenAI`);
            return topics;
        }

        // Fallback to original method if OpenAI fails
        console.log('[Topic Extractor] OpenAI extraction failed, falling back to local extraction');
        return await extractTopicsLocalFallback(text);

    } catch (error) {
        console.error('[Topic Extractor] Error extracting topics:', error);

        // Try fallback method
        try {
            return await extractTopicsLocalFallback(text);
        } catch (fallbackError) {
            console.error('[Topic Extractor] Fallback extraction also failed:', fallbackError);
            throw new Error(`Failed to extract topics: ${error.message}`);
        }
    }
}

/**
 * Generate topics using OpenAI with content-type specific prompts
 */
async function generateTopicsWithOpenAI(
    text: string,
    sourceType: 'pdf' | 'youtube' | 'podcast' | 'general'
): Promise<DebateTopic[]> {

    const contentTypePrompts = {
        pdf: `
Analyze this academic/professional document and identify the most debatable topics it covers.
Focus on:
- Key research questions or hypotheses
- Policy recommendations or implications
- Controversial findings or interpretations
- Competing theories or approaches discussed
- Ethical or societal implications
`,
        youtube: `
Analyze this YouTube video transcript and identify the most debatable topics discussed.
Focus on:
- Main arguments or claims made by the speaker(s)
- Controversial opinions or hot takes
- Different perspectives presented
- Topics that sparked discussion in comments (implied)
- Practical vs theoretical approaches discussed
`,
        podcast: `
Analyze this podcast transcript and identify the most debatable topics discussed.
Focus on:
- Key points of disagreement between hosts/guests
- Controversial topics or opinions shared
- Industry debates or trending discussions
- Personal experiences that raise broader questions
- Topics that invite listener engagement
`,
        general: `
Analyze this text and identify the most debatable topics it covers.
Focus on topics that have multiple valid perspectives and would generate meaningful discussion.
`
    };

    const prompt = `${contentTypePrompts[sourceType]}

Please identify 3-5 specific, debatable topics from the following content. For each topic:

1. Create a clear, engaging title (10-60 characters)
2. Write a neutral summary that explains what the debate would be about (50-150 words)
3. Ensure the topic has multiple valid perspectives that could lead to substantive discussion

Format your response as a JSON array of objects with this structure:
[
  {
    "title": "Clear, Engaging Topic Title",
    "summary": "Neutral explanation of what this debate topic covers and why it's worth discussing.",
    "confidence": 0.8
  }
]

Content to analyze:
---
${text.substring(0, 12000)}
---

Return ONLY the JSON array, no additional text.`;

    try {
        const response = await openai.chat.completions.create({
            model: 'gpt-3.5-turbo',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.7,
            max_tokens: 1500
        });

        const content = response.choices[0]?.message?.content;
        if (!content) {
            throw new Error('No content returned from OpenAI');
        }

        // Parse the JSON response
        const topics = JSON.parse(content);

        // Validate the structure
        if (!Array.isArray(topics)) {
            throw new Error('Response is not an array');
        }

        return topics.map((topic: any) => ({
            title: topic.title || 'Untitled Topic',
            summary: topic.summary || 'No summary available',
            confidence: topic.confidence || 0.7
        }));

    } catch (error: any) {
        console.error('[Topic Extractor] OpenAI API error:', error);

        // Try to parse partial response if it's a JSON parsing error
        if (error.message.includes('JSON')) {
            try {
                const content = error.response?.data?.choices?.[0]?.message?.content;
                if (content) {
                    // Try to extract JSON from the content
                    const jsonMatch = content.match(/\[[\s\S]*\]/);
                    if (jsonMatch) {
                        const topics = JSON.parse(jsonMatch[0]);
                        return topics.map((topic: any) => ({
                            title: topic.title || 'Untitled Topic',
                            summary: topic.summary || 'No summary available',
                            confidence: topic.confidence || 0.7
                        }));
                    }
                }
            } catch (parseError) {
                console.error('[Topic Extractor] Could not parse partial response');
            }
        }

        throw error;
    }
}

/**
 * Enhanced fallback topic extraction
 */
async function extractTopicsLocalFallback(text: string): Promise<DebateTopic[]> {
    console.log('[Topic Extractor] Using enhanced local fallback method');

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

    // Extract topics using the enhanced local method
    const extractionResult = await extractor.extractTopics(parsedDocument);

    // Convert to DebateTopic format
    const debateTopics: DebateTopic[] = extractionResult.topics.map(topic => {
        const topicArguments = extractionResult.args
            .filter(arg => arg.topicTitle === topic.title)
            .slice(0, 2); // Limit to 2 main arguments

        let summary = '';
        if (topicArguments.length > 0) {
            summary = `This topic explores ${topicArguments[0].text}`;
            if (topicArguments.length > 1) {
                summary += ` It also considers ${topicArguments[1].text}`;
            }
        } else {
            summary = `Analysis of ${topic.title} and its implications.`;
        }

        return {
            title: topic.title,
            summary: summary.substring(0, 200), // Limit summary length
            confidence: topic.confidence
        };
    });

    return debateTopics;
}

/**
 * Generate topics for a specific content type with better prompting
 */
export async function generateTopicsForContentType(
    text: string,
    sourceType: 'pdf' | 'youtube' | 'podcast',
    maxTopics: number = 5
): Promise<DebateTopic[]> {
    return extractTopicsFromText(text, sourceType);
}

/**
 * Validate topic structure and ensure quality
 */
export function validateTopicStructure(topics: DebateTopic[]): DebateTopic[] {
    return topics.filter(topic => {
        // Ensure topic has required fields
        if (!topic.title || !topic.summary) return false;

        // Ensure title is reasonable length
        if (topic.title.length < 5 || topic.title.length > 100) return false;

        // Ensure summary is reasonable length
        if (topic.summary.length < 20 || topic.summary.length > 300) return false;

        // Ensure confidence is within valid range
        if (topic.confidence && (topic.confidence < 0 || topic.confidence > 1)) return false;

        return true;
    });
}

/**
 * Generate fallback topics when extraction fails completely
 */
export function generateFallbackTopics(
    sourceName: string,
    sourceType: 'pdf' | 'youtube' | 'podcast' | 'general' = 'general'
): DebateTopic[] {
    const baseTitle = sourceName
        .split(/[_\-\s\.]+/)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ')
        .replace(/\.(pdf|docx|txt)$/i, '');

    const contentTypeTemplates = {
        pdf: [
            {
                title: `${baseTitle}: Research Implications`,
                summary: `Examining the research findings and methodological approaches presented in this document, and their broader implications for the field.`,
                confidence: 0.6
            },
            {
                title: `${baseTitle}: Policy and Practice`,
                summary: `Discussing how the insights from this document should influence policy decisions and practical applications.`,
                confidence: 0.5
            }
        ],
        youtube: [
            {
                title: `${baseTitle}: Content Analysis`,
                summary: `Analyzing the main arguments and perspectives presented in this video and their validity in current discourse.`,
                confidence: 0.6
            },
            {
                title: `${baseTitle}: Impact and Reception`,
                summary: `Evaluating the potential impact of this content and how different audiences might interpret its message.`,
                confidence: 0.5
            }
        ],
        podcast: [
            {
                title: `${baseTitle}: Discussion Points`,
                summary: `Examining the key topics and debates raised in this podcast episode and their broader significance.`,
                confidence: 0.6
            },
            {
                title: `${baseTitle}: Expert Perspectives`,
                summary: `Analyzing the expert opinions and insights shared in this episode and their implications for the field.`,
                confidence: 0.5
            }
        ],
        general: [
            {
                title: `${baseTitle}: Key Issues`,
                summary: `Exploring the main themes and controversial aspects presented in this content.`,
                confidence: 0.5
            }
        ]
    };

    return contentTypeTemplates[sourceType] || contentTypeTemplates.general;
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