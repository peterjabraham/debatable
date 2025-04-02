import nlp from 'compromise';
import * as use from '@tensorflow-models/universal-sentence-encoder';
import * as tf from '@tensorflow/tfjs';
import { compareTwoStrings } from 'string-similarity';
import {
    Topic,
    Argument,
    TopicExtractionResult,
    TopicExtractorOptions,
    ParsedDocument,
} from '@/types/content-processing';

// Force TF.js to use WebGL backend in browser environment
if (typeof window !== 'undefined') {
    tf.setBackend('webgl');
} else {
    // In Node.js environment (SSR), we'll use CPU
    tf.setBackend('cpu');
}

const DEFAULT_OPTIONS: TopicExtractorOptions = {
    minConfidence: 0.6,
    maxTopics: 5,
    extractCounterpoints: true,
    language: 'english',
};

// Simple word tokenizer function
function tokenizeWords(text: string): string[] {
    return text.toLowerCase().match(/\b\w+\b/g) || [];
}

// Simple TF-IDF implementation
class SimpleTfIdf {
    private documents: string[][] = [];

    addDocument(tokens: string[]) {
        this.documents.push(tokens);
    }

    tfidf(term: string, docIndex: number): number {
        const tf = this.tf(term, docIndex);
        const idf = this.idf(term);
        return tf * idf;
    }

    private tf(term: string, docIndex: number): number {
        const doc = this.documents[docIndex];
        const termCount = doc.filter(t => t === term).length;
        return termCount / doc.length;
    }

    private idf(term: string): number {
        const docsWithTerm = this.documents.filter(doc => doc.includes(term)).length;
        return Math.log(this.documents.length / (1 + docsWithTerm));
    }
}

export class TopicExtractor {
    private options: TopicExtractorOptions;
    private sentenceEncoder: any; // Universal Sentence Encoder model

    constructor(options: Partial<TopicExtractorOptions> = {}) {
        this.options = { ...DEFAULT_OPTIONS, ...options };
        this.initializeSentenceEncoder();
    }

    private async initializeSentenceEncoder() {
        try {
            this.sentenceEncoder = await use.load();
        } catch (error) {
            console.error('Failed to load Universal Sentence Encoder:', error);
        }
    }

    private splitIntoSentences(text: string): string[] {
        return text.match(/[^.!?]+[.!?]+/g)?.map(s => s.trim()) || [];
    }

    private extractKeywords(text: string): string[] {
        const tokens = tokenizeWords(text);
        const tfidf = new SimpleTfIdf();
        tfidf.addDocument(tokens);

        const scores = tokens.map(token => ({
            token,
            score: tfidf.tfidf(token, 0)
        }));

        return scores
            .sort((a, b) => b.score - a.score)
            .slice(0, 10)
            .map(item => item.token);
    }

    private findRelatedTopics(topicTitle: string, existingTopics: Topic[]): string[] {
        return existingTopics
            .filter(topic => {
                const similarity = compareTwoStrings(topicTitle.toLowerCase(), topic.title.toLowerCase());
                return similarity > 0.7;
            })
            .map(topic => topic.title);
    }

    private async findCounterpoints(sentences: string[], claim: string): Promise<string[]> {
        const counterpoints: string[] = [];
        const doc = nlp(sentences.join(' '));

        // Look for contrasting statements
        const contrastingStatements = doc
            .match('(however|but|although|though|contrary|despite|yet|while)')
            .out('array');

        for (const statement of contrastingStatements) {
            const similarity = compareTwoStrings(claim.toLowerCase(), statement.toLowerCase());
            if (similarity > 0.3 && similarity < 0.7) {
                counterpoints.push(statement);
            }
        }

        return counterpoints;
    }

    public async extractTopics(document: ParsedDocument): Promise<TopicExtractionResult> {
        const sections = document.sections || [{ title: '', content: document.content }];
        const topics: Topic[] = [];
        const topicArguments: Argument[] = [];

        for (const section of sections) {
            const sectionText = section.content;
            const sentences = this.splitIntoSentences(sectionText);

            // Extract keywords for potential topics
            const keywords = this.extractKeywords(sectionText);

            // Process each keyword as a potential topic
            for (const keyword of keywords) {
                // Check if similar topic already exists
                const relatedTopics = this.findRelatedTopics(keyword, topics);
                if (relatedTopics.length > 0) continue;

                // Create new topic
                const topic: Topic = {
                    title: keyword,
                    confidence: await this.calculateClaimConfidence(keyword, sentences),
                    relatedTopics: relatedTopics,
                };

                if (topic.confidence >= this.options.minConfidence) {
                    topics.push(topic);

                    // Find arguments for this topic
                    const relevantSentences = sentences.filter(s =>
                        this.isContentRelatedToTopic(s, topic)
                    );

                    if (this.options.extractCounterpoints) {
                        const counterpoints = await this.findCounterpoints(sentences, keyword);
                        for (const counterpoint of counterpoints) {
                            topicArguments.push({
                                topicTitle: topic.title,
                                text: counterpoint,
                                type: 'counter',
                                confidence: await this.calculateClaimConfidence(counterpoint, relevantSentences)
                            });
                        }
                    }

                    // Add supporting arguments
                    for (const sentence of relevantSentences) {
                        topicArguments.push({
                            topicTitle: topic.title,
                            text: sentence,
                            type: 'support',
                            confidence: await this.calculateClaimConfidence(sentence, relevantSentences)
                        });
                    }
                }

                // Limit number of topics
                if (topics.length >= this.options.maxTopics) break;
            }
        }

        return {
            topics: topics.sort((a, b) => b.confidence - a.confidence),
            arguments: topicArguments.sort((a, b) => b.confidence - a.confidence)
        };
    }

    private async calculateClaimConfidence(
        claim: string,
        evidence: string[]
    ): Promise<number> {
        if (!evidence.length) return 0;

        const similarities = evidence.map(e => compareTwoStrings(claim.toLowerCase(), e.toLowerCase()));
        return Math.max(...similarities);
    }

    private isContentRelatedToTopic(content: string, topic: Topic): boolean {
        const similarity = compareTwoStrings(content.toLowerCase(), topic.title.toLowerCase());
        return similarity > this.options.minConfidence;
    }
} 