import { NextRequest } from 'next/server';
import { POST } from '../document/route';
import { extractTextFromDocument } from '@/lib/content-processing/document-processor';
import { extractTopicsFromText } from '@/lib/content-processing/topic-extractor';
import { writeFile, mkdir } from 'fs/promises';

// Mock the modules
jest.mock('fs/promises', () => ({
    writeFile: jest.fn(),
    mkdir: jest.fn(),
}));

jest.mock('@/lib/content-processing/document-processor', () => ({
    extractTextFromDocument: jest.fn(),
}));

jest.mock('@/lib/content-processing/topic-extractor', () => ({
    extractTopicsFromText: jest.fn(),
}));

jest.mock('uuid', () => ({
    v4: jest.fn().mockReturnValue('mock-uuid'),
}));

describe('Document API endpoint', () => {
    const mockFormData = {
        get: jest.fn(),
    };

    // Create mock for the file
    const mockFile = {
        name: 'test-document.pdf',
        arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(8)),
    };

    // Mock NextRequest
    const createMockRequest = () => {
        return {
            formData: jest.fn().mockResolvedValue(mockFormData),
        } as unknown as NextRequest;
    };

    beforeEach(() => {
        jest.clearAllMocks();

        // Reset the mock implementations
        mockFormData.get.mockReturnValue(mockFile);
        (extractTextFromDocument as jest.Mock).mockResolvedValue('Mock document text content');
        (extractTopicsFromText as jest.Mock).mockResolvedValue([
            {
                title: 'Mock Topic',
                confidence: 0.85,
                arguments: [
                    {
                        claim: 'Mock claim',
                        evidence: 'Mock evidence',
                    },
                ],
            },
        ]);
    });

    it('should process a document and return topics', async () => {
        const request = createMockRequest();
        const response = await POST(request);
        const json = await response.json();

        // Check file was saved
        expect(writeFile).toHaveBeenCalled();

        // Check text extraction was called
        expect(extractTextFromDocument).toHaveBeenCalled();

        // Check topic extraction was called
        expect(extractTopicsFromText).toHaveBeenCalled();

        // Check response
        expect(response.status).toBe(200);
        expect(json).toHaveProperty('message', 'Document processed successfully');
        expect(json).toHaveProperty('topics');
        expect(json.topics).toHaveLength(1);
        expect(json.topics[0].title).toBe('Mock Topic');
    });

    it('should return 400 if no file is provided', async () => {
        const request = createMockRequest();
        mockFormData.get.mockReturnValue(null);

        const response = await POST(request);
        const json = await response.json();

        expect(response.status).toBe(400);
        expect(json).toHaveProperty('error', 'No file provided');
    });

    it('should return 400 if text extraction fails', async () => {
        const request = createMockRequest();
        (extractTextFromDocument as jest.Mock).mockResolvedValue(null);

        const response = await POST(request);
        const json = await response.json();

        expect(response.status).toBe(400);
        expect(json).toHaveProperty('error', 'Failed to extract text from document');
    });

    it('should return 400 if no topics are found', async () => {
        const request = createMockRequest();
        (extractTopicsFromText as jest.Mock).mockResolvedValue([]);

        const response = await POST(request);
        const json = await response.json();

        expect(response.status).toBe(400);
        expect(json).toHaveProperty('error', 'No topics found in document');
    });

    it('should handle errors during processing', async () => {
        const request = createMockRequest();
        (extractTextFromDocument as jest.Mock).mockRejectedValue(new Error('Mock error'));

        const response = await POST(request);
        const json = await response.json();

        expect(response.status).toBe(500);
        expect(json).toHaveProperty('error', 'Failed to process document');
    });
}); 