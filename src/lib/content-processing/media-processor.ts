import youtubeDl from 'youtube-dl-exec';
import ffmpeg from 'fluent-ffmpeg';
import fetch from 'node-fetch';
import { TopicExtractor } from './topic-extractor';
import {
    MediaType,
    MediaMetadata,
    TranscriptSegment,
    KeyPoint,
    ProcessedMedia,
    MediaProcessorOptions,
} from '@/types/content-processing';
import fs from 'fs';

const DEFAULT_OPTIONS: MediaProcessorOptions = {
    downloadMedia: true,
    extractAudio: true,
    generateTranscript: true,
    maxDuration: 3600, // 1 hour
    language: 'en',
};

export class MediaProcessor {
    private options: MediaProcessorOptions;
    private topicExtractor: TopicExtractor;

    constructor(options: Partial<MediaProcessorOptions> = {}) {
        this.options = { ...DEFAULT_OPTIONS, ...options };
        this.topicExtractor = new TopicExtractor();
    }

    async processMedia(url: string, type: MediaType): Promise<ProcessedMedia> {
        try {
            // Validate URL and media type
            if (!this.isValidUrl(url)) {
                throw new Error('Invalid URL provided');
            }

            // Get media metadata
            let metadata: MediaMetadata;
            try {
                metadata = await this.getMediaMetadata(url, type);
            } catch (metadataError) {
                console.error('Error getting media metadata:', metadataError);
                // Provide fallback metadata
                metadata = {
                    title: type === 'youtube' ? 'YouTube Video' : type === 'podcast' ? 'Podcast Episode' : 'Media File',
                    duration: 0,
                    format: type,
                    url,
                    author: 'Unknown Author',
                    publishDate: new Date(),
                };
            }

            // Check duration limit
            if (metadata.duration > this.options.maxDuration) {
                throw new Error('Media duration exceeds maximum allowed length');
            }

            // Process based on media type
            let transcript: TranscriptSegment[] = [];
            if (this.options.generateTranscript) {
                try {
                    transcript = await this.generateTranscript(url, type);
                } catch (transcriptError) {
                    console.error('Error generating transcript:', transcriptError);
                    transcript = [{
                        start: 0,
                        end: 0,
                        text: 'Transcript generation failed',
                        confidence: 0
                    }];
                }
            }

            // Extract key points from transcript
            let keyPoints: KeyPoint[] = [];
            try {
                keyPoints = await this.extractKeyPoints(transcript);
            } catch (keyPointsError) {
                console.error('Error extracting key points:', keyPointsError);
                keyPoints = [];
            }

            return {
                metadata,
                transcript,
                keyPoints,
            };
        } catch (error) {
            console.error('Process media error:', error);
            return {
                metadata: {
                    title: type === 'youtube' ? 'YouTube Video' : type === 'podcast' ? 'Podcast Episode' : 'Media File',
                    duration: 0,
                    format: type,
                    url,
                    author: 'Unknown Author',
                    publishDate: new Date(),
                },
                transcript: [],
                keyPoints: [],
                error: `Failed to process media: ${error.message}`,
            };
        }
    }

    private isValidUrl(url: string): boolean {
        try {
            new URL(url);
            return true;
        } catch {
            return false;
        }
    }

    private async getMediaMetadata(url: string, type: MediaType): Promise<MediaMetadata> {
        switch (type) {
            case 'youtube':
                return this.getYouTubeMetadata(url);
            case 'podcast':
                return this.getPodcastMetadata(url);
            default:
                return this.getGenericMediaMetadata(url);
        }
    }

    private async getYouTubeMetadata(url: string): Promise<MediaMetadata> {
        try {
            const info = await youtubeDl(url, {
                dumpSingleJson: true,
                noWarnings: true,
                noCallHome: true,
                noCheckCertificate: true,
                preferFreeFormats: true,
                youtubeSkipDashManifest: true,
            });

            // Check if info is defined and has the necessary properties
            if (!info) {
                console.error('YouTube-dl returned undefined result');
                return {
                    title: 'Unknown YouTube Video',
                    duration: 0,
                    format: 'youtube',
                    url: url,
                };
            }

            return {
                title: info.title || 'Unknown Title',
                description: info.description || '',
                duration: typeof info.duration === 'number' ? info.duration : 0,
                format: 'youtube',
                url: info.webpage_url || url,
                thumbnailUrl: info.thumbnail || '',
                author: info.uploader || 'Unknown',
                publishDate: info.upload_date ? new Date(info.upload_date) : new Date(),
            };
        } catch (error) {
            console.error('Error getting YouTube metadata:', error);
            // Return fallback metadata
            return {
                title: 'YouTube Video',
                duration: 0,
                format: 'youtube',
                url: url,
            };
        }
    }

