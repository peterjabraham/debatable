import { NextRequest } from 'next/server';
import { POST } from '../route';
import { MediaProcessor } from '@/lib/content-processing/media-processor';
import { TopicExtractor } from '@/lib/content-processing/topic-extractor';
import { createDocument } from '@/lib/db/firestore';

// Mock dependencies
jest.mock('@/lib/content-processing/media-processor');
jest.mock('@/lib/content-processing/topic-extractor');
jest.mock('@/lib/db/firestore');

describe('Media API Route', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should return 400 if no URL is provided', async () => {
        const formData = new FormData();
        formData.append('type', 'youtube');

        const request = new NextRequest('http://localhost/api/content/media', {
            method: 'POST',
            body: formData,
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.message).toBe('No URL provided');
    });

    it('should return 400 if invalid media type is provided', async () => {
        const formData = new FormData();
        formData.append('url', 'https://example.com/video');
        formData.append('type', 'invalid');

        const request = new NextRequest('http://localhost/api/content/media', {
            method: 'POST',
            body: formData,
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.message).toBe('Invalid media type. Supported types: youtube, podcast');
    });

    it('should process YouTube videos successfully', async () => {
        // Mock successful media processing
        (MediaProcessor.prototype.processMedia as jest.Mock).mockResolvedValue({
            metadata: {
                title: 'Test YouTube Video',
                duration: 120,
                format: 'youtube',
                url: 'https://www.youtube.com/watch?v=test',
                thumbnailUrl: 'https://img.youtube.com/test.jpg',
                author: 'Test Channel',
                publishDate: new Date('2023-01-01'),
            },
            transcript: [
                {
                    text: 'This is a test transcript',
                    start: 0,
                    end: 5,
                    confidence: 0.9,
                }
            ],
            keyPoints: [],
        });

        // Mock successful topic extraction
        (TopicExtractor.prototype.extractTopics as jest.Mock).mockResolvedValue({
            success: true,
            topics: [
                {
                    title: 'Test Topic',
                    confidence: 0.8,
                    keywords: ['test', 'topic'],
                    summary: 'This is a test topic',
                }
            ],
            mainArguments: [
                {
                    claim: 'Test Claim',
                    confidence: 0.75,
                    evidence: ['Test Evidence'],
                }
            ],
        });

        // Mock successful document creation
        (createDocument as jest.Mock).mockResolvedValue({
            id: 'test-document-id',
        });

        const formData = new FormData();
        formData.append('url', 'https://www.youtube.com/watch?v=test');
        formData.append('type', 'youtube');

        const request = new NextRequest('http://localhost/api/content/media', {
            method: 'POST',
            body: formData,
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.message).toBe('Media processed successfully');
        expect(data.metadata.title).toBe('Test YouTube Video');
        expect(data.topics).toHaveLength(1);
        expect(data.topics[0].title).toBe('Test Topic');
        expect(createDocument).toHaveBeenCalled();
    });

    it('should handle media processing errors', async () => {
        // Mock media processing error
        (MediaProcessor.prototype.processMedia as jest.Mock).mockResolvedValue({
            metadata: {
                title: '',
                duration: 0,
                format: '',
                url: 'https://www.youtube.com/watch?v=test',
            },
            transcript: [],
            keyPoints: [],
            error: 'Failed to process media: YouTube API error',
        });

        const formData = new FormData();
        formData.append('url', 'https://www.youtube.com/watch?v=test');
        formData.append('type', 'youtube');

        const request = new NextRequest('http://localhost/api/content/media', {
            method: 'POST',
            body: formData,
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(500);
        expect(data.message).toBe('Failed to process media: YouTube API error');
    });

    it('should handle unexpected errors', async () => {
        // Mock unexpected error
        (MediaProcessor.prototype.processMedia as jest.Mock).mockRejectedValue(
            new Error('Unexpected error')
        );

        const formData = new FormData();
        formData.append('url', 'https://www.youtube.com/watch?v=test');
        formData.append('type', 'youtube');

        const request = new NextRequest('http://localhost/api/content/media', {
            method: 'POST',
            body: formData,
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(500);
        expect(data.message).toBe('Error processing media');
        expect(data.error).toBe('Unexpected error');
    });
}); 