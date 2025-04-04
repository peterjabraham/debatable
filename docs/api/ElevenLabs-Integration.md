# ElevenLabs Integration

**Document Version:** 1.0.0  
**Last Updated:** April 10, 2024  
**Compatible with:** 
- Next.js 15.0.0
- Node.js 20.x
- ElevenLabs API v1

## Overview

The Debate-able application integrates with ElevenLabs to provide voice synthesis capabilities for debate experts. This optional feature adds an auditory dimension to debates, helping users distinguish between experts and creating a more engaging experience. This document details the implementation of the ElevenLabs integration.

## Integration Architecture

```
┌──────────────────┐      ┌────────────────┐      ┌──────────────────┐
│                  │      │                │      │                  │
│  Next.js API     │─────▶│  ElevenLabs    │─────▶│  ElevenLabs      │
│  Routes          │◀─────│  Client        │◀─────│  API             │
│                  │      │                │      │                  │
└──────────────────┘      └────────────────┘      └──────────────────┘
```

## Key Files

- `src/lib/elevenlabs.ts`: ElevenLabs API client implementation
- `src/app/api/voice/synthesize/route.ts`: API route for text-to-speech conversion
- `src/app/api/voice/voices/route.ts`: API route for available voices
- `src/components/debate/VoiceControls.tsx`: UI components for voice control
- `src/lib/hooks/useVoiceSynthesis.ts`: React hook for voice functionality

## Client Implementation

The ElevenLabs client is implemented in a centralized file:

```typescript
// src/lib/elevenlabs.ts
import { Expert } from '@/types/expert';

const ELEVENLABS_API_URL = 'https://api.elevenlabs.io/v1';

/**
 * Get available voices from ElevenLabs
 */
export async function getAvailableVoices(): Promise<any[]> {
  try {
    // Check if API key is available
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      console.warn('Missing ElevenLabs API key. Voice features will be disabled.');
      return [];
    }
    
    const response = await fetch(`${ELEVENLABS_API_URL}/voices`, {
      method: 'GET',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json'
      },
    });
    
    if (!response.ok) {
      throw new Error(`ElevenLabs API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.voices || [];
  } catch (error) {
    console.error('Error fetching ElevenLabs voices:', error);
    return [];
  }
}

/**
 * Map voice characteristics to experts
 */
export function assignVoicesToExperts(experts: Expert[], availableVoices: any[]): Expert[] {
  // If no voices are available, return experts unchanged
  if (!availableVoices || availableVoices.length === 0) {
    return experts;
  }
  
  // Create a copy of experts to modify
  const expertsWithVoices = [...experts];
  
  // Assign a distinct voice to each expert
  expertsWithVoices.forEach((expert, index) => {
    // Use modulo to cycle through available voices if there are more experts than voices
    const voiceIndex = index % availableVoices.length;
    expert.voiceId = availableVoices[voiceIndex].voice_id;
  });
  
  return expertsWithVoices;
}

/**
 * Convert text to speech using ElevenLabs
 */
