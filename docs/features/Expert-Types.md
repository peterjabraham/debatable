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

## Expert Selection Process

The expert selection process has been improved to ensure reliable operation in both development and production environments:

```typescript
// Expert selection with robust error handling
const selectExpertsWithTopic = async (directTopic: string) => {
    console.log('Selecting experts with direct topic:', directTopic);
    updateStepState('expertSelection', 'loading', 'Finding experts for this topic...');

    // Parse topic if it's structured data
    let topicTitle = directTopic;
    let topicArguments = [];
    
    if (typeof topicTitle === 'string' && topicTitle.startsWith('{') && topicTitle.includes('title')) {
        try {
            const parsedTopic = JSON.parse(topicTitle);
            topicTitle = parsedTopic.title || topicTitle;
            
            if (parsedTopic.data && parsedTopic.data.arguments) {
                topicArguments = parsedTopic.data.arguments;
            }
        } catch (e) {
            console.warn('Failed to parse topic as JSON:', e);
        }
    }
    
    try {
        // Use the proper API endpoint
        const apiEndpoint = '/api/debate-experts';
        console.log(`Using API endpoint: ${apiEndpoint}`);
        
        // API request with timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 20000); // 20 seconds timeout
        
        // Prepare request body with required parameters
        const requestBody = {
            action: 'select-experts',
            topic: topicTitle,
            expertType: expertType || 'ai',
            count: 2
        };
        
        console.log('Request body:', JSON.stringify(requestBody));
        
        // Make the API request
        const response = await fetch(apiEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify(requestBody),
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (response.ok) {
            const responseText = await response.text();
            const data = JSON.parse(responseText);
            
            if (data.experts && Array.isArray(data.experts) && data.experts.length > 0) {
                console.log(`Received ${data.experts.length} experts from API`);
                
                // Format experts properly
                const formattedExperts = data.experts.map(expert => ({
                    id: expert.id || uuidv4(),
                    name: expert.name,
                    expertise: expert.expertise || [],
                    stance: expert.stance || 'neutral',
                    background: expert.background || '',
                    voiceId: expert.voiceId || undefined
                }));
                
                console.log('Formatted experts:', formattedExperts);
                setExperts(formattedExperts);
                setExpertsSelected(true); // Important flag for UI
                updateStepState('expertSelection', 'success', 'Experts selected successfully');
                return formattedExperts;
            } else {
                console.warn('API response did not contain valid experts:', data);
                throw new Error('No experts found in API response');
            }
        } else {
            const errorText = await response.text();
            console.error(`API returned error ${response.status}:`, errorText);
            throw new Error(`API error: ${response.status} ${errorText.substring(0, 100)}`);
        }
    } catch (error) {
        console.error('Expert selection error:', error);
        
        // Environment-specific error handling
        if (process.env.NODE_ENV === 'production') {
            // In production, we don't show sample experts - we just show an error
            console.error('PRODUCTION MODE: Expert generation failed with no fallback');
            showError(createError(
                'EXPERT_GENERATION_ERROR',
                'Failed to generate experts. Our systems encountered an issue processing your topic. Please try again later or try a different topic.',
                'high',
                true,
                error instanceof Error ? error.message : String(error)
            ));
            updateStepState('expertSelection', 'error', 'Failed to generate experts');
            return;
        } else {
            // In development, we can fall back to mock experts
            console.warn('DEVELOPMENT MODE: Using sample experts as fallback');
            showWarning('Using Sample Experts', 'We encountered an issue generating custom experts for this topic. Using sample experts instead.');
            
            // Use mock experts as fallback in development
            const fallbackExperts = mockExperts.map(expert => ({
                ...expert,
                id: expert.id || uuidv4(),
            }));
            
            setExperts(fallbackExperts);
            setExpertsSelected(true);
            updateStepState('expertSelection', 'success', 'Sample experts loaded (fallback)');
            return fallbackExperts;
        }
    }
};
```

## API Integration

The Expert Types system integrates with API endpoints through a structured approach:

### API Endpoints

The primary endpoint for expert selection is `/api/debate-experts`. This endpoint accepts the following parameters:

```typescript
interface ExpertSelectionRequest {
    action: 'select-experts';     // Required action
    topic: string;                // Debate topic
    expertType: 'historical' | 'ai'; // Type of experts to select
    count?: number;               // Number of experts (default: 2)
    arguments?: string[];         // Optional debate arguments for context
}
```

The response format is:

```typescript
interface ExpertSelectionResponse {
    status: 'success' | 'error';
    experts?: Expert[];           // Array of selected experts
    error?: string;               // Error message if status is 'error'
    expertType?: 'historical' | 'ai'; // Type of experts returned
}
```

### API Diagnostics

The application includes a diagnostic tool to test API connectivity for expert selection:

```typescript
// Test API Endpoints button
<Button onClick={async () => {
    // API endpoints to test in order of preference
    const apiEndpoints = [
        '/api/debate-experts',     // Primary endpoint
        '/api/test-openai-real',   // OpenAI API connectivity test
        '/api/debate',             // Alternative debate endpoint
        '/api/debate/experts'      // Legacy endpoint
    ];
    
    // Test each endpoint with proper parameters
    for (const endpoint of apiEndpoints) {
        try {
            const response = await fetch(endpoint, {
                method: endpoint === '/api/test-openai-real' ? 'GET' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: endpoint === '/api/test-openai-real' ? undefined : JSON.stringify({
                    action: 'select-experts',
                    topic: topicTitle,
                    expertType: expertType,
                    count: 2
                })
            });
            
            // Log results for debugging
            console.log(`Response from ${endpoint}: ${response.status}`);
            
            if (response.ok) {
                const data = await response.json();
                console.log(`Data from ${endpoint}:`, data);
            }
        } catch (error) {
            console.error(`Error with ${endpoint}:`, error);
        }
    }
}}>
    Test API Endpoints
</Button>
```

## Environmental Differences

The Expert Types system handles expert selection differently based on the environment:

### Production Mode

In production:
- Real API endpoints are always used
- No fallback to mock experts
- Clear error messages for users if API calls fail
- Retry button allows users to attempt expert generation again
- Timeout handling prevents infinite loading

```typescript
// Production mode error handling
if (process.env.NODE_ENV === 'production') {
    console.error('PRODUCTION MODE: Expert generation failed');
    showError(createError(
        'EXPERT_GENERATION_ERROR',
        'Failed to generate experts. Please try again or try a different topic.',
        'high',
        true
    ));
    updateStepState('expertSelection', 'error', 'Failed to generate experts');
}
```

### Development Mode

In development:
- Attempts real API endpoints first
- Falls back to mock experts if API calls fail
- Shows warning to indicate using sample experts
- Allows testing with different mock expert types 