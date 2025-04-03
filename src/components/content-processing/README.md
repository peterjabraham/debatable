# Content Processing Component

## Overview

The Content Processing component enables users to upload and process various types of content (documents, YouTube videos, podcasts, web links) to extract debate topics. It provides a user-friendly interface for content submission and displays extracted topics for selection.

## Key Features

- Support for multiple content types (documents, YouTube videos, podcasts, web links)
- Real-time processing status feedback
- Error handling with detailed user feedback
- Displays extracted topics with confidence scores and sample evidence
- Mock API fallback for development and server unavailability

## Component Structure

```
src/components/content-processing/
├── ContentUploader.tsx    # Main component
├── __tests__/             # Test files
└── README.md              # This documentation
```

## Usage

```tsx
import { ContentUploader } from '@/components/content-processing/ContentUploader';

export default function MyPage() {
  return (
    <div className="container">
      <ContentUploader />
    </div>
  );
}
```

## How It Works

### 1. Content Submission

The component allows users to:
- Upload documents (PDF, DOCX, TXT)
- Submit YouTube video URLs
- Submit podcast URLs
- Submit web URLs

### 2. Processing Flow

When content is submitted:
1. A loading notification appears
2. The content is sent to the appropriate API endpoint
3. The API processes the content and extracts topics
4. Topics are displayed for user selection
5. User selects a topic to start a debate

### 3. Real Data and Error Handling

The component is designed to prioritize real data and provide clear error feedback:

- **Real Data Display**:
  - Topics extracted from the API are shown as cards with title, confidence score, and arguments
  - Each topic displays key arguments as chips/tags
  - Selected topics show additional evidence information

- **Error Handling**:
  - API errors are displayed in a clear error message box
  - Specific error details from the API are shown to users
  - JSON parsing errors are handled gracefully
  - Empty topic responses are handled with descriptive messages

- **Mock API Fallback**:
  - When the API server is unavailable, mock topics are shown with clear notification
  - Users can manually load demo topics for testing
  - Demo topics are clearly labeled to prevent confusion

### 4. Key Implementation Details

```typescript
// Check for mock API response first
if (data && data.mock === true) {
    console.log(`[ContentUploader] Detected mock API response due to server unavailability`);
    
    // Load sample topics but with a clear notification about server being unavailable
    handleLoadSampleTopics();
    
    // Show an informative error message
    setError(`API server is currently unavailable. Using demo topics instead. Please try again later.`);
    
    // Update notification
    updateNotification(id, {
        status: 'warning',
        title: 'Server Unavailable',
        message: 'Using demo topics because the API server is unavailable',
        duration: 8000, // Show longer
    });
    
    return;
}
```

## Environment Configuration

The content processing component behavior can be influenced by these environment variables:

```
# Core Configuration
USE_MOCK_DATA=false          # Force use of mock data for all API calls
MOCK_API=false               # Force mock API responses
NEXT_PUBLIC_USE_REAL_API=true # Use real API instead of mock implementation

# API Server Control
API_SERVER_ENABLED=false     # Control whether to use external API server 
MVP_CONFIG_API_SERVER_AVAILABLE=false # Flag for API server availability
```

## API Endpoints

The component uses these API endpoints:

- `/api/content/document` - For document processing (PDF, DOCX, TXT)
- `/api/content/link` - For web link processing
- `/api/content/media` - For media processing (YouTube, podcasts)

When the real API is unavailable, requests are handled by the catch-all route:
- `/api/[[...path]]` - Provides mock responses with topic data

## Testing & Development

For local development and testing:

1. Use the "Load Demo Topics" button to load sample topics without making API calls
2. Set `MOCK_API=true` in your `.env.local` file to force mock API responses
3. The component will display clear notifications when using mock data

## Related Documentation

For more information, see:
- [Content Processing Documentation](../../../docs/features/Content-Processing.md)
- [API Integration Documentation](../../../docs/api/API-Integration.md) 