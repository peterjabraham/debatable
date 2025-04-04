# Expert Types

**Document Version:** 1.0.0  
**Last Updated:** April 3, 2024  
**Compatible with:** 
- Next.js 15.0.0
- OpenAI 4.28.0
- ElevenLabs 1.51.0

## Overview

The Expert Types system manages the creation, selection, and behavior of different expert personas in debates. Debate-able supports two primary types of experts: Historical Figures and Domain Experts (AI). Each expert type has specialized knowledge, personality traits, and debate styles tailored to provide diverse perspectives.

## Architecture

```
                           ┌─────────────────┐
                           │                 │
                           │  Expert Type    │
                           │  Selection      │
                           │                 │
                           └────────┬────────┘
                                    │
                      ┌─────────────┴─────────────┐
                      │                           │
         ┌────────────▼───────────┐    ┌──────────▼───────────┐
         │                        │    │                      │
         │  Historical Figures    │    │  Domain Experts      │
         │                        │    │  (AI)                │
         └────────────┬───────────┘    └──────────┬───────────┘
                      │                           │
                      │                           │
         ┌────────────▼───────────┐    ┌──────────▼───────────┐
         │                        │    │                      │
         │  OpenAI Persona        │    │  OpenAI Persona      │
         │  Implementation        │    │  Implementation      │
         │                        │    │                      │
         └────────────┬───────────┘    └──────────┬───────────┘
                      │                           │
                      └─────────────┬─────────────┘
                                    │
                                    ▼
                          ┌──────────────────┐
                          │                  │
                          │  Voice           │
                          │  Synthesis       │
                          │  (Optional)      │
                          │                  │
                          └──────────────────┘
```

## Key Files

- `src/components/debate/ExpertTypeSelector.tsx`: Component for selecting expert types
- `src/components/debate/ExpertCard.tsx`: Component for displaying expert information
- `src/types/expert.ts`: Types and interfaces for expert data
- `src/lib/experts/expert-generator.ts`: Expert generation logic
- `src/lib/experts/historical-experts.ts`: Historical expert definitions
- `src/lib/experts/domain-experts.ts`: Domain expert definitions
- `src/lib/elevenlabs.ts`: Voice synthesis integration

## Core Types

### Expert Interface

```typescript
// src/types/expert.ts
export interface Expert {
  id: string;                      // Unique identifier
  name: string;                    // Expert name
  type: 'historical' | 'ai';       // Expert type
  background: string;              // Background/bio information
  expertise: string[];             // Areas of expertise
  stance: 'pro' | 'con' | 'neutral'; // Stance on the debate topic
  perspective?: string;            // Perspective on the topic
  identifier?: string;             // Optional API-friendly identifier
  voiceId?: string;                // Optional voice ID for synthesis
  sourceReferences?: SourceReference[]; // Optional sources for citations
}

export interface SourceReference {
  id: string;
  title: string;
  author?: string;
  publication?: string;
  year?: number;
  url?: string;
  content: string;
}
```

## Historical Experts

Historical experts represent real historical figures with their known perspectives and characteristics:

```typescript
// Example Historical Expert
{
  id: "hist_roosevelt_eleanor",
  name: "Eleanor Roosevelt",
  type: "historical",
  background: "Eleanor Roosevelt was an American political figure, diplomat, and activist who served as the First Lady of the United States from 1933 to 1945 during her husband President Franklin D. Roosevelt's four terms in office.",
  expertise: ["Human rights", "Diplomacy", "Social reform"],
  stance: "pro", // Dynamically assigned based on topic
  perspective: "I believe in the importance of human rights and social justice."
}
```

### Historical Expert Selection

Historical experts are selected based on their relevance to the debate topic:

```typescript
// Example selection algorithm
export function selectHistoricalExperts(topic: string, count: number = 2): Expert[] {
  // Calculate relevance scores for each expert based on topic keywords
  const scoredExperts = HISTORICAL_EXPERTS.map(expert => ({
    expert,
    score: calculateRelevanceScore(expert, topic)
  }));
  
  // Sort by relevance score
  const sortedExperts = scoredExperts.sort((a, b) => b.score - a.score);
  
  // Take top experts and assign stances to ensure balanced debate
  const selectedExperts = sortedExperts.slice(0, count);
  
  // Assign pro/con stances
  return assignStances(selectedExperts.map(se => se.expert), topic);
}
```

