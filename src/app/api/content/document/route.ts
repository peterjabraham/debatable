import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { extractTextFromDocument } from '@/lib/content-processing/document-processor';
import { extractTopicsFromText } from '@/lib/content-processing/topic-extractor';

// Ensure uploads directory exists
async function ensureUploadsDir() {
    try {
        // In production (especially on Vercel), we may not have write access
        // to the filesystem, so we'll use a mock implementation
        if (process.env.NODE_ENV === 'production') {
            return '/tmp/uploads'; // This path won't actually be used in production
        }

        const uploadsDir = join(process.cwd(), 'uploads');
        await mkdir(uploadsDir, { recursive: true });
        return uploadsDir;
    } catch (error) {
        console.error('Error creating uploads directory:', error);
        throw error;
    }
}

// Safe file write function that handles production environments
async function safeWriteFile(path: string, data: Buffer) {
    // In production, we'll skip actual file writing since it may not be supported
    if (process.env.NODE_ENV === 'production') {
        console.log(`[Production] Skipping file write to: ${path}`);
        return;
    }

    try {
        await writeFile(path, data);
    } catch (error) {
        console.error(`Error writing file to ${path}:`, error);
        throw error;
    }
}

export async function POST(request: Request) {
    try {
        const formData = await request.formData();
        const file = formData.get('file') as File;

        if (!file) {
            return NextResponse.json(
                { error: 'No file provided' },
                { status: 400 }
            );
        }

        // Generate a unique filename
        const filename = `${uuidv4()}-${file.name}`;
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        // Save file to uploads directory
        const uploadDir = join(process.cwd(), 'uploads');
        const filepath = join(uploadDir, filename);
        await writeFile(filepath, buffer);

        // Extract text from document
        const text = await extractTextFromDocument(filepath);
        if (!text) {
            return NextResponse.json(
                { error: 'Failed to extract text from document' },
                { status: 400 }
            );
        }

        // Extract topics from text
        const topics = await extractTopicsFromText(text);
        if (!topics || topics.length === 0) {
            return NextResponse.json(
                { error: 'No topics found in document' },
                { status: 400 }
            );
        }

        return NextResponse.json({
            message: 'Document processed successfully',
            topics
        });

    } catch (error) {
        console.error('[Document API] Error:', error);
        return NextResponse.json(
            { error: 'Failed to process document' },
            { status: 500 }
        );
    }
} 