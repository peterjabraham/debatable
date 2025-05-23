import { YoutubeTranscript } from 'youtube-transcript';

export interface YouTubeVideoInfo {
    id: string;
    title?: string;
    duration?: number;
    transcript: string;
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
 * Fetches transcript from YouTube video
 */
export async function extractYouTubeText(url: string): Promise<string> {
    console.log(`[YouTube Processor] Processing YouTube URL: ${url}`);

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
        // Fetch transcript
        const transcriptArray = await YoutubeTranscript.fetchTranscript(url);

        if (!transcriptArray || transcriptArray.length === 0) {
            throw new Error('No transcript available for this video. The video may not have captions enabled.');
        }

        // Combine all transcript segments into one text
        const fullTranscript = transcriptArray
            .map(segment => segment.text)
            .join(' ')
            .replace(/\s+/g, ' ') // Clean up multiple spaces
            .trim();

        if (fullTranscript.length < 50) {
            throw new Error('Transcript is too short to extract meaningful topics');
        }

        console.log(`[YouTube Processor] Successfully extracted transcript: ${fullTranscript.length} characters`);
        return fullTranscript;

    } catch (error: any) {
        console.error(`[YouTube Processor] Error fetching transcript:`, error);

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
 * Gets basic video metadata (title, duration) if needed
 */
export async function getVideoMetadata(url: string): Promise<{ title?: string; duration?: number }> {
    // This is a placeholder for potential future enhancement
    // We could use YouTube Data API here if needed
    // For now, we'll return empty metadata
    return {};
} 