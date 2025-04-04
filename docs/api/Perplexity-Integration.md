# Perplexity Integration

**Document Version:** 1.0.0  
**Last Updated:** April 10, 2024  
**Compatible with:** 
- Next.js 15.0.0
- Node.js 20.x
- Perplexity API v1

## Overview

The Debate-able application integrates with Perplexity AI to provide real-time research capabilities, fact-checking, and citation gathering for debate experts. This integration enhances the quality and credibility of debate content by grounding expert responses in factual information.

## Integration Architecture

```
┌──────────────────┐      ┌────────────────┐      ┌──────────────────┐
│                  │      │                │      │                  │
│  Next.js API     │─────▶│  Perplexity    │─────▶│  Perplexity      │
│  Routes          │◀─────│  Client        │◀─────│  API             │
│                  │      │                │      │                  │
└──────────────────┘      └────────────────┘      └──────────────────┘
```

## Key Files

- `src/lib/api/perplexity.ts`: Perplexity API client implementation
- `src/app/api/perplexity/single-expert/route.ts`: API route for single expert research
- `src/types/perplexity.ts`: TypeScript types for Perplexity API requests and responses
- `src/lib/mock/perplexity-mock.ts`: Mock implementation for development and testing

## Client Implementation

The Perplexity API client is implemented in a centralized file:

