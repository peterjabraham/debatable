import { PineconeClient } from '@pinecone-database/pinecone';
import { OpenAIEmbeddings } from '@langchain/openai';
import { Document } from '@langchain/core/documents';
import * as pdfParse from 'pdf-parse';
import { v4 as uuidv4 } from 'uuid';

// Initialize Pinecone client
let pineconeClient: PineconeClient | null = null;
let pineconeIndex: any = null;
let embeddings: OpenAIEmbeddings | null = null;

// Initialize the Pinecone client
async function initPinecone() {
    if (!pineconeClient) {
        try {
            pineconeClient = new PineconeClient();
            await pineconeClient.init({
                apiKey: process.env.PINECONE_API_KEY || '',
                environment: process.env.PINECONE_ENVIRONMENT || '',
            });

            const indexName = process.env.PINECONE_INDEX || 'debate-documents';
            const indexList = await pineconeClient.listIndexes();

            if (!indexList.includes(indexName)) {
                console.warn(`Pinecone index ${indexName} does not exist. Please create it in the Pinecone console.`);
                return false;
            }

            pineconeIndex = pineconeClient.Index(indexName);

            // Initialize OpenAI embeddings with 1024 dimensions to match Pinecone
            embeddings = new OpenAIEmbeddings({
                openAIApiKey: process.env.OPENAI_API_KEY,
                dimensions: 1024, // Match Pinecone's available dimension option
            });

            return true;
        } catch (error) {
            console.error('Failed to initialize Pinecone:', error);
            return false;
        }
    }
    return true;
}

// Extract text from PDF buffer
async function extractTextFromPdf(pdfBuffer: Buffer): Promise<string> {
    try {
        const pdfData = await pdfParse(pdfBuffer);
        return pdfData.text;
    } catch (error) {
        console.error('Error extracting text from PDF:', error);
        throw new Error('Failed to extract text from PDF');
    }
}

// Custom text splitter function to replace LangChain's RecursiveCharacterTextSplitter
async function splitTextIntoChunks(text: string): Promise<Document[]> {
    // Split by paragraphs first
    const paragraphs = text.split(/\n\s*\n/);

    const chunks: Document[] = [];
    const chunkSize = 1000;
    const chunkOverlap = 200;

    for (const paragraph of paragraphs) {
        // If paragraph is smaller than chunk size, add it as is
        if (paragraph.length < chunkSize) {
            chunks.push(new Document({ pageContent: paragraph }));
            continue;
        }

        // Otherwise, split into overlapping chunks
        let startIndex = 0;
        while (startIndex < paragraph.length) {
            const endIndex = Math.min(startIndex + chunkSize, paragraph.length);
            const chunk = paragraph.substring(startIndex, endIndex);
            chunks.push(new Document({ pageContent: chunk }));

            // Move start index, accounting for overlap
            startIndex = endIndex - chunkOverlap;

            // If we're near the end, break to avoid tiny chunks
            if (startIndex + chunkSize >= paragraph.length) {
                break;
            }
        }
    }

    return chunks;
}

// Store document chunks in Pinecone
export async function processDocument(
    fileBuffer: Buffer,
    fileName: string,
    debateId: string
): Promise<{ success: boolean; chunkCount?: number; error?: string }> {
    try {
        // Initialize Pinecone
        const initialized = await initPinecone();
        if (!initialized || !pineconeIndex || !embeddings) {
            return {
                success: false,
                error: 'Vector database not initialized. Check your environment variables.'
            };
        }

        // Extract text from PDF
        const text = await extractTextFromPdf(fileBuffer);

        // Split text into chunks
        const chunks = await splitTextIntoChunks(text);

        // Create vectors with metadata
        const vectors = await Promise.all(
            chunks.map(async (chunk, i) => {
                const embedding = await embeddings!.embedQuery(chunk.pageContent);

                return {
                    id: `${debateId}_chunk_${i}`,
                    values: embedding,
                    metadata: {
                        debateId,
                        fileName,
                        text: chunk.pageContent,
                        chunkIndex: i,
                    },
                };
            })
        );

        // Upsert vectors to Pinecone
        await pineconeIndex.upsert({
            upsertRequest: {
                vectors,
                namespace: debateId,
            },
        });

        return {
            success: true,
            chunkCount: chunks.length,
        };
    } catch (error) {
        console.error('Error processing document:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error processing document',
        };
    }
}