    private async getPodcastMetadata(url: string): Promise<MediaMetadata> {
        try {
            // First, try to fetch metadata from the podcast URL
            const response = await fetch(url, { method: 'HEAD' });
            const contentType = response.headers.get('content-type') || '';

            // For podcasts that use RSS feeds
            if (url.includes('rss') || contentType.includes('rss') || contentType.includes('xml')) {
                try {
                    const feedResponse = await fetch(url);
                    const feedText = await feedResponse.text();

                    // Simple XML parsing to extract metadata
                    const titleMatch = feedText.match(/<title>(.*?)<\/title>/);
                    const authorMatch = feedText.match(/<itunes:author>(.*?)<\/itunes:author>/) || feedText.match(/<author>(.*?)<\/author>/);
                    const durationMatch = feedText.match(/<itunes:duration>(.*?)<\/itunes:duration>/);
                    const descriptionMatch = feedText.match(/<description>(.*?)<\/description>/);
                    const imageMatch = feedText.match(/<itunes:image href="(.*?)"/);

                    return {
                        title: titleMatch ? titleMatch[1] : 'Unknown Podcast',
                        description: descriptionMatch ? descriptionMatch[1] : '',
                        duration: durationMatch ? this.timeStringToSeconds(durationMatch[1]) : 0,
                        format: 'podcast',
                        url,
                        thumbnailUrl: imageMatch ? imageMatch[1] : '',
                        author: authorMatch ? authorMatch[1] : 'Unknown Author',
                        publishDate: new Date(),
                    };
                } catch (parseError) {
                    console.error('Error parsing podcast RSS feed:', parseError);
                    return {
                        title: 'Podcast from ' + (new URL(url)).hostname,
                        description: '',
                        duration: 0,
                        format: 'podcast',
                        url,
                        author: 'Unknown Author',
                        publishDate: new Date(),
                    };
                }
            }

            // For direct audio files
            return {
                title: url.split('/').pop() || 'Podcast Episode',
                description: '',
                duration: 0, // Will need processing to determine
                format: 'podcast',
                url,
                author: 'Unknown Author',
                publishDate: new Date(),
            };
        } catch (error) {
            console.error('Error retrieving podcast metadata:', error);
            return {
                title: 'Podcast Episode',
                description: '',
                duration: 0,
                format: 'podcast',
                url,
                author: 'Unknown Author',
                publishDate: new Date(),
            };
        }
    }

    private timeStringToSeconds(timeStr: string): number {
        // Handle formats like "HH:MM:SS" or "MM:SS" or just seconds
        if (timeStr.includes(':')) {
            const parts = timeStr.split(':').map(Number);
            if (parts.length === 3) {
                // HH:MM:SS
                return parts[0] * 3600 + parts[1] * 60 + parts[2];
            } else if (parts.length === 2) {
                // MM:SS
                return parts[0] * 60 + parts[1];
            }
        }
        // Just seconds or fallback
        return parseInt(timeStr) || 0;
    }

    private async getGenericMediaMetadata(url: string): Promise<MediaMetadata> {
        try {
            // Basic metadata for generic media files
            const response = await fetch(url, { method: 'HEAD' });
            const contentType = response.headers.get('content-type') || '';
            const contentLength = response.headers.get('content-length') || '0';

            const filename = url.split('/').pop() || 'Unknown File';

            return {
                title: filename,
                description: `Content type: ${contentType}`,
                duration: 0, // Would need media processing to determine duration
                format: contentType,
                url,
                author: 'Unknown Author',
                publishDate: new Date(),
            };
        } catch (error) {
            console.error('Error retrieving generic media metadata:', error);
            return {
                title: 'Media File',
                description: '',
                duration: 0,
                format: 'unknown',
                url,
                author: 'Unknown Author',
                publishDate: new Date(),
            };
        }
    }

    private async generateTranscript(
        url: string,
        type: MediaType
    ): Promise<TranscriptSegment[]> {
        switch (type) {
            case 'youtube':
                return this.generateYouTubeTranscript(url);
            case 'podcast':
                return this.generatePodcastTranscript(url);
            default:
                return this.generateGenericTranscript(url);
        }
    }

    private async generateYouTubeTranscript(url: string): Promise<TranscriptSegment[]> {
        // First try to get existing captions
        try {
            const info = await youtubeDl(url, {
                skipDownload: true,
                writeAutoSub: true,
                subLang: this.options.language,
            });

            if (info.subtitles?.[this.options.language]) {
                return this.parseYouTubeSubtitles(info.subtitles[this.options.language][0].url);
            }
        } catch (error) {
            console.warn('Failed to get YouTube subtitles:', error);
        }

        // If no captions available, download audio and transcribe
        if (this.options.downloadMedia && this.options.extractAudio) {
            return this.transcribeAudio(url);
        }

        return [];
    }

