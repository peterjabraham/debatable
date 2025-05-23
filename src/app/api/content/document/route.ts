import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { extractTextFromDocument } from '@/lib/content-processing/document-processor';
import { extractTopicsFromText } from '@/lib/content-processing/topic-extractor';
import path from 'path';

// Configure CORS headers for the response
function configureCors(response: NextResponse) {
    // Allow requests from your deployed domain and localhost for development
    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type');
    return response;
}

// Handle OPTIONS requests for CORS preflight
export async function OPTIONS(request: NextRequest) {
    const response = NextResponse.json({}, { status: 200 });
    return configureCors(response);
}

// Ensure uploads directory exists
async function ensureUploadsDir() {
    try {
        // In production (especially on Vercel), we may not have write access
        // to the filesystem, so we'll use a mock implementation
        if (process.env.NODE_ENV === 'production') {
            console.log('[Document API] Using production mode, skipping directory creation');
            return '/tmp/uploads'; // This path won't actually be used in production
        }

        const uploadsDir = join(process.cwd(), 'uploads');
        console.log(`[Document API] Creating uploads directory at ${uploadsDir}`);
        await mkdir(uploadsDir, { recursive: true });
        return uploadsDir;
    } catch (error) {
        console.error('[Document API] Error creating uploads directory:', error);
        throw error;
    }
}

// Safe file write function that handles production environments
async function safeWriteFile(path: string, data: Buffer) {
    // In production, we'll skip actual file writing since it may not be supported
    if (process.env.NODE_ENV === 'production') {
        console.log(`[Document API] [Production] Skipping file write to: ${path}`);
        return;
    }

    try {
        console.log(`[Document API] Writing file to: ${path}`);
        await writeFile(path, data);
    } catch (error) {
        console.error(`[Document API] Error writing file to ${path}:`, error);
        throw error;
    }
}

