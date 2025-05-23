import Parser from 'rss-parser';
import fetch from 'node-fetch';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import openai from '@/lib/ai/openai-client';

export interface PodcastEpisode {
    title: string;
    description?: string;
    audioUrl: string;
    duration?: number;
    pubDate?: string;
}

/**
 * Validates if a URL is a valid podcast RSS feed URL
 */
export function validatePodcastUrl(url: string): boolean {
    // Basic URL validation - could be enhanced with more specific RSS validation
    try {
        new URL(url);
        return true;
    } catch {
        return false;
    }
}

/**
 * Parses RSS feed to get podcast episode information
 */
export async function parsePodcastRss(url: string): Promise<PodcastEpisode[]> {
    console.log(`[Podcast Processor] Parsing RSS feed: ${url}`);

    if (!validatePodcastUrl(url)) {
        throw new Error('Invalid podcast URL format');
    }

    const rssParser = new Parser();

    try {
        const feed = await rssParser.parseURL(url);

        if (!feed.items || feed.items.length === 0) {
            throw new Error('No episodes found in podcast feed');
        }

        // Map RSS items to our PodcastEpisode interface
        const episodes: PodcastEpisode[] = feed.items.map(item => ({
            title: item.title || 'Untitled Episode',
            description: item.content || item.contentSnippet || item.summary,
            audioUrl: item.enclosure?.url || '',
            duration: item.enclosure?.length ? parseInt(item.enclosure.length) : undefined,
            pubDate: item.pubDate
        })).filter(episode => episode.audioUrl); // Only include episodes with audio

        if (episodes.length === 0) {
            throw new Error('No episodes with audio URLs found in the feed');
        }

        console.log(`[Podcast Processor] Found ${episodes.length} episodes in feed`);
        return episodes;

    } catch (error: any) {
        console.error(`[Podcast Processor] Error parsing RSS feed:`, error);
        throw new Error(`Failed to parse podcast RSS feed: ${error.message}`);
    }
}

/**
 * Downloads audio file to a temporary location
 */
export async function downloadPodcastAudio(audioUrl: string): Promise<string> {
    console.log(`[Podcast Processor] Downloading audio from: ${audioUrl}`);

    try {
        const response = await fetch(audioUrl);

        if (!response.ok) {
            throw new Error(`Failed to download audio: ${response.statusText}`);
        }

        // Get content type to determine file extension
        const contentType = response.headers.get('content-type') || '';
        let extension = '.mp3'; // Default

        if (contentType.includes('audio/wav')) {
            extension = '.wav';
        } else if (contentType.includes('audio/m4a') || contentType.includes('audio/mp4')) {
            extension = '.m4a';
        } else if (contentType.includes('audio/ogg')) {
            extension = '.ogg';
        }

        // Create temporary file
        const tempFileName = `podcast_audio_${Date.now()}${extension}`;
        const tempFilePath = path.join(os.tmpdir(), tempFileName);

        // Download and save file
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        await fs.writeFile(tempFilePath, buffer);

        console.log(`[Podcast Processor] Audio downloaded to: ${tempFilePath}`);
        return tempFilePath;

    } catch (error: any) {
        console.error(`[Podcast Processor] Error downloading audio:`, error);
        throw new Error(`Failed to download podcast audio: ${error.message}`);
    }
}

/**
 * Transcribes audio file using OpenAI Whisper
 */
export async function transcribeAudio(filePath: string): Promise<string> {
    console.log(`[Podcast Processor] Transcribing audio file: ${filePath}`);

    try {
        // Check if file exists and get stats
        const stats = await fs.stat(filePath);
        const fileSizeInMB = stats.size / (1024 * 1024);

        console.log(`[Podcast Processor] File size: ${fileSizeInMB.toFixed(2)} MB`);

        // OpenAI Whisper has a 25MB file size limit
        if (fileSizeInMB > 25) {
            throw new Error('Audio file is too large for transcription (max 25MB). Please try a shorter episode.');
        }

        // Create a readable stream for the file
        const fileStream = await fs.readFile(filePath);

        // Use OpenAI Whisper for transcription
        const transcription = await openai.audio.transcriptions.create({
            file: new File([fileStream], path.basename(filePath)),
            model: 'whisper-1',
            response_format: 'text'
        });

        if (!transcription || typeof transcription !== 'string') {
            throw new Error('No transcription returned from OpenAI');
        }

        if (transcription.trim().length < 50) {
            throw new Error('Transcription is too short to extract meaningful topics');
        }

        console.log(`[Podcast Processor] Transcription completed: ${transcription.length} characters`);
        return transcription.trim();

    } catch (error: any) {
        console.error(`[Podcast Processor] Error transcribing audio:`, error);

        if (error.message.includes('file size')) {
            throw error; // Pass through file size errors as-is
        } else {
            throw new Error(`Failed to transcribe audio: ${error.message}`);
        }
    }
}

/**
 * Cleans up temporary files
 */
export async function cleanupTempFile(filePath: string): Promise<void> {
    try {
        await fs.unlink(filePath);
        console.log(`[Podcast Processor] Cleaned up temp file: ${filePath}`);
    } catch (error) {
        console.warn(`[Podcast Processor] Could not cleanup temp file ${filePath}:`, error);
        // Don't throw - cleanup failure shouldn't break the main process
    }
}

/**
 * Main function to extract text from podcast RSS feed
 */
export async function extractPodcastText(url: string, episodeIndex: number = 0): Promise<string> {
    console.log(`[Podcast Processor] Processing podcast URL: ${url}`);

    let tempFilePath: string | null = null;

    try {
        // Parse RSS feed to get episodes
        const episodes = await parsePodcastRss(url);

        if (episodeIndex >= episodes.length) {
            throw new Error(`Episode index ${episodeIndex} not found. Feed has ${episodes.length} episodes.`);
        }

        const episode = episodes[episodeIndex];
        console.log(`[Podcast Processor] Processing episode: ${episode.title}`);

        // Download audio
        tempFilePath = await downloadPodcastAudio(episode.audioUrl);

        // Transcribe audio
        const transcript = await transcribeAudio(tempFilePath);

        // Clean up temp file
        await cleanupTempFile(tempFilePath);
        tempFilePath = null;

        return transcript;

    } catch (error: any) {
        // Ensure cleanup even if process fails
        if (tempFilePath) {
            await cleanupTempFile(tempFilePath);
        }

        console.error(`[Podcast Processor] Error processing podcast:`, error);
        throw error;
    }
} 