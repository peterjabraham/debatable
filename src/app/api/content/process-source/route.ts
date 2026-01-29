import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { createDocument, updateDocument, USER_CONTENT, CONTENT_JOBS } from '@/lib/db/firestore';
import { ProcessedContent, ContentProcessingResponse, ContentProcessingError, DebateTopic } from '@/types/content';
import { extractTextFromDocument } from '@/lib/content-processing/document-processor';
import { extractYouTubeText, extractYouTubeTextEnhanced } from '@/lib/content-processing/youtube-processor';
import { extractPodcastText, extractPodcastTextEnhanced } from '@/lib/content-processing/podcast-processor';
import {
    extractTopicsFromText,
    extractTopicsFromEnhancedYouTube,
    extractTopicsFromEnhancedPodcast,
    generateTopicsForContentType,
    validateTopicStructure,
    generateFallbackTopics
} from '@/lib/content-processing/topic-extractor';

// Configure CORS headers
function configureCors(response: NextResponse) {
    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return response;
}

// Handle OPTIONS requests for CORS
export async function OPTIONS(request: NextRequest) {
    return configureCors(new NextResponse(null, { status: 200 }));
}

// Enhanced authentication helper
async function getUserId(request: NextRequest): Promise<string> {
    try {
        const session = await getServerSession(authOptions);
        if (session?.user?.id) {
            console.log(`[Process Source] Using authenticated user: ${session.user.id}`);
            return session.user.id;
        }
    } catch (error) {
        console.warn('[Process Source] Failed to get session:', error);
    }

    // Fallback to temp user for development/testing
    const tempUserId = `temp-user-${Date.now()}`;
    console.log(`[Process Source] Using temporary user ID: ${tempUserId}`);
    return tempUserId;
}

function validateInput(sourceType: string, file: File | null, url: string | null): void {
    if (!sourceType) {
        throw new Error('Source type is required');
    }

    if (!['pdf', 'youtube', 'podcast'].includes(sourceType)) {
        throw new Error('Invalid source type. Must be pdf, youtube, or podcast');
    }

    if (sourceType === 'pdf') {
        if (!file) {
            throw new Error('File is required for PDF processing');
        }
        if (!file.name.toLowerCase().endsWith('.pdf')) {
            throw new Error('File must be a PDF');
        }
        if (file.size > 50 * 1024 * 1024) { // 50MB limit
            throw new Error('File size must be less than 50MB');
        }
    }

    if (['youtube', 'podcast'].includes(sourceType)) {
        if (!url) {
            throw new Error(`URL is required for ${sourceType} processing`);
        }

        try {
            new URL(url);
        } catch {
            throw new Error('Invalid URL format');
        }

        if (sourceType === 'youtube') {
            const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
            if (!youtubeRegex.test(url)) {
                throw new Error('Invalid YouTube URL format');
            }
        }
    }
}

async function updateProcessingStatus(
    contentId: string,
    status: ProcessedContent['status'],
    data?: Partial<ProcessedContent>
): Promise<void> {
    try {
        const updateData = {
            status,
            updatedAt: new Date().toISOString(),
            ...data
        };

        await updateDocument(USER_CONTENT, contentId, updateData);
        console.log(`[Process Source] Updated content ${contentId} status to: ${status}`);
    } catch (error) {
        console.error(`[Process Source] Failed to update status for ${contentId}:`, error);
        // Don't throw here to avoid breaking the main processing flow
    }
}

async function ensureUploadsDir(): Promise<string> {
    const uploadsDir = join(process.cwd(), 'uploads');
    try {
        if (!existsSync(uploadsDir)) {
            await mkdir(uploadsDir, { recursive: true });
            console.log('[Process Source] Created uploads directory');
        }
        return uploadsDir;
    } catch (error) {
        console.error('[Process Source] Failed to create uploads directory:', error);
        throw new Error('Failed to prepare file storage');
    }
}

async function safeWriteFile(path: string, data: Buffer): Promise<void> {
    try {
        await writeFile(path, data);
        console.log(`[Process Source] Successfully wrote file: ${path}`);
    } catch (error) {
        console.error(`[Process Source] Failed to write file ${path}:`, error);
        throw new Error('Failed to save uploaded file');
    }
}

