import { Voice } from 'elevenlabs/types';

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const API_URL = 'https://api.elevenlabs.io/v1';

// ElevenLabs pricing (as of March 2024)
const COST_PER_1K_CHARS = 0.30; // $0.30 per 1000 characters

export interface ElevenLabsUsage {
    characterCount: number;
    cost: number; // in USD
}

function calculateElevenLabsCost(characterCount: number): ElevenLabsUsage {
    return {
        characterCount,
        cost: (characterCount / 1000) * COST_PER_1K_CHARS
    };
}

// Default voice IDs for our experts
const DEFAULT_VOICES = {
    male1: "pNInz6obpgDQGcFmaJgB", // Adam
    male2: "ErXwobaYiN019PkySvjV", // Antoni
    female1: "EXAVITQu4vr4xnSDxMaL", // Bella
    female2: "21m00Tcm4TlvDq8ikWAM", // Rachel
};

export interface VoiceSettings {
    stability: number;
    similarity_boost: number;
    style: number;
    use_speaker_boost: boolean;
}

const defaultVoiceSettings: VoiceSettings = {
    stability: 0.5,
    similarity_boost: 0.75,
    style: 0.5,
    use_speaker_boost: true,
};

// This is a wrapper function that uses textToSpeech - it's imported in the voice route
export async function synthesizeSpeech(
    text: string,
    voiceId: string
): Promise<{ audio: ArrayBuffer; usage: ElevenLabsUsage }> {
    try {
        const { audioBuffer, usage } = await textToSpeech(text, voiceId);
        return {
            audio: audioBuffer,
            usage
        };
    } catch (error) {
        console.error('Error in synthesizeSpeech:', error);
        throw new Error(`Failed to synthesize speech: ${error.message}`);
    }
}

export async function textToSpeech(
    text: string,
    voiceId: string = DEFAULT_VOICES.male1,
    settings: Partial<VoiceSettings> = {}
): Promise<{ audioBuffer: ArrayBuffer; usage: ElevenLabsUsage }> {
    // Validate API key
    if (!ELEVENLABS_API_KEY) {
        console.error('ElevenLabs API key validation failed:', {
            hasKey: !!ELEVENLABS_API_KEY,
            envKeys: Object.keys(process.env),
            nodeEnv: process.env.NODE_ENV
        });
        throw new Error('ELEVENLABS_API_KEY is not configured in environment variables');
    }

    // Validate input parameters
    if (!text?.trim()) {
        throw new Error('Text is required for speech synthesis');
    }

    if (!voiceId?.trim()) {
        throw new Error('Voice ID is required for speech synthesis');
    }

    const trimmedText = text.trim();
    const requestId = Math.random().toString(36).substring(7);
    const usage = calculateElevenLabsCost(trimmedText.length);

    console.log(`[${requestId}] Preparing ElevenLabs request:`, {
        voiceId,
        textLength: trimmedText.length,
        textPreview: trimmedText.substring(0, 100) + '...',
        hasApiKey: !!ELEVENLABS_API_KEY,
        settings: { ...defaultVoiceSettings, ...settings },
        usage
    });

    try {
        const requestBody = {
            text: trimmedText,
            model_id: 'eleven_multilingual_v2',
            voice_settings: { ...defaultVoiceSettings, ...settings },
        };

        const url = `${API_URL}/text-to-speech/${voiceId}/stream`;
        console.log(`[${requestId}] Making request to:`, url);

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'xi-api-key': ELEVENLABS_API_KEY,
                'Accept': 'audio/mpeg',
            },
            body: JSON.stringify(requestBody),
        });

        console.log(`[${requestId}] ElevenLabs response:`, {
            status: response.status,
            statusText: response.statusText,
            headers: Object.fromEntries(response.headers.entries()),
        });

        if (!response.ok) {
            let errorMessage = `ElevenLabs API error: ${response.status} ${response.statusText}`;
            let errorDetails = {};

            try {
                const errorData = await response.json();
                console.error(`[${requestId}] ElevenLabs error details:`, errorData);
                errorDetails = errorData;

                if (errorData.detail) {
                    errorMessage += ` - ${errorData.detail}`;
                }
                if (errorData.message) {
                    errorMessage += ` - ${errorData.message}`;
                }
            } catch (e) {
                console.error(`[${requestId}] Failed to parse error response:`, e);
                try {
                    const rawText = await response.text();
                    console.error(`[${requestId}] Raw error response:`, rawText);
                    errorMessage += ` - Raw response: ${rawText}`;
                } catch (textError) {
                    console.error(`[${requestId}] Failed to get raw error response:`, textError);
                }
            }

            throw new Error(errorMessage);
        }

        const contentType = response.headers.get('content-type');
        if (!contentType?.includes('audio/')) {
            throw new Error(`Unexpected content type from ElevenLabs API: ${contentType}`);
        }

        const audioBuffer = await response.arrayBuffer();
        if (!audioBuffer || audioBuffer.byteLength === 0) {
            throw new Error('Received empty audio buffer from ElevenLabs API');
        }

        console.log(`[${requestId}] Successfully generated speech:`, {
            size: audioBuffer.byteLength,
            contentType,
            usage
        });

        return { audioBuffer, usage };
    } catch (error) {
        console.error(`[${requestId}] Error in textToSpeech:`, {
            error: error instanceof Error ? {
                name: error.name,
                message: error.message,
                stack: error.stack,
            } : 'Unknown error',
            voiceId,
            textLength: trimmedText.length,
            usage
        });
        throw error;
    }
}

export async function getVoices(): Promise<Voice[]> {
    if (!ELEVENLABS_API_KEY) {
        throw new Error('ELEVENLABS_API_KEY is not configured in environment variables');
    }

    try {
        console.log('Fetching voices from ElevenLabs API');
        const response = await fetch(`${API_URL}/voices`, {
            headers: {
                'xi-api-key': ELEVENLABS_API_KEY,
                'Accept': 'application/json',
            },
        });

        if (!response.ok) {
            let errorMessage = `Failed to fetch voices: ${response.status} ${response.statusText}`;
            try {
                const errorData = await response.json();
                if (errorData.detail) {
                    errorMessage += ` - ${errorData.detail}`;
                }
            } catch (e) {
                console.error('Failed to parse error response:', e);
            }
            throw new Error(errorMessage);
        }

        const data = await response.json();
        if (!data.voices || !Array.isArray(data.voices)) {
            throw new Error('Invalid response format from ElevenLabs API');
        }

        console.log('Successfully fetched voices:', {
            count: data.voices.length,
        });

        return data.voices;
    } catch (error) {
        console.error('Error fetching voices:', {
            error: error instanceof Error ? error.message : 'Unknown error',
        });
        throw error;
    }
}

// Helper function to assign voices to experts
export function assignVoiceToExpert(expertName: string, index: number): string {
    // Simple logic to assign voices based on the expert's index
    const voices = [DEFAULT_VOICES.male1, DEFAULT_VOICES.male2];
    return voices[index % voices.length];
}

export default {
    textToSpeech,
    getVoices,
    assignVoiceToExpert,
    DEFAULT_VOICES,
}; 