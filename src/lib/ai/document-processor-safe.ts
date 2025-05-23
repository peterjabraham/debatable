/**
 * Safe Document Processor
 * This is a production-safe version of the document processor that doesn't
 * try to access test files or use libraries that cause build issues.
 */
import OpenAI from 'openai';

// Type for document retrieval results
interface RetrievalResult {
    text: string;
    score: number;
}

// Create a real OpenAI client
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// Production-safe document processor that uses real embeddings but avoids problematic dependencies
export class SafeDocumentProcessor {
    // Storage for documents (in memory for simplicity)
    private static storage: Record<string, Array<{ text: string; embedding: number[] }>> = {};

    /**
     * Process a document safely without external dependencies
     */
    static async processDocument(
        fileBuffer: Buffer,
        fileName: string,
        debateId: string
    ): Promise<{ success: boolean; chunkCount?: number; error?: string }> {
        try {
            console.log(`[SafeDocumentProcessor] Processing document: ${fileName} for debate: ${debateId}`);

            // Extract text from the buffer (in a real implementation, this would parse the document)
            const text = fileBuffer.toString('utf8');

            // Split text into chunks (simplified)
            const chunks = text.split(/(?<=\.)\s+/).filter(Boolean).slice(0, 20); // Limit chunks 

            // Process chunks - always use real embeddings
            const processedChunks = await Promise.all(
                chunks.map(async (chunk) => {
                    let embedding;

                    try {
                        // Get real embeddings from OpenAI
                        const embeddingResponse = await openai.embeddings.create({
                            model: "text-embedding-3-small",
                            input: chunk.trim(),
                        });

                        embedding = embeddingResponse.data[0].embedding;
                        console.log(`[SafeDocumentProcessor] Got real embedding for chunk with length ${chunk.length}`);
                    } catch (error) {
                        console.error('[SafeDocumentProcessor] Error getting embedding:', error);
                        // Throw or handle error appropriately, removed mock fallback
                        throw new Error('Failed to get embedding for document chunk');
                    }

                    return {
                        text: chunk.trim(),
                        embedding
                    };
                })
            );

            // Store chunks in memory
            this.storage[debateId] = processedChunks;

            console.log(`[SafeDocumentProcessor] Successfully processed ${processedChunks.length} chunks`);

            return {
                success: true,
                chunkCount: processedChunks.length
            };
        } catch (error) {
            console.error('[SafeDocumentProcessor] Error processing document:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    /**
     * Calculate cosine similarity between two vectors
     */
    private static cosineSimilarity(a: number[], b: number[]): number {
        if (a.length !== b.length) {
            throw new Error('Vectors must have the same length');
        }

        let dotProduct = 0;
        let aMagnitude = 0;
        let bMagnitude = 0;

        for (let i = 0; i < a.length; i++) {
            dotProduct += a[i] * b[i];
            aMagnitude += a[i] * a[i];
            bMagnitude += b[i] * b[i];
        }

        aMagnitude = Math.sqrt(aMagnitude);
        bMagnitude = Math.sqrt(bMagnitude);

        return dotProduct / (aMagnitude * bMagnitude);
    }

    /**
     * Retrieve relevant content safely
     */
    static async retrieveRelevantContent(
        query: string,
        debateId: string,
        topK: number = 5
    ): Promise<RetrievalResult[]> {
        try {
            console.log(`[SafeDocumentProcessor] Retrieving content for query: "${query}" in debate: ${debateId}`);

            // Check if we have documents for this debate
            const chunks = this.storage[debateId] || [];
            if (chunks.length === 0) {
                console.log(`[SafeDocumentProcessor] No documents found for debate: ${debateId}`);
                return [];
            }

            let queryEmbedding: number[];

            try {
                // Get real embedding for the query
                const embeddingResponse = await openai.embeddings.create({
                    model: "text-embedding-3-small",
                    input: query.trim(),
                });

                queryEmbedding = embeddingResponse.data[0].embedding;
                console.log(`[SafeDocumentProcessor] Got real embedding for query`);
            } catch (error) {
                console.error('[SafeDocumentProcessor] Error getting query embedding:', error);
                // Removed random scoring fallback
                return []; // Return empty if query embedding fails
            }

            // Calculate real similarity scores using embeddings
            const results = chunks.map(chunk => ({
                text: chunk.text,
                score: this.cosineSimilarity(queryEmbedding!, chunk.embedding)
            }));

            // Sort by score and return top K
            return results
                .sort((a, b) => b.score - a.score)
                .slice(0, topK);

        } catch (error) {
            console.error('[SafeDocumentProcessor] Error retrieving content:', error);
            return [];
        }
    }
}

// Export a singleton instance
export const documentProcessor = SafeDocumentProcessor; 