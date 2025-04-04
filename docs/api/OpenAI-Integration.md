# OpenAI Integration

**Document Version:** 1.0.0  
**Last Updated:** April 10, 2024  
**Compatible with:** 
- Next.js 15.0.0
- OpenAI 4.28.0
- Node.js 20.x

## Overview

The Debate-able application uses OpenAI's language models to generate expert responses, create debate content, and extract topics from various content sources. This document details how OpenAI is integrated into the application architecture.

## Integration Architecture

```
┌──────────────────┐      ┌────────────────┐      ┌──────────────────┐
│                  │      │                │      │                  │
│  Next.js API     │─────▶│  OpenAI        │─────▶│  OpenAI API      │
│  Routes          │◀─────│  Client        │◀─────│                  │
│                  │      │                │      │                  │
└──────────────────┘      └────────────────┘      └──────────────────┘
```

## Key Files

- `src/lib/openai.ts`: Main OpenAI client configuration
- `src/app/api/debate/response/route.ts`: API route for generating expert responses
- `src/app/api/content/document/route.ts`: API route for document processing
- `src/lib/content-processing/topic-extraction.ts`: Topic extraction using OpenAI
- `src/lib/experts/expert-generator.ts`: Expert generation using OpenAI

## Client Configuration

The OpenAI client is configured in a centralized file:

```typescript
// src/lib/openai.ts
import OpenAI from 'openai';

// Initialize the OpenAI client with API key from environment variables
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  organization: process.env.OPENAI_ORGANIZATION_ID, // Optional
  maxRetries: 3,
  timeout: 30 * 1000, // 30 seconds
});

// Mock implementation for development/testing
const mockOpenAI = {
  chat: {
    completions: {
      create: async (options: any) => {
        // Return mock responses based on input
        console.log('Using mock OpenAI implementation');
        // Mock implementation logic
        return {
          choices: [
            {
              message: {
                role: 'assistant',
                content: 'Mock response for development purposes.'
              }
            }
          ],
          usage: {
            prompt_tokens: 100,
            completion_tokens: 50,
            total_tokens: 150
          }
        };
      }
    }
  }
};

// Determine which implementation to use based on environment
const isProduction = process.env.NODE_ENV === 'production';
const hasApiKey = !!process.env.OPENAI_API_KEY;

// Export the appropriate client
export default isProduction && hasApiKey ? openai : mockOpenAI;

// Helper function to check if using mock implementation
export const isMockOpenAI = !isProduction || !hasApiKey;
```

## Core Functions

### Expert Response Generation

OpenAI is used to generate responses from debate experts:

```typescript
// Example from debate/response API route
export async function POST(request: NextRequest) {
  try {
    const { expert, messages, topic } = await request.json();
    
    // Validate input
    if (!expert || !messages || !topic) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }
    
    // Prepare system message with expert information
    const systemMessage = `You are ${expert.name}, ${expert.background}. 
    You are participating in a debate on the topic: "${topic}".
    Your stance is: ${expert.stance === 'pro' ? 'in favor of' : 'against'} this topic.
    Respond in a conversational but authoritative tone, drawing on your expertise.
    Keep responses concise (150-250 words) and focused.`;
    
    // Call OpenAI to generate a response
    const response = await openai.chat.completions.create({
      model: "gpt-4-turbo",
      messages: [
        { role: "system", content: systemMessage },
        ...messages.map(m => ({ 
          role: m.role as any, 
          content: m.content 
        })),
      ],
      temperature: 0.7,
      max_tokens: 500,
    });
    
    return NextResponse.json({ 
      response: response.choices[0].message.content,
      usage: response.usage
    });
  } catch (error: any) {
    console.error('Error generating expert response:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate response' },
      { status: 500 }
    );
  }
}
```

### Topic Extraction

OpenAI is used to extract debate topics from content:

