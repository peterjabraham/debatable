import { NextRequest, NextResponse } from 'next/server';
import { textToSpeech, getVoices, synthesizeSpeech } from '@/lib/elevenlabs';
import { MVP_CONFIG } from '@/lib/config';

// Helper function to safely stringify objects
function safeStringify(obj: any): string {
    try {
        return JSON.stringify(obj, null, 2);
    } catch (error) {
        return `[Error stringifying object: ${error}]`;
    }
}

export async function POST(request: Request) {
    try {
        const { text, voiceId } = await request.json();

        if (!text || !voiceId) {
            return NextResponse.json(
                { error: 'Missing required fields: text and voiceId' },
                { status: 400 }
            );
        }

        // Synthesize speech using ElevenLabs
        const audioBlob = await synthesizeSpeech(text, voiceId);
        if (!audioBlob) {
            return NextResponse.json(
                { error: 'Failed to synthesize speech' },
                { status: 500 }
            );
        }

        // Return the audio blob
        return new NextResponse(audioBlob, {
            headers: {
                'Content-Type': 'audio/mpeg',
                'Content-Length': audioBlob.size.toString()
            }
        });

    } catch (error) {
        console.error('[Voice API] Error:', error);
        return NextResponse.json(
            { error: 'Failed to synthesize speech' },
            { status: 500 }
        );
    }
} 