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
const selectExpertsWithTopic = async (directTopic: string) => {
    // Set loading state
    updateStepState('expertSelection', 'loading', 'Finding experts for this topic...');
    
    // Parse topic if it's stored as JSON
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
    
    // Call the API endpoint with proper parameters
    try {
        const apiEndpoint = '/api/debate-experts';
        const requestBody = {
            action: 'select-experts',
            topic: topicTitle,
            expertType: expertType || 'ai',
            count: 2
        };
        
        const response = await fetch(apiEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify(requestBody)
        });
        
        if (response.ok) {
            const data = await response.json();
            
            if (data.experts && Array.isArray(data.experts) && data.experts.length > 0) {
                // Format experts properly
                const formattedExperts = data.experts.map(expert => ({
                    id: expert.id || uuidv4(),
                    name: expert.name,
                    expertise: expert.expertise || [],
                    stance: expert.stance || 'neutral',
                    background: expert.background || ''
                }));
                
                setExperts(formattedExperts);
                setExpertsSelected(true); // Flag to show Start Debate button
                return formattedExperts;
            }
        }
        
        throw new Error('Failed to get experts from API');
    } catch (error) {
        // In production, we don't show sample experts - we just show an error
        if (process.env.NODE_ENV === 'production') {
            // Show error and allow retry
            showError(createError(
                'EXPERT_GENERATION_ERROR',
                'Failed to generate experts. Please try again later.',
                'high',
                true
            ));
        } else {
            // In development, we can fall back to mock experts
            const fallbackExperts = mockExperts.map(expert => ({
                ...expert,
                id: expert.id || uuidv4(),
            }));
            
            setExperts(fallbackExperts);
            setExpertsSelected(true);
            return fallbackExperts;
        }
    }
};
```

### Message Generation

Messages are generated using the OpenAI API through the debate/response endpoint:

```typescript
// Generate expert responses
const generateLocalExpertResponses = async (currentExperts: Expert[], currentMessages: Message[]) => {
    // Create a copy of messages for safety
    const messagesCopy = [...currentMessages];
    const newMessages: Message[] = [];

    // Process each expert
    await Promise.all(currentExperts.map(async (expert) => {
        try {
            // Call the API for each expert
            const response = await fetch('/api/debate/response', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    expert,
                    messages: messagesCopy,
                    topic: topic || selectedTopic || 'General debate'
                }),
            });

            if (response.ok) {
                const data = await response.json();
                
                // Create the new message
                const newMessage: Message = {
                    id: uuidv4(),
                    role: 'assistant',
                    content: data.response,
                    speaker: expert.name,
                    timestamp: new Date().toISOString()
                };
                
                // Add to our collection of new messages
                newMessages.push(newMessage);
            }
        } catch (error) {
            // Add error message to collection if generation fails
            const errorMessage: Message = {
                id: uuidv4(),
                role: 'assistant',
                content: `I apologize, but there was an error generating my response as ${expert.name}.`,
                speaker: expert.name,
                timestamp: new Date().toISOString()
            };
            
            newMessages.push(errorMessage);
        }
    }));

    // Only update the messages state if we have new messages
    if (newMessages.length > 0) {
        // Add all the new messages to the current messages
        const updatedMessages = [...currentMessages, ...newMessages];
        
        // Update the store with all messages at once
        setMessages(updatedMessages);
    }
};
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

## Diagnostic Tools

The Debate Engine includes diagnostic tools to help troubleshoot API connectivity issues:

```typescript
// API Endpoint Testing Button
<Button
    onClick={async () => {
        // Get current topic
        const currentTopic = topic || selectedTopic;
        
        // API endpoints to test
        const apiEndpoints = [
            '/api/debate-experts',
            '/api/test-openai-real',
            '/api/debate',
            '/api/debate/experts'
        ];
        
        // Test each endpoint
        for (const endpoint of apiEndpoints) {
            console.log(`Testing endpoint: ${endpoint}`);
            
            try {
                // Make appropriate request for each endpoint
                const response = await fetch(endpoint, {
                    method: endpoint === '/api/test-openai-real' ? 'GET' : 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: endpoint === '/api/test-openai-real' ? undefined : JSON.stringify({
                        action: 'select-experts',
                        topic: currentTopic,
                        expertType: expertType || 'ai',
                        count: 2
                    })
                });
                
                console.log(`Response status from ${endpoint}: ${response.status}`);
                
                // Process and display results
                if (response.ok) {
                    const data = await response.json();
                    console.log(`Success response from ${endpoint}:`, data);
                }
            } catch (error) {
                console.error(`Error with endpoint ${endpoint}:`, error);
            }
        }
    }}
>
    Test API Endpoints
</Button>
```

## Common Issues & Solutions

### Slow Response Generation
- Check for OpenAI API rate limits
- Consider implementing client-side caching
- Use smaller LLM models for faster responses

### Expert Selection Issues
- **Incorrect API Endpoint**: Ensure the correct endpoint `/api/debate-experts` is used with proper parameters
- **Missing Parameters**: The API needs `action: 'select-experts'`, `topic`, `expertType`, and `count`
- **Development vs. Production**: Development mode can use mock experts as fallback, but production should show appropriate errors
- **Timeout Handling**: Set appropriate timeouts for API calls to prevent infinite loading states

### Message Handling Issues
- **Array Handling**: When updating messages, collect all new messages first, then update state in a single operation
- **Store Integration**: The `setMessages` function expects a complete array, not an updater function
- **Batch Updates**: Process all expert responses in parallel using `Promise.all` for efficiency

### Debate Flow Issues
- **Missing Start Button**: Ensure the `expertsSelected` flag is set to true when experts are available
- **Topic Propagation**: Use direct parameter passing for topic to avoid state synchronization issues
- **Error Recovery**: Implement proper retry mechanisms with clear error messages for users

## Related Components
- [Content Processing](./Content-Processing.md)
- [Expert Types](./Expert-Types.md)
- [API Integration](../api/API-Integration.md) 