```typescript
// Topic extraction function
export async function extractTopicsFromContent(content: string): Promise<Topic[]> {
  try {
    // Truncate content to fit within token limits
    const truncatedContent = truncateContent(content, 8000);
    
    const response = await openai.chat.completions.create({
      model: "gpt-4-turbo",
      messages: [
        {
          role: "system",
          content: `You are a topic extraction specialist. Analyze the provided text and identify 3-5 potential debate topics. 
          For each topic, provide:
          1. A concise title (5-10 words)
          2. A confidence score (0.0-1.0) indicating how suitable this is for debate
          3. 2-3 key arguments for debate consideration`
        },
        {
          role: "user",
          content: `Extract debate topics from the following content: ${truncatedContent}`
        }
      ],
      temperature: 0.5,
      response_format: { type: "json_object" }
    });
    
    const result = JSON.parse(response.choices[0].message.content || '{}');
    return result.topics || [];
  } catch (error) {
    console.error('Error extracting topics:', error);
    // Return empty array on error
    return [];
  }
}
```

### Expert Generation

For dynamic expert creation, OpenAI is used:

```typescript
// Expert generation function
export async function generateExpertsForTopic(topic: string): Promise<Expert[]> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4-turbo",
      messages: [
        {
          role: "system",
          content: `Create two expert profiles for a debate on the given topic. 
          One expert should be pro (in favor) and one con (against).
          Each expert should have:
          1. A name
          2. Background information
          3. Areas of expertise
          4. A perspective on the topic
          Format as JSON with fields: name, background, expertise (array), stance, perspective.`
        },
        {
          role: "user",
          content: `Generate experts for debate topic: ${topic}`
        }
      ],
      temperature: 0.7,
      response_format: { type: "json_object" }
    });
    
    const result = JSON.parse(response.choices[0].message.content || '{}');
    return result.experts.map((expert: any, index: number) => ({
      ...expert,
      id: `generated_${index}`,
      type: 'ai',
    }));
  } catch (error) {
    console.error('Error generating experts:', error);
    // Return fallback experts on error
    return getFallbackExperts(topic);
  }
}
```

## Model Selection

The application uses different OpenAI models for different functions:

| Function | Model | Rationale |
|----------|-------|-----------|
| Expert Responses | gpt-4-turbo | High quality responses needed for debate content |
| Topic Extraction | gpt-4-turbo | Complex task requiring nuanced understanding |
| Expert Generation | gpt-4-turbo | Requires creativity and knowledge |
| Summarization | gpt-3.5-turbo | Cost-effective for simpler tasks |

## Token Usage Management

To manage OpenAI token usage and costs:

1. **Content Truncation**
   - Long content is truncated before being sent to OpenAI
   - Custom truncation functions preserve the most relevant parts

2. **Response Limiting**
   - `max_tokens` parameter is set to limit response length
   - Temperature is adjusted based on required creativity vs precision

3. **Caching**
   - Common responses are cached to prevent duplicate API calls
   - Implemented using server-side caching with TTL

## Error Handling

OpenAI API errors are handled specifically:

```typescript
// Error handling example
try {
  const response = await openai.chat.completions.create({
    // Configuration
  });
  // Process response
} catch (error: any) {
  if (error.response) {
    // API responded with an error (rate limit, etc.)
    console.error('OpenAI API Error:', error.response.status, error.response.data);
    
    if (error.response.status === 429) {
      // Rate limit handling
      // Implement exponential backoff or fallback to cache
    }
  } else if (error.request) {
    // Request made but no response received (network error)
    console.error('OpenAI Network Error:', error.message);
  } else {
    // Other errors
    console.error('OpenAI Error:', error.message);
  }
  
  // Return fallback content or error response
}
```

## Configuration

OpenAI integration is configured through environment variables:

```
# OpenAI API configuration
OPENAI_API_KEY=your_openai_api_key
OPENAI_ORGANIZATION_ID=your_organization_id (optional)

# Model configuration
OPENAI_DEBATE_MODEL=gpt-4-turbo
OPENAI_SUMMARY_MODEL=gpt-3.5-turbo

# Feature flags
USE_MOCK_OPENAI=false
```

## Common Issues & Solutions

### Rate Limiting
- Implement exponential backoff for retries
- Use a token bucket algorithm to stay within rate limits
- Add request queuing for high-traffic periods

### Model Limitations
- Implement content chunking for long documents
- Use streaming for longer generations
- Fallback to smaller models during API outages

### Cost Management
- Implement token counting to estimate costs
- Set hard limits on API usage per user/session
- Cache common responses to reduce API calls

## Related Documentation
- [API Integration](./API-Integration.md)
- [Debate Engine](../features/Debate-Engine.md)
- [Content Processing](../features/Content-Processing.md) 