    private async generatePodcastTranscript(url: string): Promise<TranscriptSegment[]> {
        if (this.options.downloadMedia && this.options.extractAudio) {
            return this.transcribeAudio(url);
        }
        return [];
    }

    private async generateGenericTranscript(url: string): Promise<TranscriptSegment[]> {
        if (this.options.downloadMedia && this.options.extractAudio) {
            return this.transcribeAudio(url);
        }
        return [];
    }

    private async parseYouTubeSubtitles(subtitleUrl: string): Promise<TranscriptSegment[]> {
        const response = await fetch(subtitleUrl);
        const subtitles = await response.text();

        // Parse the subtitle format (typically WebVTT or SRT)
        // This is a simplified parser
        return subtitles
            .split('\n\n')
            .filter(segment => segment.trim())
            .map(segment => {
                const lines = segment.split('\n');
                const timeMatch = lines[1]?.match(/(\d{2}:\d{2}:\d{2}.\d{3}) --> (\d{2}:\d{2}:\d{2}.\d{3})/);

                if (!timeMatch) return null;

                return {
                    text: lines.slice(2).join(' ').trim(),
                    start: this.timeToSeconds(timeMatch[1]),
                    end: this.timeToSeconds(timeMatch[2]),
                    confidence: 0.9, // Assuming high confidence for official subtitles
                };
            })
            .filter((segment): segment is TranscriptSegment => segment !== null);
    }

    private async transcribeAudio(url: string): Promise<TranscriptSegment[]> {
        try {
            // Download audio
            const audioPath = await this.downloadAndExtractAudio(url);

            // Use OpenAI's Whisper API for transcription
            const formData = new FormData();
            formData.append('file', new Blob([fs.readFileSync(audioPath)]), 'audio.mp3');
            formData.append('model', 'whisper-1');
            formData.append('language', this.options.language);

            const whisperResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                },
                body: formData,
            });

            if (!whisperResponse.ok) {
                throw new Error(`Whisper API error: ${whisperResponse.statusText}`);
            }

            const result = await whisperResponse.json();

            // Clean up the temporary file
            try {
                fs.unlinkSync(audioPath);
            } catch (e) {
                console.warn('Failed to delete temporary audio file:', e);
            }

            // Format the response into transcript segments
            // Since Whisper doesn't provide timestamps for each word, we'll estimate
            const text = result.text;
            const sentences = this.splitIntoSentences(text);
            const averageDuration = 5; // Assume average sentence takes 5 seconds

            return sentences.map((sentence, index) => ({
                text: sentence,
                start: index * averageDuration,
                end: (index + 1) * averageDuration,
                confidence: 0.8, // Whisper doesn't provide confidence scores
            }));
        } catch (error) {
            console.error('Error transcribing audio:', error);
            return [];
        }
    }

    private splitIntoSentences(text: string): string[] {
        // Simple sentence splitter
        return text
            .replace(/([.!?])\s+/g, '$1|')
            .split('|')
            .filter(sentence => sentence.trim().length > 0);
    }

    private async downloadAndExtractAudio(url: string): Promise<string> {
        const outputPath = `/tmp/${Date.now()}.mp3`;

        return new Promise((resolve, reject) => {
            ffmpeg()
                .input(url)
                .toFormat('mp3')
                .on('end', () => resolve(outputPath))
                .on('error', (err) => reject(err))
                .save(outputPath);
        });
    }

    private async extractKeyPoints(transcript: TranscriptSegment[]): Promise<KeyPoint[]> {
        const keyPoints: KeyPoint[] = [];
        const transcriptText = transcript.map(segment => segment.text).join(' ');

        // Use TopicExtractor to identify important points
        const topics = await this.topicExtractor.extractTopics({
            content: transcriptText,
            rawText: transcriptText,
        });

        // Convert topics to key points with timestamps
        for (const topic of topics.topics) {
            const relevantSegment = transcript.find(segment =>
                segment.text.includes(topic.title)
            );

            if (relevantSegment) {
                keyPoints.push({
                    text: topic.title,
                    timestamp: relevantSegment.start,
                    confidence: topic.confidence,
                    topics: topic.keywords,
                });
            }
        }

        return keyPoints.sort((a, b) => a.timestamp - b.timestamp);
    }

    private timeToSeconds(timeStr: string): number {
        const [hours, minutes, seconds] = timeStr.split(':').map(Number);
        return hours * 3600 + minutes * 60 + seconds;
    }
} 