export async function POST(request: NextRequest) {
    let contentId: string | null = null;

    try {
        console.log('[Process Source] Starting content processing request');

        // Get authenticated user ID
        const userId = await getUserId(request);

        // Parse form data
        const formData = await request.formData();
        const sourceType = formData.get('sourceType') as string;
        const file = formData.get('file') as File | null;
        const url = formData.get('url') as string | null;

        console.log(`[Process Source] Processing ${sourceType} content for user ${userId}`);

        // Validate input
        validateInput(sourceType, file, url);

        // Determine source name
        const sourceName = sourceType === 'pdf' && file
            ? file.name
            : sourceType === 'youtube' && url
                ? `YouTube: ${url.split('v=')[1]?.substring(0, 11) || 'video'}`
                : sourceType === 'podcast' && url
                    ? `Podcast: ${new URL(url).hostname}`
                    : 'Unknown Source';

        // Create initial processing record
        const initialContent: Omit<ProcessedContent, 'id'> = {
            userId,
            sourceType: sourceType as 'pdf' | 'youtube' | 'podcast',
            sourceName,
            sourceUrl: url || undefined,
            status: 'pending',
            debateTopics: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        const contentRecord = await createDocument(USER_CONTENT, initialContent);
        contentId = contentRecord.id;

        console.log(`[Process Source] Created content record: ${contentId}`);

        // Update status to extracting text
        await updateProcessingStatus(contentId, 'extracting_text');

        // Extract text based on source type
        let extractedText: string;
        let textStoragePath: string | undefined;
        // Enhancement 4.A & 4.B: Store enhanced media data for better topic extraction
        let enhancedYouTubeData: any = null;
        let enhancedPodcastData: any = null;

        try {
            switch (sourceType) {
                case 'pdf':
                    if (!file) throw new Error('PDF file is required');

                    // Save PDF file temporarily
                    const uploadsDir = await ensureUploadsDir();
                    const filePath = join(uploadsDir, `${contentId}_${file.name}`);
                    const buffer = Buffer.from(await file.arrayBuffer());
                    await safeWriteFile(filePath, buffer);

                    // Extract text from PDF
                    const pdfText = await extractTextFromDocument(filePath);
                    if (!pdfText) {
                        throw new Error('Failed to extract text from PDF - file may be corrupted, contain only images, or be a scanned document');
                    }

                    // Check if extracted text is meaningful enough for topic generation
                    const meaningfulText = pdfText.trim().replace(/[\s\n\r\t]/g, '');
                    if (meaningfulText.length < 100) {
                        console.warn(`[Process Source] PDF extracted very little text (${meaningfulText.length} characters). May contain mostly images.`);
                    }

                    extractedText = pdfText;
                    textStoragePath = filePath;
                    break;

                case 'youtube':
                    if (!url) throw new Error('YouTube URL is required');

                    // Enhancement 4.A & 4.B: Use enhanced YouTube processing
                    try {
                        enhancedYouTubeData = await extractYouTubeTextEnhanced(url);
                        extractedText = enhancedYouTubeData.transcript;
                        console.log(`[Process Source] Enhanced YouTube processing successful - Title: "${enhancedYouTubeData.title}"`);
                    } catch (enhancedError) {
                        console.warn('[Process Source] Enhanced YouTube processing failed, falling back to basic extraction:', enhancedError);
                        extractedText = await extractYouTubeText(url);
                    }
                    break;

                case 'podcast':
                    if (!url) throw new Error('Podcast URL is required');

                    // Enhancement 4.A & 4.B: Use enhanced podcast processing
                    try {
                        enhancedPodcastData = await extractPodcastTextEnhanced(url);
                        extractedText = enhancedPodcastData.transcript;
                        console.log(`[Process Source] Enhanced podcast processing successful - Episode: "${enhancedPodcastData.episodeTitle}"`);
                    } catch (enhancedError) {
                        console.warn('[Process Source] Enhanced podcast processing failed, falling back to basic extraction:', enhancedError);
                        extractedText = await extractPodcastText(url);
                    }
                    break;

                default:
                    throw new Error(`Unsupported source type: ${sourceType}`);
            }

            console.log(`[Process Source] Successfully extracted ${extractedText.length} characters of text`);

        } catch (extractionError: any) {
            console.error('[Process Source] Text extraction failed:', extractionError);
            await updateProcessingStatus(contentId, 'failed', {
                errorMessage: `Text extraction failed: ${extractionError.message}`
            });

            const errorResponse: ContentProcessingError = {
                error: 'Text extraction failed',
                details: extractionError.message,
                contentId
            };
            return configureCors(NextResponse.json(errorResponse, { status: 500 }));
        }

        // Update status to generating topics
        await updateProcessingStatus(contentId, 'generating_topics', {
            extractedText: extractedText.length > 50000 ? extractedText.substring(0, 50000) : extractedText,
            textStoragePath
        });

        // Generate debate topics using enhanced extractor
        let debateTopics: DebateTopic[];

        try {
            console.log(`[Process Source] Generating topics for ${sourceType} content`);
            console.log(`[Process Source] Extracted text preview: "${extractedText.substring(0, 200)}..."`);

            // Enhancement 4.A & 4.B: Use enhanced media topic extraction if available
            if (sourceType === 'youtube' && enhancedYouTubeData) {
                console.log(`[Process Source] Using enhanced YouTube topic extraction with video title context`);
                debateTopics = await extractTopicsFromEnhancedYouTube(enhancedYouTubeData);
            } else if (sourceType === 'podcast' && enhancedPodcastData) {
                console.log(`[Process Source] Using enhanced podcast topic extraction with episode metadata`);
                debateTopics = await extractTopicsFromEnhancedPodcast(enhancedPodcastData);
            } else {
                // Use content-type specific topic generation for other sources
                debateTopics = await generateTopicsForContentType(
                    extractedText,
                    sourceType as 'pdf' | 'youtube' | 'podcast',
                    5
                );
            }

            console.log(`[Process Source] Initial topics generated:`, debateTopics.map(t => ({ title: t.title, summary: t.summary?.substring(0, 50) + '...', confidence: t.confidence })));

            // Validate and filter topics
            debateTopics = validateTopicStructure(debateTopics);

            console.log(`[Process Source] After validation:`, debateTopics.map(t => ({ title: t.title, summary: t.summary?.substring(0, 50) + '...', confidence: t.confidence })));

            // Additional safety check - ensure all topics have valid titles and summaries
            debateTopics = debateTopics.map(topic => ({
                title: topic.title || 'Untitled Topic',
                summary: topic.summary || 'Analysis of the content and its key discussion points.',
                confidence: topic.confidence || 0.5
            }));

            // If no valid topics generated, this suggests the content is not suitable
            if (debateTopics.length === 0) {
                console.warn('[Process Source] No valid topics generated from content');
                throw new Error('Unable to generate debate topics from this content. The text may not contain suitable material for debate generation.');
            }

            console.log(`[Process Source] Final topics ready:`, debateTopics.map(t => ({ title: t.title, summary: t.summary?.substring(0, 50) + '...', confidence: t.confidence })));

        } catch (topicError: any) {
            console.error('[Process Source] Topic generation failed:', topicError);

            // Fail gracefully with an informative error
            await updateProcessingStatus(contentId, 'failed', {
                errorMessage: `Topic generation failed: ${topicError.message}`
            });

            const errorResponse: ContentProcessingError = {
                error: 'Topic generation failed',
                details: topicError.message,
                contentId
            };
            return configureCors(NextResponse.json(errorResponse, { status: 500 }));
        }

        // Update final status
        await updateProcessingStatus(contentId, 'completed', {
            debateTopics,
            extractedText: extractedText.length > 50000 ? undefined : extractedText // Store in field if small enough
        });

        console.log(`[Process Source] Successfully completed processing for content: ${contentId}`);

        // Prepare response
        const response: ContentProcessingResponse = {
            message: 'Content processed successfully',
            contentId,
            sourceName,
            debateTopics,
            status: 'completed'
        };

        return configureCors(NextResponse.json(response, { status: 200 }));

    } catch (error: any) {
        console.error('[Process Source] Processing failed:', error);

        // Update status if we have a content ID
        if (contentId) {
            await updateProcessingStatus(contentId, 'failed', {
                errorMessage: error.message
            });
        }

        const errorResponse: ContentProcessingError = {
            error: 'Content processing failed',
            details: error.message,
            contentId: contentId || undefined
        };

        return configureCors(NextResponse.json(errorResponse, { status: 500 }));
    }
} 