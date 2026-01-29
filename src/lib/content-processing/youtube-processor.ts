import { YoutubeTranscript } from 'youtube-transcript';

export interface YouTubeVideoInfo {
    id: string;
    title?: string;
    duration?: number;
    transcript: string;
    segmentedTranscript?: TranscriptSegment[];
}

export interface TranscriptSegment {
    text: string;
    timestamp: number;
    duration?: number;
}

export interface EnhancedYouTubeExtraction {
    videoId: string;
    title: string;
    transcript: string;
    segmentedTranscript: TranscriptSegment[];
    contextualContent: string;
}

/**
 * Validates if a URL is a valid YouTube URL
 */
export function validateYouTubeUrl(url: string): boolean {
    const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
    return youtubeRegex.test(url);
}

/**
 * Extracts the video ID from a YouTube URL
 */
export function extractVideoId(url: string): string | null {
    const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
    const match = url.match(regex);
    return match ? match[1] : null;
}

/**
 * Enhancement 4.A: Fetches video title from YouTube URL
 * Uses a simple method to extract title from YouTube page HTML
 */
export async function extractVideoTitle(url: string): Promise<string> {
    try {
        const videoId = extractVideoId(url);
        if (!videoId) {
            return 'Unknown Video';
        }

        // Try to fetch title from YouTube page
        const response = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; DebateApp/1.0)'
            }
        });

        if (!response.ok) {
            console.warn('[YouTube Processor] Could not fetch video page for title extraction');
            return 'YouTube Video';
        }

        const html = await response.text();

        // Extract title from meta tag
        const titleMatch = html.match(/<meta name="title" content="([^"]*)"/) ||
            html.match(/<title>([^<]*)<\/title>/);

        if (titleMatch && titleMatch[1]) {
            // Clean up the title (remove " - YouTube" suffix if present)
            const title = titleMatch[1].replace(/ - YouTube$/, '').trim();
            console.log(`[YouTube Processor] Extracted video title: ${title}`);
            return title;
        }

        return 'YouTube Video';
    } catch (error) {
        console.warn('[YouTube Processor] Failed to extract video title:', error);
        return 'YouTube Video';
    }
}

/**
 * Enhanced version that implements both 4.A and 4.B
 * Fetches transcript with timestamp preservation and video title context
 */
export async function extractYouTubeTextEnhanced(url: string): Promise<EnhancedYouTubeExtraction> {
    console.log(`[YouTube Processor] Enhanced processing of YouTube URL: ${url}`);

    // Validate URL
    if (!validateYouTubeUrl(url)) {
        throw new Error('Invalid YouTube URL format');
    }

    const videoId = extractVideoId(url);
    if (!videoId) {
        throw new Error('Could not extract video ID from URL');
    }

    console.log(`[YouTube Processor] Extracted video ID: ${videoId}`);

    try {
        // Enhancement 4.A: Fetch video title
        const videoTitle = await extractVideoTitle(url);

        // Fetch transcript with timestamps
        const transcriptArray = await YoutubeTranscript.fetchTranscript(url);

        if (!transcriptArray || transcriptArray.length === 0) {
            throw new Error('No transcript available for this video. The video may not have captions enabled.');
        }

        // Enhancement 4.B: Preserve timestamps for citation
        const segmentedTranscript: TranscriptSegment[] = transcriptArray.map(segment => ({
            text: segment.text,
            timestamp: segment.start,
            duration: segment.dur || 0
        }));

        // Create combined transcript text
        const fullTranscript = transcriptArray
            .map(segment => segment.text)
            .join(' ')
            .replace(/\s+/g, ' ') // Clean up multiple spaces
            .trim();

        if (fullTranscript.length < 50) {
            throw new Error('Transcript is too short to extract meaningful topics');
        }

        // Enhancement 4.A: Create contextual content with video title
        const contextualContent = `Video: "${videoTitle}" - ${fullTranscript}`;

        console.log(`[YouTube Processor] Successfully extracted enhanced data:
            - Title: ${videoTitle}
            - Transcript: ${fullTranscript.length} characters
            - Segments: ${segmentedTranscript.length} timestamped segments`);

        return {
            videoId,
            title: videoTitle,
            transcript: fullTranscript,
            segmentedTranscript,
            contextualContent
        };

    } catch (error: any) {
        console.error(`[YouTube Processor] Error in enhanced processing:`, error);

        // Provide more specific error messages
        if (error.message.includes('Transcript is disabled')) {
            throw new Error('Transcript is disabled for this video. Please try a different video.');
        } else if (error.message.includes('No transcript found')) {
            throw new Error('No transcript found for this video. The video may not have captions available.');
        } else if (error.message.includes('Video unavailable')) {
            throw new Error('Video is unavailable or private. Please check the URL and try again.');
        } else {
            throw new Error(`Failed to fetch YouTube transcript: ${error.message}`);
        }
    }
}

/**
 * Fetches transcript from YouTube video (backward compatibility)
 */
export async function extractYouTubeText(url: string): Promise<string> {
    const enhanced = await extractYouTubeTextEnhanced(url);
    return enhanced.transcript;
}

/**
 * Enhancement 4.B: Helper function to format timestamps for citations
 */
export function formatTimestamp(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    } else {
        return `${minutes}:${secs.toString().padStart(2, '0')}`;
    }
}

/**
 * Enhancement 4.B: Find relevant transcript segments for a given topic/quote
 */
export function findRelevantSegments(
    segmentedTranscript: TranscriptSegment[],
    searchText: string,
    contextBefore: number = 10,
    contextAfter: number = 10
): TranscriptSegment[] {
    const relevantSegments: TranscriptSegment[] = [];

    for (let i = 0; i < segmentedTranscript.length; i++) {
        const segment = segmentedTranscript[i];

        if (segment.text.toLowerCase().includes(searchText.toLowerCase())) {
            // Add context before
            const startIndex = Math.max(0, i - contextBefore);
            // Add context after
            const endIndex = Math.min(segmentedTranscript.length - 1, i + contextAfter);

            for (let j = startIndex; j <= endIndex; j++) {
                if (!relevantSegments.find(seg => seg.timestamp === segmentedTranscript[j].timestamp)) {
                    relevantSegments.push(segmentedTranscript[j]);
                }
            }
        }
    }

    return relevantSegments.sort((a, b) => a.timestamp - b.timestamp);
}

/**
 * Gets basic video metadata (title, duration) if needed
 */
export async function getVideoMetadata(url: string): Promise<{ title?: string; duration?: number }> {
    try {
        const title = await extractVideoTitle(url);
        return { title };
    } catch (error) {
        console.warn('[YouTube Processor] Could not fetch metadata:', error);
        return {};
    }
} 