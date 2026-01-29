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
// Enhancement 4.A & 4.B: Import enhanced media interfaces
import { EnhancedYouTubeExtraction, TranscriptSegment } from './youtube-processor';
import { EnhancedPodcastExtraction, PodcastSegment } from './podcast-processor';

const DEFAULT_OPTIONS: TopicExtractorOptions = {
    minConfidence: 0.6,
    maxTopics: 5,
    extractCounterpoints: true,
    language: 'english',
};

/**
 * Enhanced topic extraction with OpenAI and content-type specific prompts
 * Enhancement 4.A: Now supports contextual content with video titles
 */
export async function extractTopicsFromText(
    text: string,
    sourceType: 'pdf' | 'youtube' | 'podcast' | 'general' = 'general',
    contextualContent?: string
): Promise<DebateTopic[]> {
    try {
        console.log(`[Topic Extractor] Extracting topics from ${sourceType} content`);

        // Check for empty text
        if (!text || text.trim() === '') {
            console.warn('[Topic Extractor] Empty text provided');
            return [];
        }

        // Enhancement 4.A: Use contextual content (with video title) if available
        const contentToAnalyze = contextualContent || text;

        // Use OpenAI for better topic extraction
        const topics = await generateTopicsWithOpenAI(contentToAnalyze, sourceType);

        if (topics && topics.length > 0) {
            console.log(`[Topic Extractor] Successfully extracted ${topics.length} topics using OpenAI`);
            // Validate all topics have proper titles and summaries
            const validatedTopics = topics.map(topic => ({
                title: topic.title || 'Untitled Topic',
                summary: topic.summary || 'Analysis of the content and its key discussion points.',
                confidence: topic.confidence || 0.7
            }));
            return validatedTopics;
        }

        // If OpenAI fails but we have meaningful content, try local extraction
        console.log('[Topic Extractor] OpenAI extraction failed, attempting local extraction');
        const localTopics = await extractTopicsLocalFallback(text);

        if (localTopics && localTopics.length > 0) {
            console.log(`[Topic Extractor] Successfully extracted ${localTopics.length} topics using local method`);
            // Validate all topics have proper titles and summaries
            const validatedTopics = localTopics.map(topic => ({
                title: topic.title || 'Untitled Topic',
                summary: topic.summary || 'Analysis of the content and its key discussion points.',
                confidence: topic.confidence || 0.5
            }));
            return validatedTopics;
        }

        // If all extraction methods fail, this suggests the content is not suitable for topic extraction
        console.warn('[Topic Extractor] Both OpenAI and local extraction failed - content may not contain debatable topics');
        throw new Error('Unable to extract meaningful debate topics from this content. The text may be too short, technical, or not suitable for debate generation.');

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
 * Enhancement 4.A & 4.B: Extract topics from enhanced YouTube data with timestamps
 */
export async function extractTopicsFromEnhancedYouTube(
    enhancedData: EnhancedYouTubeExtraction
): Promise<DebateTopic[]> {
    try {
        console.log(`[Topic Extractor] Extracting topics from enhanced YouTube data: "${enhancedData.title}"`);

        // Enhancement 4.A: Use contextual content with video title
        const topics = await generateTopicsWithOpenAI(enhancedData.contextualContent, 'youtube');

        if (topics && topics.length > 0) {
            // Enhancement 4.B: Add timestamp information to topics for citation
            const enhancedTopics = topics.map(topic => ({
                ...topic,
                // Add metadata for citation purposes
                sourceTitle: enhancedData.title,
                sourceType: 'youtube' as const,
                sourceId: enhancedData.videoId,
                // Store segmented transcript for later citation lookup
                segmentedTranscript: enhancedData.segmentedTranscript
            }));

            console.log(`[Topic Extractor] Successfully extracted ${enhancedTopics.length} topics with timestamp metadata`);
            return enhancedTopics;
        }

        // Fallback to regular extraction if enhanced fails
        return await extractTopicsFromText(enhancedData.transcript, 'youtube', enhancedData.contextualContent);

    } catch (error) {
        console.error('[Topic Extractor] Error extracting topics from enhanced YouTube data:', error);
        // Final fallback to basic text extraction
        return await extractTopicsFromText(enhancedData.transcript, 'youtube');
    }
}

/**
 * Enhancement 4.A & 4.B: Extract topics from enhanced podcast data with metadata
 */
export async function extractTopicsFromEnhancedPodcast(
    enhancedData: EnhancedPodcastExtraction
): Promise<DebateTopic[]> {
    try {
        console.log(`[Topic Extractor] Extracting topics from enhanced podcast data: "${enhancedData.episodeTitle}"`);

        // Enhancement 4.A: Use contextual content with podcast and episode titles
        const topics = await generateTopicsWithOpenAI(enhancedData.contextualContent, 'podcast');

        if (topics && topics.length > 0) {
            // Enhancement 4.B: Add podcast metadata for citation
            const enhancedTopics = topics.map(topic => ({
                ...topic,
                // Add metadata for citation purposes
                sourceTitle: enhancedData.episodeTitle,
                podcastTitle: enhancedData.podcastTitle,
                sourceType: 'podcast' as const,
                sourceUrl: enhancedData.audioUrl,
                episodeIndex: enhancedData.episodeIndex,
                // Store segmented transcript for later citation lookup
                segmentedTranscript: enhancedData.segmentedTranscript
            }));

            console.log(`[Topic Extractor] Successfully extracted ${enhancedTopics.length} topics with podcast metadata`);
            return enhancedTopics;
        }

        // Fallback to regular extraction if enhanced fails
        return await extractTopicsFromText(enhancedData.transcript, 'podcast', enhancedData.contextualContent);

    } catch (error) {
        console.error('[Topic Extractor] Error extracting topics from enhanced podcast data:', error);
        // Final fallback to basic text extraction
        return await extractTopicsFromText(enhancedData.transcript, 'podcast');
    }
}

/**
 * Enhancement 4.B: Find timestamp citations for specific topic content
 */
export function findTimestampCitations(
    topic: DebateTopic & { segmentedTranscript?: TranscriptSegment[] },
    searchText: string
): { timestamp: string; text: string; url: string }[] {
    if (!topic.segmentedTranscript || !topic.sourceId) {
        return [];
    }

    const citations: { timestamp: string; text: string; url: string }[] = [];

    for (const segment of topic.segmentedTranscript) {
        if (segment.text.toLowerCase().includes(searchText.toLowerCase())) {
            const formattedTime = formatTimestamp(segment.timestamp);
            const youtubeUrl = `https://www.youtube.com/watch?v=${topic.sourceId}&t=${Math.floor(segment.timestamp)}s`;

            citations.push({
                timestamp: formattedTime,
                text: segment.text,
                url: youtubeUrl
            });
        }
    }

    return citations;
}

/**
 * Enhancement 4.B: Helper to format timestamps
 */
function formatTimestamp(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    } else {
        return `${minutes}:${secs.toString().padStart(2, '0')}`;
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

Please identify AT LEAST 3 specific, debatable topics from the following content. For each topic:

1. Create a clear, engaging title (10-60 characters)
2. Write a neutral summary that explains what the debate would be about (50-150 words)
3. Ensure the topic has multiple valid perspectives that could lead to substantive discussion
4. Include enough context so the topic can be cited back to the source material

Important guidelines:
- Extract topics from the ACTUAL content provided, not generic assumptions
- Focus on specific claims, arguments, or controversial points made in the text
- Avoid overly general topics - be specific to what's discussed
- If the content is very brief, extract the most debatable elements present
- Topics should be suitable for structured debate between multiple perspectives
- ALWAYS generate at least 3 topics, even if they need to be broader for short content
- Each topic title must be unique and descriptive

Format your response as a JSON array of objects with this structure:
[
  {
    "title": "Clear, Engaging Topic Title",
    "summary": "Neutral explanation of what this debate topic covers and why it's worth discussing, with enough detail for citation.",
    "confidence": 0.8
  }
]

Content to analyze:
---
${text.substring(0, 12000)}
---

Return ONLY the JSON array, no additional text. ENSURE you generate at least 3 topics.`;

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

    // If no topics were extracted, create content-based topics
    if (!extractionResult.topics || extractionResult.topics.length === 0) {
        console.log('[Topic Extractor] No topics extracted, creating content-based topics');

        // Try to extract some key terms to create meaningful topics
        const words = text.toLowerCase().match(/\b[a-z]{4,}\b/g) || [];
        const keyTerms = [...new Set(words)]
            .filter(word => !['this', 'that', 'with', 'from', 'they', 'them', 'were', 'been', 'have', 'said', 'what', 'when', 'where', 'will'].includes(word))
            .slice(0, 5);

        if (keyTerms.length >= 2) {
            return [
                {
                    title: `${keyTerms[0].charAt(0).toUpperCase() + keyTerms[0].slice(1)} Analysis`,
                    summary: `Examination of ${keyTerms[0]} and its implications as discussed in the source material. This topic explores different perspectives on the matter.`,
                    confidence: 0.6
                },
                {
                    title: `${keyTerms[1].charAt(0).toUpperCase() + keyTerms[1].slice(1)} Debate`,
                    summary: `Discussion of ${keyTerms[1]} and related concepts presented in the content. Multiple viewpoints can be considered for this topic.`,
                    confidence: 0.6
                },
                {
                    title: 'Content Key Issues',
                    summary: 'Analysis of the main themes and controversial aspects presented in the source material, focusing on debatable elements.',
                    confidence: 0.5
                }
            ];
        }

        // Fallback to generic topics
        return [
            {
                title: 'Primary Content Analysis',
                summary: 'Analysis of the main arguments and perspectives presented in the source material.',
                confidence: 0.5
            },
            {
                title: 'Content Implications',
                summary: 'Discussion of the broader implications and consequences of the ideas presented in the source.',
                confidence: 0.5
            },
            {
                title: 'Alternative Perspectives',
                summary: 'Exploration of different viewpoints and interpretations of the content provided.',
                confidence: 0.5
            }
        ];
    }

    // Convert to DebateTopic format
    const debateTopics: DebateTopic[] = extractionResult.topics.map(topic => {
        // Ensure topic has a valid title
        const topicTitle = topic.title || 'Untitled Topic';

        const topicArguments = extractionResult.args
            .filter(arg => arg.topicTitle === topicTitle)
            .slice(0, 2); // Limit to 2 main arguments

        let summary = '';
        if (topicArguments.length > 0) {
            summary = `This topic explores ${topicArguments[0].text}`;
            if (topicArguments.length > 1) {
                summary += ` It also considers ${topicArguments[1].text}`;
            }
        } else {
            summary = `Analysis of ${topicTitle} and its implications.`;
        }

        return {
            title: topicTitle,
            summary: summary.substring(0, 200), // Limit summary length
            confidence: topic.confidence || 0.5
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
        // Handle undefined or empty keywords
        if (!keyword || typeof keyword !== 'string') {
            return 'Untitled Topic';
        }

        // Trim and clean the keyword
        const cleanKeyword = keyword.trim();
        if (cleanKeyword.length === 0) {
            return 'Untitled Topic';
        }

        // Capitalize the first letter of each word
        return cleanKeyword
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