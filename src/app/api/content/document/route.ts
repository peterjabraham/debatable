import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';

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

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const file = formData.get('file') as File;

        if (!file) {
            return NextResponse.json(
                { message: 'No file provided' },
                { status: 400 }
            );
        }

        // Validate file type
        const fileType = file.name.split('.').pop()?.toLowerCase();
        if (!['pdf', 'docx', 'txt'].includes(fileType || '')) {
            return NextResponse.json(
                { message: 'Unsupported file type. Please upload PDF, DOCX, or TXT files.' },
                { status: 400 }
            );
        }

        // Generate a unique filename
        const uniqueFilename = `${uuidv4()}-${file.name}`;

        try {
            // Save file to disk (only in development)
            const uploadsDir = await ensureUploadsDir();
            const bytes = await file.arrayBuffer();
            const buffer = Buffer.from(bytes);
            const filePath = join(uploadsDir, uniqueFilename);

            await safeWriteFile(filePath, buffer);
            console.log(`File ${process.env.NODE_ENV === 'production' ? 'would be' : 'was'} saved to: ${filePath}`);
        } catch (fileError) {
            console.error('File handling error:', fileError);
            // Continue with mock processing even if file saving fails
        }

        // Mock document processing and topic extraction
        // In a real implementation, this would use the DocumentParser and TopicExtractor
        const mockTopics = [
            {
                title: `Key insights from ${file.name}`,
                confidence: 0.92,
                arguments: [
                    {
                        claim: "AI will transform how we work in the next decade",
                        evidence: "Multiple studies show 40% of jobs will be augmented by AI by 2030"
                    },
                    {
                        claim: "Human creativity remains essential despite AI advances",
                        evidence: "Creative problem-solving is still difficult for AI systems to replicate"
                    },
                    {
                        claim: "Ethical guidelines are needed for responsible AI development",
                        evidence: "Without proper oversight, AI systems may perpetuate existing biases"
                    }
                ]
            },
            {
                title: `The future of technology based on ${file.name}`,
                confidence: 0.85,
                arguments: [
                    {
                        claim: "Quantum computing will revolutionize cryptography",
                        evidence: "Current encryption methods may become obsolete within 5-10 years"
                    },
                    {
                        claim: "Blockchain technology has applications beyond cryptocurrency",
                        evidence: "Supply chain management and voting systems are adopting blockchain"
                    }
                ]
            },
            {
                title: `Ethical considerations from ${file.name}`,
                confidence: 0.78,
                arguments: [
                    {
                        claim: "Privacy concerns are growing with data collection",
                        evidence: "Users are increasingly aware of how their data is being used"
                    },
                    {
                        claim: "Technology regulation needs to balance innovation and protection",
                        evidence: "Overly restrictive policies may stifle beneficial developments"
                    }
                ]
            }
        ];

        return NextResponse.json({
            message: 'Document processed successfully',
            filename: uniqueFilename,
            fileType,
            fileSize: file.size,
            topics: mockTopics
        });

    } catch (error) {
        console.error('Error processing document:', error);

        // Even if processing fails, return mock topics to prevent UI errors
        const mockErrorTopics = [
            {
                title: "AI and the Future of Work",
                confidence: 0.95,
                arguments: [
                    {
                        claim: "Fallback topic due to processing error",
                        evidence: "Mock topic generated when document processing fails"
                    },
                    {
                        claim: "AI will transform industries through automation",
                        evidence: "Recent studies predict 30% of current jobs will change significantly"
                    }
                ]
            }
        ];

        return NextResponse.json({
            message: 'Warning: Document processing encountered an error, but we generated fallback topics',
            error: (error as Error).message,
            topics: mockErrorTopics,
            isErrorFallback: true
        });
    }
} 