## Domain Experts (AI)

Domain experts are AI personas with specialized knowledge in specific fields:

```typescript
// Example Domain Expert
{
  id: "ai_climate_science",
  name: "AI Climate Science Expert",
  type: "ai",
  background: "Specializes in environmental science with expertise in climate change research and sustainability initiatives.",
  expertise: ["Climate change", "Biodiversity", "Sustainability"],
  stance: "pro", // Dynamically assigned based on topic
  perspective: "I examine climate issues through scientific analysis and evidence-based reasoning.",
  identifier: "AI-CSE4321" // API-friendly identifier
}
```

### Domain Expert Generation

For topics without predefined experts, the system can generate domain experts dynamically:

```typescript
// Example domain expert generation
export async function generateDomainExperts(topic: string): Promise<Expert[]> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4-turbo",
      messages: [
        {
          role: "system",
          content: "Generate two domain expert profiles for a debate on the given topic."
        },
        {
          role: "user",
          content: `Create two domain experts with opposing views for a debate on: ${topic}`
        }
      ],
      temperature: 0.7,
      response_format: { type: "json_object" }
    });
    
    const result = JSON.parse(response.choices[0].message.content);
    return result.experts.map((expert, index) => ({
      ...expert,
      id: `ai_generated_${index + 1}`,
      type: 'ai',
      stance: index === 0 ? 'pro' : 'con',
      identifier: `AI-${expert.name.substring(0, 3).toUpperCase()}${Math.floor(1000 + Math.random() * 9000)}`
    }));
  } catch (error) {
    console.error('Error generating domain experts:', error);
    // Fall back to predefined experts
    return selectDomainExperts(topic, 2);
  }
}
```

## Voice Synthesis

Optionally, experts can be assigned synthesized voices using ElevenLabs:

```typescript
// src/lib/elevenlabs.ts
export async function assignVoiceToExpert(expert: Expert): Promise<string> {
  try {
    // Create a new voice based on expert characteristics
    const response = await fetch('https://api.elevenlabs.io/v1/voices/add', {
      method: 'POST',
      headers: {
        'xi-api-key': process.env.ELEVENLABS_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: expert.name,
        description: `Voice for ${expert.name}, a ${expert.type === 'historical' ? 'historical figure' : 'domain expert'}.`,
        voice_settings: getVoiceSettings(expert)
      })
    });
    
    const data = await response.json();
    return data.voice_id;
  } catch (error) {
    console.error('Error assigning voice to expert:', error);
    // Return a default voice ID from the predefined pool
    return getDefaultVoice(expert.type);
  }
}
```

## Data Flow

1. **Expert Type Selection**:
   - User selects either Historical Figures or Domain Experts
   - System prepares to load the appropriate expert type

2. **Expert Selection/Generation**:
   - For historical experts: System selects from predefined list
   - For domain experts: System selects or generates based on topic
   - Pro/con stances are assigned to ensure balanced perspectives

3. **Voice Assignment** (Optional):
   - If voice synthesis is enabled, experts are assigned voices
   - Voices are selected based on expert characteristics

4. **Expert Initialization**:
   - Selected experts are initialized in the debate
   - Expert details are displayed in ExpertCard components
   - System begins generating expert responses based on personas

## Configuration

Expert types can be configured through environment variables:

```
# Expert generation configuration
DEFAULT_EXPERT_TYPE=historical  # 'historical' or 'ai'
ENABLE_DYNAMIC_EXPERT_GENERATION=true

# Voice synthesis (optional)
ENABLE_VOICE_SYNTHESIS=true
ELEVENLABS_API_KEY=your_elevenlabs_api_key
```

## Common Issues & Solutions

### Expert Relevance Issues
- Refine expert selection algorithms to better match topic keywords
- Expand the pool of predefined experts for better coverage
- Implement feedback mechanisms to improve expert selection over time

### Voice Synthesis Problems
- Cache synthesized voices to reduce API calls
- Provide fallback voices when API limits are reached
- Consider implementing a voice pooling system for reuse

## Related Components
- [Debate Engine](./Debate-Engine.md)
- [API Integration](../api/API-Integration.md) 