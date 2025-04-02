import { MediaProcessor } from '../media-processor';
import { TopicExtractor } from '../topic-extractor';
import fetch from 'node-fetch';
import fs from 'fs';
import youtubeDl from 'youtube-dl-exec';
import ffmpeg from 'fluent-ffmpeg';

// Mock dependencies
jest.mock('node-fetch');
jest.mock('fs');
jest.mock('youtube-dl-exec');
jest.mock('fluent-ffmpeg');
jest.mock('../topic-extractor');

describe('MediaProcessor', () => {
    let mediaProcessor: MediaProcessor;

    beforeEach(() => {
        // Reset all mocks
        jest.clearAllMocks();

        // Create a new instance for each test
        mediaProcessor = new MediaProcessor({
            downloadMedia: true,
            extractAudio: true,
            generateTranscript: true,
            maxDuration: 3600,
            language: 'en',
        });
    });

    describe('processMedia', () => {
        it('should validate URLs', async () => {
            const result = await mediaProcessor.processMedia('invalid-url', 'youtube');
            expect(result.error).toContain('Invalid URL provided');
        });

        it('should process YouTube videos', async () => {
            // Mock YouTube metadata
            (youtubeDl as jest.Mock).mockResolvedValue({
                title: 'Test Video',
                description: 'Test Description',
                duration: 120,
                webpage_url: 'https://www.youtube.com/watch?v=test',
                thumbnail: 'https://img.youtube.com/test.jpg',
                uploader: 'Test Channel',
                upload_date: '20230101',
                subtitles: {
                    en: [{ url: 'https://youtube.com/subtitles.vtt' }]
                }
            });

            // Mock subtitle fetch
            (fetch as unknown as jest.Mock).mockResolvedValue({
                ok: true,
                text: jest.fn().mockResolvedValue(
                    '00:00:00.000 --> 00:00:05.000\nHello world\n\n' +
                    '00:00:05.000 --> 00:00:10.000\nThis is a test'
                )
            });

            // Mock TopicExtractor
            (TopicExtractor.prototype.extractTopics as jest.Mock).mockResolvedValue({
                topics: [
                    {
                        title: 'Test Topic',
                        confidence: 0.8,
                        keywords: ['test', 'topic'],
                        summary: 'This is a test topic'
                    }
                ]
            });

            const result = await mediaProcessor.processMedia('https://www.youtube.com/watch?v=test', 'youtube');

            expect(result.error).toBeUndefined();
            expect(result.metadata.title).toBe('Test Video');
            expect(result.transcript.length).toBeGreaterThan(0);
            expect(result.transcript[0].text).toBe('Hello world');
        });

        it('should process podcast audio', async () => {
            // Mock podcast RSS feed
            (fetch as unknown as jest.Mock).mockResolvedValueOnce({
                ok: true,
                headers: {
                    get: jest.fn().mockReturnValue('application/rss+xml')
                }
            }).mockResolvedValueOnce({
                ok: true,
                text: jest.fn().mockResolvedValue(
                    '<rss><channel>' +
                    '<title>Test Podcast</title>' +
                    '<description>Test Description</description>' +
                    '<itunes:author>Test Author</itunes:author>' +
                    '<itunes:duration>30:00</itunes:duration>' +
                    '<itunes:image href="https://example.com/image.jpg"/>' +
                    '</channel></rss>'
                )
            });

            // Mock audio download and transcription
            (ffmpeg as unknown as jest.Mock).mockReturnValue({
                input: jest.fn().mockReturnThis(),
                toFormat: jest.fn().mockReturnThis(),
                on: jest.fn().mockImplementation(function (event, callback) {
                    if (event === 'end') {
                        callback();
                    }
                    return this;
                }),
                save: jest.fn()
            });

            // Mock Whisper API
            (fetch as unknown as jest.Mock).mockResolvedValueOnce({
                ok: true,
                json: jest.fn().mockResolvedValue({
                    text: 'This is a test transcript for a podcast episode.'
                })
            });

            // Mock fs
            (fs.readFileSync as jest.Mock).mockReturnValue(Buffer.from('test'));

            // Mock TopicExtractor
            (TopicExtractor.prototype.extractTopics as jest.Mock).mockResolvedValue({
                topics: [
                    {
                        title: 'Podcast Topic',
                        confidence: 0.75,
                        keywords: ['podcast', 'audio'],
                        summary: 'This is a podcast topic'
                    }
                ]
            });

            const result = await mediaProcessor.processMedia('https://example.com/podcast.rss', 'podcast');

            expect(result.error).toBeUndefined();
            expect(result.metadata.title).toBe('Test Podcast');
            expect(result.metadata.format).toBe('podcast');
        });

        it('should handle errors gracefully', async () => {
            // Mock an error in YouTube-dl
            (youtubeDl as jest.Mock).mockRejectedValue(new Error('YouTube API error'));

            const result = await mediaProcessor.processMedia('https://www.youtube.com/watch?v=test', 'youtube');

            expect(result.error).toContain('Failed to process media');
            expect(result.metadata.url).toBe('https://www.youtube.com/watch?v=test');
            expect(result.transcript).toEqual([]);
            expect(result.keyPoints).toEqual([]);
        });
    });
}); 