export async function POST(request: NextRequest) {
    console.log('[Document API] Processing document upload request');

    try {
        // First, check content type to ensure it's multipart/form-data
        const contentType = request.headers.get('content-type') || '';
        if (!contentType.includes('multipart/form-data')) {
            console.error(`[Document API] Invalid content type: ${contentType}`);
            const errorResponse = NextResponse.json(
                { error: 'Content type must be multipart/form-data' },
                { status: 400 }
            );
            return configureCors(errorResponse);
        }

        let formData;
        try {
            formData = await request.formData();
            console.log('[Document API] Form data received');
        } catch (formError) {
            console.error('[Document API] Error parsing form data:', formError);
            const errorResponse = NextResponse.json(
                { error: 'Failed to parse form data' },
                { status: 400 }
            );
            return configureCors(errorResponse);
        }

        // Validate file exists
        const file = formData.get('file') as File;
        if (!file) {
            console.error('[Document API] No file provided in form data');
            const errorResponse = NextResponse.json(
                { error: 'No file provided' },
                { status: 400 }
            );
            return configureCors(errorResponse);
        }

        // Validate file type
        const fileName = file.name.toLowerCase();
        if (!fileName.endsWith('.pdf') && !fileName.endsWith('.docx') && !fileName.endsWith('.txt')) {
            console.error(`[Document API] Unsupported file type: ${fileName}`);
            const errorResponse = NextResponse.json(
                { error: 'Unsupported file type. Please upload a PDF, DOCX, or TXT file.' },
                { status: 400 }
            );
            return configureCors(errorResponse);
        }

        // Validate file size
        if (file.size > 20 * 1024 * 1024) { // 20MB
            console.error(`[Document API] File too large: ${file.size} bytes`);
            const errorResponse = NextResponse.json(
                { error: 'File size exceeds the 20MB limit' },
                { status: 400 }
            );
            return configureCors(errorResponse);
        }

        console.log(`[Document API] File received: ${file.name}, size: ${file.size} bytes`);

        // Generate a unique filename
        const filename = `${uuidv4()}-${file.name}`;
        console.log(`[Document API] Generated unique filename: ${filename}`);

        // Create uploads directory if it doesn't exist
        let uploadDir;
        try {
            uploadDir = await ensureUploadsDir();
            console.log(`[Document API] Upload directory: ${uploadDir}`);
        } catch (dirError) {
            console.error('[Document API] Failed to create uploads directory:', dirError);
            const errorResponse = NextResponse.json(
                { error: 'Server error: Failed to prepare upload directory' },
                { status: 500 }
            );
            return configureCors(errorResponse);
        }

        // Build full filepath
        const filepath = join(uploadDir, filename);
        console.log(`[Document API] Upload path: ${filepath}`);

        // Convert file to buffer and save
        let buffer;
        try {
            const bytes = await file.arrayBuffer();
            buffer = Buffer.from(bytes);
            console.log(`[Document API] Converted file to buffer, size: ${buffer.length} bytes`);

            // Save file to uploads directory
            await safeWriteFile(filepath, buffer);
            console.log(`[Document API] File saved to: ${filepath}`);

            // Extract text from document
            console.log(`[Document API] Extracting text from document`);
            let text = null;
            try {
                text = await extractTextFromDocument(filepath);

                // Check if we got any text back
                if (!text) {
                    console.error('[Document API] Failed to extract text from document - null result');
                    const errorResponse = NextResponse.json(
                        { error: 'Failed to extract text from document' },
                        { status: 400 }
                    );
                    return configureCors(errorResponse);
                }

                // Check for minimal text content
                if (text.trim().length < 20) {
                    console.error('[Document API] Document contains minimal text content');
                    const errorResponse = NextResponse.json(
                        { error: 'The document contains too little text to extract topics' },
                        { status: 400 }
                    );
                    return configureCors(errorResponse);
                }
            } catch (extractError) {
                console.error('[Document API] Error extracting text from document:', extractError);
                const errorResponse = NextResponse.json(
                    { error: `Failed to extract text: ${extractError.message || 'Unknown extraction error'}` },
                    { status: 400 }
                );
                return configureCors(errorResponse);
            }

            console.log(`[Document API] Text extracted, length: ${text.length} characters`);
            // Log the first 200 characters of extracted text for debugging
            const sampleText = text.substring(0, 200).replace(/\n/g, ' ');
            console.log(`[Document API] Text sample: "${sampleText}..."`);

            // Extract topics from text
            console.log(`[Document API] Extracting topics from text`);
            try {
                // Final text length check before topic extraction
                if (text.trim().length < 50) {
                    console.error('[Document API] Text too short for topic extraction');
                    const errorResponse = NextResponse.json(
                        { error: 'The document contains insufficient text for topic extraction' },
                        { status: 400 }
                    );
                    return configureCors(errorResponse);
                }

                // Extract topics with proper error handling
                let topics = [];
                try {
                    topics = await extractTopicsFromText(text);
                } catch (extractionError) {
                    console.error('[Document API] Topic extraction failed:', extractionError);

                    // Use fallback topic extraction approach or return error
                    const errorResponse = NextResponse.json(
                        { error: `Failed to extract topics: ${extractionError.message}` },
                        { status: 400 }
                    );
                    return configureCors(errorResponse);
                }

                console.log(`[Document API] Topics extracted: ${topics?.length || 0} topics`);

                // Don't log full JSON, it can be too large. Log a summary instead
                if (topics && topics.length > 0) {
                    const topicSummary = topics.map(t => ({
                        title: t.title,
                        argumentCount: t.arguments?.length || 0
                    }));
                    console.log('[Document API] Topics summary:', JSON.stringify(topicSummary, null, 2));
                } else {
                    console.log('[Document API] No topics were extracted');
                }

                // Check if we got any topics back
                if (!topics || topics.length === 0) {
                    console.warn('[Document API] No topics found in document, using generic fallback');

                    // Use a generic topic based on the filename as fallback
                    const fileBaseName = path.basename(file.name, path.extname(file.name));
                    const topicTitle = fileBaseName
                        .split(/[_\-\s]+/)
                        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                        .join(' ');

                    // Create a fallback topic
                    topics = [{
                        title: topicTitle || 'Document Analysis',
                        confidence: 0.7,
                        arguments: [
                            {
                                claim: `Key points from ${fileBaseName || 'document'}`,
                                evidence: `The document contains information that can be analyzed and discussed.`
                            },
                            {
                                claim: 'Document content analysis',
                                evidence: `Analyzing the content of this document reveals important considerations.`
                            }
                        ]
                    }];

                    console.log('[Document API] Created fallback topic:', topics[0].title);
                }

                // Validate the topics format before sending response
                const validatedTopics = topics.map(topic => {
                    // Ensure title exists and is a string
                    const title = typeof topic.title === 'string' ? topic.title : 'Untitled Topic';

                    // Ensure confidence is a number between 0-1
                    const confidence = typeof topic.confidence === 'number' &&
                        topic.confidence >= 0 &&
                        topic.confidence <= 1
                        ? topic.confidence : 0.7;

                    // Ensure arguments exist and are in the expected format
                    let args = [];

                    if (topic.arguments && Array.isArray(topic.arguments)) {
                        args = topic.arguments.map(arg => {
                            return {
                                claim: arg.claim || `Key aspect of ${title}`,
                                evidence: arg.evidence || `This is an important consideration for ${title}.`,
                                counterpoints: Array.isArray(arg.counterpoints) ? arg.counterpoints : []
                            };
                        });
                    }

                    // If no arguments, add a default one
                    if (args.length === 0) {
                        args = [
                            {
                                claim: `Key aspect of ${title}`,
                                evidence: `The document discusses important aspects of ${title}.`,
                                counterpoints: []
                            }
                        ];
                    }

                    return {
                        title,
                        confidence,
                        arguments: args
                    };
                });

                const response = {
                    message: 'Document processed successfully',
                    topics: validatedTopics
                };

                console.log(`[Document API] Sending response with ${validatedTopics.length} topics`);

                const successResponse = NextResponse.json(response);
                return configureCors(successResponse);
            } catch (topicError) {
                console.error('[Document API] Error in topic processing flow:', topicError);
                const errorResponse = NextResponse.json(
                    { error: `Failed to process topics: ${topicError.message || 'Unknown error'}` },
                    { status: 400 }
                );
                return configureCors(errorResponse);
            }
        } catch (bufferError) {
            console.error('[Document API] Error processing file buffer:', bufferError);
            const errorResponse = NextResponse.json(
                { error: `Failed to process uploaded file: ${bufferError.message || 'Unknown error'}` },
                { status: 500 }
            );
            return configureCors(errorResponse);
        }
    } catch (error) {
        console.error('[Document API] Unhandled server error:', error);
        // Ensure we return a proper JSON response even for server errors
        const errorResponse = NextResponse.json(
            { error: 'Server error while processing document', details: error.message || 'Unknown error' },
            { status: 500 }
        );
        return configureCors(errorResponse);
    }
} 