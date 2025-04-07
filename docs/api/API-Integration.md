# API Integration

**Version:** 1.0
**Last Updated:** August 2023
**Compatible With:** Next.js 15+, React 18+, OpenAI API

## Overview

This document outlines the API integration architecture used in the Debate-able application, focusing on the communication between the frontend and various backend services, including internal API routes and external services like OpenAI.

## Core API Structure

The application employs a hybrid API approach:

1. **Internal API Routes**: Next.js API routes in `/src/app/api/` that serve as middleware between the frontend and external services
2. **Direct External API Calls**: In some cases, direct calls to external services from the client side with proper authentication

## API Endpoints

### Debate API

The primary endpoints for debate functionality:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/debate-experts` | POST | Generate or select debate experts based on topic |
| `/api/debate` | POST | Generate debate responses and manage debate flow |
| `/api/debate/history` | GET | Retrieve debate history for a user |
| `/api/openai/generate-experts` | POST | Direct endpoint for expert generation via OpenAI |

### Content Processing API

Endpoints for managing content ingestion:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/content/document` | POST | Process document uploads |
| `/api/content/link` | POST | Extract content from URLs |
| `/api/content/media` | POST | Process media content (YouTube, podcasts) |

### User API

Endpoints for user management:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/user/profile/update` | POST | Update user profile information |
| `/api/user/preferences` | GET/POST | Manage user preferences |
| `/api/user/account/delete` | POST | Delete user account |

## Authentication

API authentication follows these principles:

```typescript
// API call with authentication
const apiCall = async (endpoint: string, data: any) => {
    try {
        // Get API key from environment variables
        const apiKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY || '';
        
        // Create request with proper headers
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify(data)
        });
        
        // Process response
        if (response.ok) {
            return await response.json();
        } else {
            const errorText = await response.text();
            throw new Error(`API error: ${response.status} ${errorText}`);
        }
    } catch (error) {
        console.error('API call failed:', error);
        throw error;
    }
};
```

### Security Considerations

1. **API Keys**: Stored in environment variables
2. **Server-Side Processing**: Sensitive operations performed in API routes
3. **Request Validation**: All inputs validated before processing
4. **Rate Limiting**: Applied to prevent abuse
5. **Error Obfuscation**: Detailed errors only shown in development

## Error Handling

The application employs a structured approach to API error handling:

```typescript
// Error handling pattern
try {
    // API call with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
    
    const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
        signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API error: ${response.status} ${errorText.substring(0, 100)}`);
    }
    
    // Process successful response
    const data = await response.json();
    // Handle data
    
} catch (error) {
    // Environment-specific error handling
    if (process.env.NODE_ENV === 'production') {
        // Production error handling - user-friendly messages
        showError(createError(
            'API_ERROR',
            'We encountered an issue. Please try again later.',
            'high',
            true,
            error instanceof Error ? error.message : String(error)
        ));
    } else {
        // Development error handling - detailed information
        console.error('Detailed API error:', error);
        showWarning('API Error', `Development mode error: ${error instanceof Error ? error.message : String(error)}`);
    }
}
```

## Timeout Handling

API calls implement timeout handling to prevent UI freezes:

```typescript
// API call with timeout pattern
const makeAPICallWithTimeout = async (
    endpoint: string, 
    body: unknown, 
    timeoutMs = 15000
) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    
    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        return response;
    } catch (error) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
            throw new Error(`Request to ${endpoint} timed out after ${timeoutMs}ms`);
        }
        throw error;
    }
};
```

## API Testing Tools

For debugging and development, API testing utilities are available:

```typescript
// API diagnostic button component
const APITestButton = () => {
    const [isLoading, setIsLoading] = useState(false);
    
    const testAPIs = async () => {
        setIsLoading(true);
        const results = {};
        
        const endpoints = [
            '/api/debate-experts',
            '/api/test-openai-real',
            '/api/debate',
            '/api/debate/experts'
        ];
        
        for (const endpoint of endpoints) {
            try {
                const start = Date.now();
                const response = await fetch(endpoint, {
                    method: endpoint === '/api/test-openai-real' ? 'GET' : 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: endpoint === '/api/test-openai-real' ? undefined : JSON.stringify({
                        action: 'test',
                        topic: 'Climate change'
                    })
                });
                
                results[endpoint] = {
                    status: response.status,
                    time: `${Date.now() - start}ms`,
                    ok: response.ok
                };
                
                if (response.ok) {
                    try {
                        results[endpoint].data = await response.json();
                    } catch (e) {
                        results[endpoint].data = 'Failed to parse JSON';
                    }
                }
            } catch (error) {
                results[endpoint] = { error: error.message };
            }
        }
        
        console.log('API Test Results:', results);
        setIsLoading(false);
        return results;
    };
    
    return (
        <Button 
            onClick={testAPIs} 
            disabled={isLoading}
        >
            {isLoading ? 'Testing APIs...' : 'Test API Endpoints'}
        </Button>
    );
};
```

## Environment-Specific Behavior

The API integration layer behaves differently based on the environment:

### Production Environment

- Always uses real API endpoints
- Implements strict timeout handling
- Displays user-friendly error messages
- Logs errors to monitoring services
- No mock data used

### Development Environment

- Can use both real and mock APIs
- Falls back to mock data if API calls fail
- Shows detailed error information
- Includes debug controls for testing APIs
- Allows direct manipulation of API state

## Best Practices

1. **Centralized API Clients**: Use centralized service files for API calls
2. **Response Validation**: Validate all API responses before use
3. **Graceful Degradation**: Implement fallbacks for failed API calls
4. **Progressive Loading**: Show loading states during API operations
5. **Consistent Error Handling**: Use a standardized approach to error display
6. **Request Batching**: Combine multiple related requests where possible
7. **Response Caching**: Cache responses to reduce API calls
8. **Request Deduplication**: Prevent duplicate simultaneous requests

## Data Flow

1. User triggers action in UI
2. Frontend component calls appropriate API function
3. API function prepares request and handles authentication
4. Next.js API route processes request and communicates with external services
5. Response is validated and transformed
6. Data is returned to component and state is updated
7. UI reflects new data state 