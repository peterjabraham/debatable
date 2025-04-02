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

export async function POST(request: NextRequest) {
    try {
        // Skip forwarding to the Express server if it's not available
        if (!MVP_CONFIG.apiServerAvailable) {
            console.log('[Voice API] Backend server unavailable, returning mock audio blob');

            // Create a small dummy audio blob (empty WAV file)
            // This is a minimal valid WAV file header
            const dummyWavHeader = new Uint8Array([
                0x52, 0x49, 0x46, 0x46, // "RIFF"
                0x24, 0x00, 0x00, 0x00, // file size - 36 bytes (excluding this and RIFF header)
                0x57, 0x41, 0x56, 0x45, // "WAVE"
                0x66, 0x6D, 0x74, 0x20, // "fmt "
                0x10, 0x00, 0x00, 0x00, // fmt chunk size: 16 bytes
                0x01, 0x00,             // format: 1 (PCM)
                0x01, 0x00,             // channels: 1
                0x44, 0xAC, 0x00, 0x00, // sample rate: 44100 Hz
                0x88, 0x58, 0x01, 0x00, // byte rate: 44100 * 2
                0x02, 0x00,             // block align: 2 bytes
                0x10, 0x00,             // bits per sample: 16
                0x64, 0x61, 0x74, 0x61, // "data"
                0x00, 0x00, 0x00, 0x00  // data chunk size: 0 bytes
            ]);

            return new NextResponse(dummyWavHeader, {
                status: 200,
                headers: {
                    'Content-Type': 'audio/wav',
                },
            });
        }

        // If the backend server is available, forward the request
        // This code won't execute when the server is unavailable
        const { text, voiceId } = await request.json();

        // Forward to the Express server
        const response = await fetch(`${MVP_CONFIG.apiUrl}/api/voice`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text, voiceId }),
        });

        if (!response.ok) {
            throw new Error(`Voice API failed with status: ${response.status}`);
        }

        const audioBlob = await response.blob();
        return new NextResponse(audioBlob, {
            status: 200,
            headers: {
                'Content-Type': 'audio/mpeg',
            },
        });
    } catch (error) {
        console.error('[Voice API] Error:', error);
        return NextResponse.json(
            { error: 'Failed to synthesize voice' },
            { status: 500 }
        );
    }
} 