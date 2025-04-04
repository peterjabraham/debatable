import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { extractTextFromDocument } from '../document-processor';
import * as fs from 'fs/promises';
import path from 'path';

// Mock dependencies correctly
vi.mock('fs/promises', async () => {
    return {
        readFile: vi.fn()
    };
});

// Mock pdf-parse module
vi.mock('pdf-parse', () => {
    return {
        default: vi.fn().mockImplementation((buffer) => {
            return Promise.resolve({
                text: 'This is the extracted text from a PDF file',
                numPages: 1,
            });
        }),
    };
});

describe('Document Processor', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('should extract text from PDF files', async () => {
        // Mock file content
        const mockBuffer = Buffer.from('mock PDF content');
        vi.mocked(fs.readFile).mockResolvedValue(mockBuffer);

        // Execute function
        const result = await extractTextFromDocument('test.pdf');

        // Verify results
        expect(fs.readFile).toHaveBeenCalledWith('test.pdf');
        expect(result).toBe('This is the extracted text from a PDF file');
    });

    it('should extract text from TXT files', async () => {
        // Setup mock
        const mockContent = 'This is a text file content';
        vi.mocked(fs.readFile).mockResolvedValue(mockContent);

        // Execute function
        const result = await extractTextFromDocument('test.txt');

        // Verify results
        expect(fs.readFile).toHaveBeenCalledWith('test.txt', 'utf-8');
        expect(result).toBe(mockContent);
    });

    it('should handle DOCX files with sample content', async () => {
        // Execute function
        const result = await extractTextFromDocument('test.docx');

        // Verify we get the sample text for DOCX since it's not fully implemented
        expect(result).toContain('Climate Change and Global Policy');
    });

    it('should return null for unsupported file types', async () => {
        const result = await extractTextFromDocument('image.jpg');
        expect(result).toBeNull();
    });

    it('should handle file read errors gracefully', async () => {
        // Setup mock to throw error
        vi.mocked(fs.readFile).mockRejectedValue(new Error('File not found'));

        // Execute function
        const result = await extractTextFromDocument('missing.pdf');

        // Verify error handling
        expect(result).toBeNull();
    });

    it('should handle PDF parsing errors gracefully', async () => {
        // Setup mocks
        const mockBuffer = Buffer.from('invalid PDF content');
        vi.mocked(fs.readFile).mockResolvedValue(mockBuffer);

        // Mock PDF parse to throw an error
        const pdfParse = require('pdf-parse').default;
        pdfParse.mockRejectedValueOnce(new Error('Invalid PDF structure'));

        // Execute function
        const result = await extractTextFromDocument('corrupt.pdf');

        // Verify error handling
        expect(result).toBeNull();
    });
}); 