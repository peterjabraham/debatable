# Debate Engine

**Document Version:** 1.0.0  
**Last Updated:** April 3, 2024  
**Compatible with:** 
- Next.js 15.0.0
- React 18.2.0
- OpenAI 4.28.0
- Zustand 5.0.3

## Overview

The Debate Engine is the core feature of the Debate-able application. It manages the creation, progression, and state of debates between AI-powered experts on user-selected topics. The engine handles expert selection, message generation, debate progression, and state management.

## Architecture

The Debate Engine uses a client-side architecture with server-side API calls for content generation:

```
┌─────────────────┐        ┌───────────────┐         ┌───────────────┐
│                 │        │               │         │               │
│  React UI       │◀───────│ Zustand Store │────────▶│ Next.js API   │
│  Components     │─────── │ (State)       │◀────────│ Routes        │
│                 │        │               │         │               │
└─────────────────┘        └───────────────┘         └───────┬───────┘
                                                            │
                                                   ┌────────▼─────────┐
                                                   │                  │
                                                   │   OpenAI API     │
                                                   │                  │
                                                   └──────────────────┘
```

## Key Files

- `src/components/debate/DebatePanel.tsx`: Main component for the debate UI
- `src/components/debate/ExpertCard.tsx`: Expert representation component
- `src/components/debate/MessageBubble.tsx`: Message display component
- `src/components/debate/UserInput.tsx`: User input component
- `src/lib/store.ts`: Zustand store for debate state management
- `src/app/api/debate/response/route.ts`: API route for generating expert responses
- `src/app/api/debate/history/route.ts`: API route for fetching debate history
- `src/types/message.ts`: Types for debate messages
- `src/types/expert.ts`: Types for debate experts

## Core Functions

### Topic Selection

The user can select a debate topic through multiple methods:
1. Direct input
2. Document upload (PDF)
3. Web URL content extraction
4. YouTube/podcast content extraction

```typescript
// Key function in DebatePanel.tsx
const handleTopicSelect = (topicTitle: string, topicData?: any) => {
    setUserTopic(topicTitle);
    
    // Store complete topic data in the store
    if (topicData) {
        const topicWithData = JSON.stringify({
            title: topicTitle,
            data: topicData
        });
        setTopic(topicWithData);
    } else {
        setTopic(topicTitle);
    }
    
    setSelectedTopic(topicTitle);
    // Additional logic for expert type selection
};
```

### Expert Selection

Once a topic is selected, the system generates or selects appropriate experts:

```typescript
// Expert selection function in DebatePanel.tsx
const selectExperts = async () => {
    // Fetch or generate experts based on topic and expert type
    // For historical experts or AI experts
    
    // In production, experts are retrieved from a predefined list
    // or generated via the API
    const selectedExperts = await getExpertsForTopic(topic, expertType);
    setExperts(selectedExperts);
};
```

### Message Generation

Messages are generated using the OpenAI API through the debate/response endpoint:

```typescript
// Example from API route
export async function POST(request: NextRequest) {
    const { expert, messages, topic } = await request.json();
    
    // Call OpenAI to generate a response
    const response = await openai.chat.completions.create({
        model: "gpt-4-turbo",
        messages: [
            // System message with expert information
            {
                role: "system",
                content: `You are ${expert.name}, ${expert.background}`
            },
            // Prior messages for context
            ...messages.map(m => ({ 
                role: m.role, 
                content: m.content 
            })),
            // Most recent message to respond to
        ],
        temperature: 0.7,
    });
    
    return NextResponse.json({ 
        response: response.choices[0].message.content,
        usage: response.usage
    });
}
```

### State Management

Debate state is managed using Zustand:

```typescript
// Key parts of the store
interface DebateState {
    topic: string;
    experts: Expert[];
    messages: Message[];
    expertType: ExpertType;
    debateId: string | null;
    // ... other state properties
    
    // Actions
    setTopic: (topic: string) => void;
    setExperts: (experts: Expert[]) => void;
    addMessage: (message: Message) => void;
    setMessages: (messages: Message[]) => void;
    initializeDebate: (debateId: string, topic: string) => void;
    // ... other actions
}
```

## Data Flow

1. **Initialize Debate**:
   - User selects a topic
   - System initializes debate with a unique ID
   - Expert type is selected (historical or AI)

2. **Expert Selection**:
   - System selects or generates experts based on topic
   - Experts are assigned stances (pro/con)
   - Optionally, voices are assigned to experts

3. **Initial Messages**:
   - System prompts experts to provide opening statements
   - Expert responses are generated via OpenAI

4. **Debate Progression**:
   - User inputs questions or directives
   - System generates responses from each expert
   - Messages are added to the debate state
   - Debate continues until user ends it

5. **Debate Persistence**:
   - Debates are saved to Firestore in real-time
   - User can access past debates through history

## Storage

Debates are stored in Firestore with the following structure:

```typescript
interface SavedDebate {
    id: string;               // Unique debate ID
    userId: string;           // User ID from authentication
    topic: string;            // Debate topic
    experts: Expert[];        // Array of experts
    messages: Message[];      // Array of messages
    expertType: string;       // 'historical' or 'domain'
    createdAt: string;        // Creation timestamp
    updatedAt: string;        // Last update timestamp
    status?: string;          // Debate status
    isFavorite?: boolean;     // User favorite flag
    tags?: string[];          // User-defined tags
    summary?: string;         // Auto-generated summary
}
```

## Configuration

The Debate Engine can be configured through environment variables:

```
# OpenAI API for response generation
OPENAI_API_KEY=your_openai_api_key

# Optional: Voice synthesis
USE_VOICE_SYNTHESIS=true
ELEVENLABS_API_KEY=your_elevenlabs_api_key
```

## Common Issues & Solutions

### Slow Response Generation
- Check for OpenAI API rate limits
- Consider implementing client-side caching
- Use smaller LLM models for faster responses

### Expert Selection Issues
- Ensure expert types match the selected topic domain
- Add fallback mock experts for API failures
- Log detailed errors for debugging

## Related Components
- [Content Processing](./Content-Processing.md)
- [Expert Types](./Expert-Types.md)
- [API Integration](../api/API-Integration.md) 