// Retrieve relevant content from Pinecone
export async function retrieveRelevantContent(
    query: string,
    debateId: string,
    topK: number = 5
): Promise<{ text: string; score: number }[]> {
    try {
        // Initialize Pinecone
        const initialized = await initPinecone();
        if (!initialized || !pineconeIndex || !embeddings) {
            console.error('Vector database not initialized');
            return [];
        }

        // Generate embedding for the query
        const queryEmbedding = await embeddings.embedQuery(query);

        // Query Pinecone
        const queryResponse = await pineconeIndex.query({
            queryRequest: {
                vector: queryEmbedding,
                topK,
                includeMetadata: true,
                namespace: debateId,
            },
        });

        // Extract and return relevant content
        return queryResponse.matches.map((match: any) => ({
            text: match.metadata.text,
            score: match.score,
        }));
    } catch (error) {
        console.error('Error retrieving content:', error);
        return [];
    }
}

// Mock implementation for development when Pinecone is not available
export class MockDocumentProcessor {
    private static storage: Record<string, any[]> = {};

    static async processDocument(
        fileBuffer: Buffer,
        fileName: string,
        debateId: string
    ): Promise<{ success: boolean; chunkCount?: number; error?: string }> {
        try {
            // Extract text from PDF
            const text = await extractTextFromPdf(fileBuffer);

            // Split text into chunks (simplified for mock)
            const chunks = text.split('\n\n').filter(chunk => chunk.trim().length > 0);

            // Store chunks with metadata
            MockDocumentProcessor.storage[debateId] = chunks.map((chunk, i) => ({
                id: `${debateId}_chunk_${i}`,
                text: chunk,
                metadata: {
                    debateId,
                    fileName,
                    chunkIndex: i,
                },
            }));

            return {
                success: true,
                chunkCount: chunks.length,
            };
        } catch (error) {
            console.error('Error in mock document processing:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error in mock processing',
            };
        }
    }

    static async retrieveRelevantContent(
        query: string,
        debateId: string,
        topK: number = 5
    ): Promise<{ text: string; score: number }[]> {
        // Simple keyword matching for mock implementation
        const chunks = MockDocumentProcessor.storage[debateId] || [];
        const queryWords = query.toLowerCase().split(/\s+/);

        // Score chunks based on word overlap
        const scoredChunks = chunks.map(chunk => {
            const text = chunk.text.toLowerCase();
            const wordMatches = queryWords.filter(word => text.includes(word)).length;
            const score = wordMatches / queryWords.length;

            return {
                text: chunk.text,
                score: score,
            };
        });

        // Sort by score and return top K
        return scoredChunks
            .sort((a, b) => b.score - a.score)
            .slice(0, topK)
            .filter(chunk => chunk.score > 0);
    }
}

// Export the appropriate implementation based on environment
// In production, always use the real implementation regardless of USE_MOCK_DATA
// In development, respect the USE_MOCK_DATA flag
export const documentProcessor =
    // Always use real implementation in production or if NEXT_PUBLIC_USE_REAL_API is true
    (process.env.NODE_ENV === 'production' || process.env.NEXT_PUBLIC_USE_REAL_API === 'true')
        ? { processDocument, retrieveRelevantContent }
        // Only use mock if explicitly requested in development
        : (process.env.USE_MOCK_DATA === 'true' ? MockDocumentProcessor : { processDocument, retrieveRelevantContent }); 