```typescript
// src/lib/api/perplexity.ts
import { PerplexityResponse, SourceReference } from '@/types/perplexity';

const PERPLEXITY_API_URL = 'https://api.perplexity.ai/chat/completions';

/**
 * Extracts JSON from markdown response
 */
export function extractJsonFromMarkdown(text: string): any {
  try {
    // Find JSON block in markdown
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch && jsonMatch[1]) {
      return JSON.parse(jsonMatch[1].trim());
    }
    
    // If no markdown block, try to parse the whole text
    return JSON.parse(text);
  } catch (error) {
    console.error('Failed to parse extracted JSON:', error);
    throw new Error('Could not extract valid JSON from response');
  }
}

/**
 * Makes a request to Perplexity API
 */
export async function fetchFromPerplexity(prompt: string, context: string = ''): Promise<PerplexityResponse> {
  // Check environment
  const isServerEnvironment = typeof window === 'undefined';
  
  // Log environment info
  console.log(`Running in ${isServerEnvironment ? 'server' : 'client'} environment, using ${isServerEnvironment ? 'direct API access' : 'proxy endpoint'}`);
  
  try {
    // Determine fetch URL (direct API or proxy endpoint)
    const fetchUrl = isServerEnvironment 
      ? PERPLEXITY_API_URL 
      : '/api/perplexity/proxy';
    
    console.log(`Server fetch: ${fetchUrl}`);
    
    // Make API request
    const response = await fetch(fetchUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(isServerEnvironment && { 
          'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY}` 
        })
      },
      body: JSON.stringify({
        model: "llama-3-sonar-small-32k",
        messages: [
          {
            role: "system",
            content: "You are a research assistant providing factual information with sources. Always format all output as JSON."
          },
          {
            role: "user",
            content: context ? `${context}\n\n${prompt}` : prompt
          }
        ],
        max_tokens: 4000,
        temperature: 0.2,
        response_format: { type: "json_object" }
      }),
      cache: 'no-store'
    });
    
    if (!response.ok) {
      throw new Error(`Perplexity API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // Extract content from response
    const content = data.choices[0].message.content;
    
    // Parse JSON from response
    const jsonResponse = extractJsonFromMarkdown(content);
    
    return {
      content: jsonResponse,
      usage: data.usage
    };
  } catch (error) {
    console.error('Network error fetching from Perplexity API:', error);
    throw error;
  }
}

/**
 * Gets recommended reading for an expert on a specific topic
 */
export async function getExpertRecommendedReading(expert: any, topic: string): Promise<SourceReference[]> {
  try {
    console.log(`Fetching recommended readings for ${expert.name} on topic: ${topic}`);
    
    const prompt = `As ${expert.name} with expertise in ${expert.expertise.join(', ')}, 
    find 3 high-quality sources that would help me understand the topic: "${topic}".
    
    For each source, provide:
    1. Title
    2. Author(s)
    3. Publication/website
    4. Year published
    5. URL (if available)
    6. A brief summary of the key points (2-3 sentences)
    
    Format your response as a JSON array with objects containing fields: 
    title, author, publication, year, url, and content (for the summary).
    
    Return only the JSON without additional text.`;
    
    const response = await fetchFromPerplexity(prompt);
    
    // Extract sources from response
    const sources = response.content.sources || [];
    
    console.log(`Retrieved ${sources.length} readings for ${expert.name}`);
    
    // Format as SourceReference objects
    return sources.map((source: any, index: number) => ({
      id: `src_${expert.id}_${index}`,
      title: source.title,
      author: source.author,
      publication: source.publication,
      year: source.year,
      url: source.url,
      content: source.content
    }));
  } catch (error) {
    console.error('Network error fetching from Perplexity API:', error);
    
    // Log fallback
    console.log('Falling back to mock data due to network error');
    
    // Generate mock readings as fallback
    console.log(`Generating mock readings for ${expert.name} on topic: ${topic}`);
    
    // Return mock data
    return generateMockReadings(expert, topic);
  }
}

/**
 * Generates mock readings for development/testing
 */
function generateMockReadings(expert: any, topic: string): SourceReference[] {
  // Mock implementation
  return [
    {
      id: `src_${expert.id}_0`,
      title: `Understanding ${topic}: A Comprehensive Review`,
      author: "J. Smith, A. Johnson",
      publication: "Journal of Advanced Studies",
      year: 2023,
      url: "https://example.com/journal/understanding-topic",
      content: `This paper provides a thorough review of ${topic}, covering key debates and recent developments.`
    },
    {
      id: `src_${expert.id}_1`,
      title: `${topic}: Perspectives and Analyses`,
      author: "R. Williams",
      publication: "Oxford University Press",
      year: 2022,
      url: "https://example.com/books/topic-perspectives",
      content: `A definitive book on ${topic} that explores various theoretical frameworks and practical implications.`
    },
    {
      id: `src_${expert.id}_2`,
      title: `Critical Approaches to ${topic}`,
      author: "L. Chen, D. Patel",
      publication: "Research Quarterly",
      year: 2023,
      url: "https://example.com/quarterly/critical-approaches",
      content: `This article presents critical perspectives on ${topic}, challenging mainstream assumptions and offering alternative viewpoints.`
    }
  ];
}
```

## API Route Implementation

The Perplexity API is accessed through a dedicated Next.js API route:

```typescript
// src/app/api/perplexity/single-expert/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getExpertRecommendedReading } from '@/lib/api/perplexity';

export async function POST(request: NextRequest) {
  try {
    const { expert, topic } = await request.json();
    
    // Validate input
    if (!expert || !topic) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }
    
    console.log(`Perplexity Single Expert API: Processing request for ${expert.name} on topic: ${topic}`);
    
    // Get recommended readings for the expert on the topic
    const readings = await getExpertRecommendedReading(expert, topic);
    
    return NextResponse.json({ 
      expert: expert.id,
      readings,
      success: true
    });
  } catch (error: any) {
    console.error('Error processing Perplexity expert research:', error);
    
    return NextResponse.json(
      { 
        error: error.message || 'Failed to retrieve expert research',
        expert: expert?.id,
        readings: []
      },
      { status: 500 }
    );
  }
}
```

## JSON Handling

The most common issue with the Perplexity API integration involves extracting valid JSON from responses:

```typescript
// JSON extraction error handling in perplexity.ts
export function extractJsonFromMarkdown(text: string): any {
  try {
    // First attempt: Find JSON block in markdown
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch && jsonMatch[1]) {
      return JSON.parse(jsonMatch[1].trim());
    }
    
    // Second attempt: Try to parse the whole text
    try {
      return JSON.parse(text);
    } catch (e) {
      // Third attempt: Try to find anything that looks like JSON
      const possibleJson = text.match(/(\{[\s\S]*\})/);
      if (possibleJson && possibleJson[1]) {
        return JSON.parse(possibleJson[1]);
      }
      throw e;
    }
  } catch (error) {
    console.error('Failed to parse extracted JSON:', error);
    // Log the problematic text for debugging
    console.error('Raw text that failed parsing:', text.substring(0, 500) + '...');
    throw new Error('Could not extract valid JSON from response');
  }
}
```

## Mocking and Testing

For development and testing, a mock implementation is provided:

```typescript
// src/lib/mock/perplexity-mock.ts
import { PerplexityResponse, SourceReference } from '@/types/perplexity';
import { Expert } from '@/types/expert';

/**
 * Mock implementation of Perplexity API
 */
export async function mockFetchFromPerplexity(prompt: string): Promise<PerplexityResponse> {
  console.log('Using mock Perplexity implementation');
  
  // Add a small delay to simulate network latency
  await new Promise(resolve => setTimeout(resolve, 500));
  
  return {
    content: {
      answer: "This is a mock answer from the Perplexity API.",
      sources: [
        {
          title: "Mock Source 1",
          author: "A. Author",
          publication: "Mock Journal",
          year: 2023,
          url: "https://example.com/mock1",
          content: "This is mock content from source 1."
        },
        {
          title: "Mock Source 2",
          author: "B. Author",
          publication: "Mock Conference Proceedings",
          year: 2022,
          url: "https://example.com/mock2",
          content: "This is mock content from source 2."
        }
      ]
    },
    usage: {
      prompt_tokens: 100,
      completion_tokens: 200,
      total_tokens: 300
    }
  };
}

/**
 * Mock function for getting expert recommended reading
 */
export async function mockGetExpertRecommendedReading(expert: Expert, topic: string): Promise<SourceReference[]> {
  console.log(`Mock: Getting recommended readings for ${expert.name} on topic: ${topic}`);
  
  // Add a small delay to simulate network latency
  await new Promise(resolve => setTimeout(resolve, 800));
  
  // Generate dynamic mock data based on expert and topic
  return [
    {
      id: `src_${expert.id}_0`,
      title: `${expert.expertise[0]}: Understanding ${topic}`,
      author: "John Smith",
      publication: "Academic Journal",
      year: 2023,
      url: "https://example.com/journal/article1",
      content: `This comprehensive article discusses ${topic} from the perspective of ${expert.expertise[0]}.`
    },
    {
      id: `src_${expert.id}_1`,
      title: `Recent Developments in ${topic}`,
      author: "Jane Doe",
      publication: "Research Quarterly",
      year: 2022,
      url: "https://example.com/quarterly/article2",
      content: `An in-depth analysis of recent developments in ${topic}, with particular attention to ${expert.expertise[1] || expert.expertise[0]}.`
    },
    {
      id: `src_${expert.id}_2`,
      title: `${topic}: A Critical Analysis`,
      author: "Sam Johnson",
      publication: "University Press",
      year: 2021,
      url: "https://example.com/press/book1",
      content: `This book provides a critical analysis of ${topic}, examining various perspectives and implications.`
    }
  ];
}
```

## Feature Usage

The Perplexity integration is primarily used in two ways:

1. **Expert Response Enhancement**
   - Providing factual grounding for expert responses
   - Adding citations to debate content

2. **Research Sidebar**
   - Displaying relevant sources during debates
   - Allowing users to explore additional information

## Error Handling

Specific error handling is implemented for Perplexity integration:

```typescript
// Example error handling in a component using Perplexity data
const { data, error, isLoading } = useQuery({
  queryKey: ['perplexityResearch', expert.id, topic],
  queryFn: async () => {
    try {
      const response = await fetch('/api/perplexity/single-expert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expert, topic }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch research');
      }
      
      return response.json();
    } catch (error: any) {
      console.error('Error fetching Perplexity research:', error);
      // Return empty readings rather than failing completely
      return { readings: [], expert: expert.id, success: false };
    }
  },
  // Retry failed requests with exponential backoff
  retry: (failureCount, error) => {
    // Don't retry if explicit 4xx error
    if (error.message.includes('Missing required parameters')) {
      return false;
    }
    return failureCount < 3;
  },
  retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
});
```

## Configuration

Perplexity integration is configured through environment variables:

```
# Perplexity API configuration
PERPLEXITY_API_KEY=your_perplexity_api_key

# Feature flags
USE_PERPLEXITY=true
USE_MOCK_PERPLEXITY=false

# API model selection
PERPLEXITY_MODEL=llama-3-sonar-small-32k
```

## Common Issues & Solutions

### JSON Parsing Errors

The error message in the logs shows a common issue with the Perplexity API:

```
Failed to parse extracted JSON: SyntaxError: Expected double-quoted property name in JSON at position 986 (line 14 column 9)
```

This happens because sometimes the API response doesn't strictly follow JSON format.

**Solution:**
- Implement more robust JSON parsing in `extractJsonFromMarkdown`
- Add fallback to mock data when parsing fails
- Consider using a JSON repair library

### Rate Limiting

The Perplexity API has rate limits that can affect heavy usage.

**Solution:**
- Implement caching for common queries
- Add exponential backoff for retry logic
- Store successful responses for reuse

### Response Consistency

The Perplexity API may occasionally return inconsistent formats or non-JSON responses.

**Solution:**
- Validate and sanitize responses
- Implement fallbacks for malformed responses
- Add detailed logging for debugging

## Related Documentation
- [API Integration](./API-Integration.md)
- [Debate Engine](../features/Debate-Engine.md)
- [Expert Types](../features/Expert-Types.md) 