export async function synthesizeSpeech(text: string, voiceId: string): Promise<ArrayBuffer | null> {
  try {
    // Check if API key is available
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      console.warn('Missing ElevenLabs API key. Voice synthesis is disabled.');
      return null;
    }
    
    // Check if text and voiceId are provided
    if (!text || !voiceId) {
      console.error('Missing required parameters for speech synthesis.');
      return null;
    }
    
    // Prepare request body
    const requestBody = {
      text,
      model_id: 'eleven_multilingual_v2',
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75,
        style: 0.0,
        use_speaker_boost: true
      }
    };
    
    // Make API request
    const response = await fetch(`${ELEVENLABS_API_URL}/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
        'Accept': 'audio/mpeg'
      },
      body: JSON.stringify(requestBody)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`ElevenLabs API error: ${response.status} ${response.statusText} - ${errorText}`);
    }
    
    // Return audio data as ArrayBuffer
    return await response.arrayBuffer();
  } catch (error) {
    console.error('Error synthesizing speech:', error);
    return null;
  }
}

/**
 * Get voice settings for an expert based on their characteristics
 */
export function getVoiceSettings(expert: Expert): any {
  // Customize voice settings based on expert type, stance, etc.
  const defaultSettings = {
    stability: 0.5,
    similarity_boost: 0.75,
    style: 0.0,
    use_speaker_boost: true
  };
  
  // Adjust settings based on expert characteristics
  if (expert.type === 'historical') {
    // Historical figures get more dignified, stable voices
    return {
      ...defaultSettings,
      stability: 0.75,
      style: 0.1
    };
  } else if (expert.stance === 'pro') {
    // Pro stance gets more enthusiastic voice
    return {
      ...defaultSettings,
      stability: 0.4,
      style: 0.2
    };
  } else if (expert.stance === 'con') {
    // Con stance gets more measured, authoritative voice
    return {
      ...defaultSettings,
      stability: 0.6,
      style: -0.1
    };
  }
  
  return defaultSettings;
}

/**
 * Check if voice synthesis is enabled
 */
export function isVoiceSynthesisEnabled(): boolean {
  const elevenlabsApiKey = process.env.ELEVENLABS_API_KEY;
  const enableVoiceFlag = process.env.ENABLE_VOICE_SYNTHESIS;
  
  return !!elevenlabsApiKey && enableVoiceFlag !== 'false';
}
```

## API Route Implementation

The ElevenLabs integration includes API routes for voice synthesis:

```typescript
// src/app/api/voice/synthesize/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { synthesizeSpeech } from '@/lib/elevenlabs';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // Parse request body
    const { text, voiceId } = await request.json();
    
    // Validate input
    if (!text || !voiceId) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }
    
    // Limit text length to prevent abuse
    const maxTextLength = 500;
    const truncatedText = text.slice(0, maxTextLength);
    
    // Synthesize speech
    const audioData = await synthesizeSpeech(truncatedText, voiceId);
    
    if (!audioData) {
      return NextResponse.json(
        { error: 'Failed to synthesize speech' },
        { status: 500 }
      );
    }
    
    // Return audio data with appropriate headers
    const response = new NextResponse(audioData);
    response.headers.set('Content-Type', 'audio/mpeg');
    response.headers.set('Content-Length', audioData.byteLength.toString());
    return response;
  } catch (error: any) {
    console.error('Error in voice synthesis API:', error);
    
    return NextResponse.json(
      { error: error.message || 'Error synthesizing speech' },
      { status: 500 }
    );
  }
}
```

## Front-End Integration

The voice synthesis is integrated into the UI through a custom React hook:

```typescript
// src/lib/hooks/useVoiceSynthesis.ts
import { useState, useRef, useCallback } from 'react';
import { Expert } from '@/types/expert';

export function useVoiceSynthesis() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  // Initialize audio element if needed
  const initAudio = useCallback(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
      
      // Set up event listeners
      audioRef.current.onended = () => setIsPlaying(false);
      audioRef.current.onerror = () => {
        setIsPlaying(false);
        setError('Audio playback error');
      };
    }
  }, []);
  
  // Speak text using an expert's voice
  const speak = useCallback(async (text: string, expert: Expert) => {
    try {
      // Check if expert has a voiceId
      if (!expert.voiceId) {
        setError('No voice assigned to this expert');
        return;
      }
      
      // Initialize audio element
      initAudio();
      
      // Prepare for new speech
      if (isPlaying && audioRef.current) {
        audioRef.current.pause();
      }
      
      setIsLoading(true);
      setError(null);
      
      // Request speech synthesis
      const response = await fetch('/api/voice/synthesize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voiceId: expert.voiceId }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Speech synthesis failed');
      }
      
      // Get audio data as blob
      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      
      // Play the audio
      if (audioRef.current) {
        audioRef.current.src = audioUrl;
        audioRef.current.play();
        setIsPlaying(true);
      }
    } catch (error: any) {
      console.error('Error in speech synthesis:', error);
      setError(error.message || 'Failed to synthesize speech');
    } finally {
      setIsLoading(false);
    }
  }, [initAudio, isPlaying]);
  
  // Stop current speech
  const stop = useCallback(() => {
    if (audioRef.current && isPlaying) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsPlaying(false);
    }
  }, [isPlaying]);
  
  return { speak, stop, isPlaying, isLoading, error };
}
```

## Voice Control Component

A Voice Control component provides the UI for voice synthesis:

```typescript
// src/components/debate/VoiceControls.tsx
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/tooltip';
import { VolumeIcon, VolumeXIcon } from 'lucide-react';
import { useVoiceSynthesis } from '@/lib/hooks/useVoiceSynthesis';
import { Expert } from '@/types/expert';
import { Message } from '@/types/message';

interface VoiceControlsProps {
  expert: Expert;
  message: Message;
}

export default function VoiceControls({ expert, message }: VoiceControlsProps) {
  const { speak, stop, isPlaying, isLoading, error } = useVoiceSynthesis();
  const [isVoiceEnabled, setIsVoiceEnabled] = useState<boolean>(false);
  
  // Check if voice synthesis is available for this expert
  useEffect(() => {
    setIsVoiceEnabled(!!expert.voiceId);
  }, [expert]);
  
  // Handle play button click
  const handlePlay = async () => {
    if (isPlaying) {
      stop();
    } else {
      await speak(message.content, expert);
    }
  };
  
  // If voice synthesis is not enabled, don't render the component
  if (!isVoiceEnabled) {
    return null;
  }
  
  return (
    <Tooltip content={isPlaying ? 'Stop voice' : 'Play voice'}>
      <Button
        variant="ghost"
        size="sm"
        onClick={handlePlay}
        disabled={isLoading}
        aria-label={isPlaying ? 'Stop voice' : 'Play message with voice'}
        className="h-8 w-8 p-0"
      >
        {isPlaying ? (
          <VolumeXIcon className="h-4 w-4" />
        ) : (
          <VolumeIcon className="h-4 w-4" />
        )}
      </Button>
    </Tooltip>
  );
}
```

## Feature Usage

The ElevenLabs integration is primarily used in two ways:

1. **Expert Voices Assignment**
   - When experts are selected for a debate, they are assigned voices
   - Voice characteristics are matched to expert traits

2. **Message Playback**
   - Users can listen to expert messages via voice synthesis
   - Voice controls appear alongside each message

## Error Handling

Specific error handling is implemented for ElevenLabs integration:

```typescript
// Example error handling in voice synthesis
try {
  // Voice synthesis code
} catch (error: any) {
  // Check for specific error types
  if (error.message.includes('rate limit')) {
    console.error('ElevenLabs rate limit exceeded:', error);
    // Display user-friendly message
    return { error: 'Voice synthesis temporarily unavailable. Please try again later.' };
  } else if (error.message.includes('invalid voice_id')) {
    console.error('Invalid voice ID:', error);
    // Log and return appropriate error
    return { error: 'Selected voice is unavailable' };
  } else {
    // Generic error handling
    console.error('ElevenLabs error:', error);
    return { error: 'Voice synthesis failed' };
  }
}
```

## Configuration

ElevenLabs integration is configured through environment variables:

```
# ElevenLabs API configuration
ELEVENLABS_API_KEY=your_elevenlabs_api_key

# Feature flags
ENABLE_VOICE_SYNTHESIS=true

# Voice settings
DEFAULT_VOICE_STABILITY=0.5
DEFAULT_VOICE_SIMILARITY_BOOST=0.75
```

## Fallback Mechanism

For cases where voice synthesis fails or is unavailable, the application gracefully degrades:

```typescript
// Example of graceful degradation
const playMessage = async (message: Message, expert: Expert) => {
  // Check if voice synthesis is enabled
  if (isVoiceSynthesisEnabled() && expert.voiceId) {
    try {
      await speak(message.content, expert);
    } catch (error) {
      console.error('Voice synthesis failed, falling back to text-only mode:', error);
      // Voice synthesis failed, but the application continues in text-only mode
      setVoiceSynthesisFailed(true);
    }
  } else {
    // Voice synthesis not enabled, use text-only mode
    console.log('Voice synthesis not enabled, using text-only mode');
  }
};
```

## Mock Implementation

For development and testing, a mock implementation is provided:

```typescript
// src/lib/mock/elevenlabs-mock.ts
import { Expert } from '@/types/expert';

/**
 * Mock implementation for ElevenLabs voice functionality
 */
export async function mockGetAvailableVoices(): Promise<any[]> {
  // Simulate API latency
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Return mock voices
  return [
    {
      voice_id: 'mock_voice_1',
      name: 'Mock Voice 1',
      category: 'premade',
      description: 'A mock voice for testing purposes'
    },
    {
      voice_id: 'mock_voice_2',
      name: 'Mock Voice 2',
      category: 'premade',
      description: 'Another mock voice for testing purposes'
    }
  ];
}

/**
 * Mock implementation for speech synthesis
 */
export async function mockSynthesizeSpeech(text: string, voiceId: string): Promise<ArrayBuffer | null> {
  // Log the mock request
  console.log(`Mock synthesizing speech: "${text.substring(0, 50)}..." using voice ID: ${voiceId}`);
  
  // Simulate API latency
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Return a mock ArrayBuffer (empty, as it won't be played)
  return new ArrayBuffer(0);
}

/**
 * Mock implementation for voice assignment
 */
export function mockAssignVoicesToExperts(experts: Expert[]): Expert[] {
  // Create a copy of experts to modify
  const expertsWithVoices = [...experts];
  
  // Assign mock voices to experts
  expertsWithVoices.forEach((expert, index) => {
    expert.voiceId = `mock_voice_${(index % 2) + 1}`;
  });
  
  return expertsWithVoices;
}
```

## Common Issues & Solutions

### API Rate Limiting

ElevenLabs has rate limits that can affect heavy usage.

**Solution:**
- Implement request queueing to stay within rate limits
- Cache frequently spoken phrases
- Provide clear feedback to users when rate limits are reached

### Voice Quality Inconsistencies

Voice quality can vary depending on the text and voice settings.

**Solution:**
- Optimize voice settings for different expert types
- Use punctuation and formatting to improve speech quality
- Keep messages concise for better synthesis results

### Incompatible Audio Formats

Some browsers may have issues with certain audio formats.

**Solution:**
- Use widely supported audio formats (MP3)
- Add fallback formats for broader compatibility
- Include proper error handling for playback issues

## Related Documentation
- [API Integration](./API-Integration.md)
- [Debate Engine](../features/Debate-Engine.md)
- [Expert Types](../features/Expert-Types.md) 