# Content Processing

**Document Version:** 1.1.0  
**Last Updated:** May 1, 2024  
**Compatible with:** 
- Next.js 15.0.0
- OpenAI 4.28.0
- pdf-parse 1.1.1
- cheerio 1.0.0-rc.12
- youtube-dl-exec 2.5.8

## Overview

The Content Processing system enables users to extract debate topics from various content sources including documents (PDF, DOCX), web pages, YouTube videos, and podcasts. The system processes these inputs, extracts key topics and arguments, and presents them to the user for debate initiation.

## Architecture

```
┌──────────────┐      ┌────────────────┐      ┌──────────────────┐
│              │      │                │      │                  │
│   Content    │─────▶│  Processing    │─────▶│  Topic           │
│   Sources    │      │  Pipeline      │      │  Extraction      │
│              │      │                │      │                  │
└──────────────┘      └────────────────┘      └──────────────────┘
      ▲                                                 │
      │                                                 │
      │                                                 ▼
      │                                         ┌───────────────┐
      │                                         │               │
      └─────────────────────────────────────────│  Debate       │
                                                │  Engine       │
                                                │               │
                                                └───────────────┘
```

## Key Files

- `src/components/content-processing/ContentUploader.tsx`: Main component for content upload UI
- `src/app/api/content/document/route.ts`: API route for document processing
- `src/app/api/content/link/route.ts`: API route for web link processing
- `src/app/api/content/media/route.ts`: API route for media (YouTube/podcast) processing
- `src/lib/content-processing/extractors/pdf-extractor.ts`: PDF content extraction
- `src/lib/content-processing/extractors/web-extractor.ts`: Web content extraction
- `src/lib/content-processing/extractors/media-extractor.ts`: Media content extraction
- `src/lib/content-processing/topic-extraction.ts`: Topic extraction logic
- `src/app/api/[[...path]]/route.ts`: Catch-all API route for mock responses

## Real Data Handling and Error Display

The ContentUploader component is designed to always prioritize real data from the API and provide clear error feedback to users when issues occur.

### Data Flow

1. **Content Upload**:
   - User uploads a document, provides a URL, or submits a media link
   - Content is sent to the appropriate API endpoint
   - Progress is shown through notifications
   - Error handling is triggered if the process fails

2. **API Response Handling**:
   - The component processes the API response to extract topics
   - If topics are found, they're displayed for user selection
   - If no topics are found, a specific error message is shown
   - If the API server is unavailable, a warning is shown with mock data

3. **Error Message Display**:
   - Errors are displayed in a red notification box with clear descriptions
   - Specific error messages from the API are shown directly to users
   - Error states are handled for: server unavailability, content parsing issues, and topic extraction failures

### Mock API Fallback Mechanism

When the API server is unavailable, the system uses a fallback mechanism to provide a seamless experience:

```typescript
// Detect mock API responses
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
        duration: 8000,
    });
    
    return;
}
```

The catch-all API route (`src/app/api/[[...path]]/route.ts`) provides structured mock data for content endpoints when the server is unavailable:

```typescript
// Generate mock topics for document processing endpoints
function generateMockTopics(path: string) {
    // Only include topics for content processing endpoints
    if (path.includes('/api/content/')) {
        return {
            topics: [
                {
                    title: "Climate Change Solutions",
                    confidence: 0.92,
                    arguments: [
                        {
                            claim: "Renewable energy transition",
                            evidence: "Shifting to renewable energy sources like solar and wind can significantly reduce carbon emissions."
                        },
                        {
                            claim: "Carbon pricing mechanisms",
                            evidence: "Implementing carbon taxes or cap-and-trade systems can incentivize emission reductions."
                        }
                    ]
                },
                // Additional mock topics...
            ]
        };
    }
    
    // For other endpoints, return no topics
    return {};
}
```

### Demo Topics

Users can also manually load demo topics for testing purposes:

```typescript
const handleLoadSampleTopics = () => {
    // Add a sample notification
    addNotification({
        title: 'Demo Topics Loaded',
        message: 'Using demonstration topics for testing purposes only',
        status: 'info',
        duration: 5000
    });

    // Clear any existing error when manually loading demo topics
    setError(null);

    // Set sample topics with predefined data
    setExtractedTopics([
        // Sample topic data...
    ]);
};
```

This functionality is clearly labeled in the UI as "Load Demo Topics (for testing only)" to prevent confusion.

## Core Functions

### Document Processing

The system can process PDF and DOCX documents to extract text for topic generation:

```typescript
// PDF Processing Example
import pdfParse from 'pdf-parse';

export async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  try {
    const data = await pdfParse(buffer);
    return data.text;
  } catch (error) {
    console.error('Error extracting text from PDF:', error);
    throw new Error('Failed to extract text from PDF');
  }
}
```

### Web Link Processing

The system can extract content from web pages using Cheerio:

```typescript
// Web Link Processing Example
import cheerio from 'cheerio';

export async function extractContentFromURL(url: string): Promise<string> {
  try {
    const response = await fetch(url);
    const html = await response.text();
    const $ = cheerio.load(html);
    
    // Remove script, style, and other non-content elements
    $('script, style, nav, footer, header, aside').remove();
    
    // Extract main content
    const bodyText = $('body').text();
    
    // Clean up whitespace
    return bodyText.replace(/\s+/g, ' ').trim();
  } catch (error) {
    console.error('Error extracting content from URL:', error);
    throw new Error('Failed to extract content from URL');
  }
}
```

### YouTube/Podcast Processing

The system can extract audio transcripts from YouTube videos and podcasts:

```typescript
// YouTube Processing Example
import ytdl from 'youtube-dl-exec';

export async function getYouTubeTranscript(videoUrl: string): Promise<string> {
  try {
    // Use youtube-dl to get the automatic transcript
    const result = await ytdl(videoUrl, {
      skipDownload: true,
      writeAutoSub: true,
      subFormat: 'vtt',
      output: 'temp'
    });
    
    // Process and return the transcript
    const subtitlePath = 'temp.en.vtt';
    // Parse the VTT file and extract text
    // ...processing logic...
    
    return processedTranscript;
  } catch (error) {
    console.error('Error extracting YouTube transcript:', error);
    throw new Error('Failed to extract transcript from YouTube video');
  }
}
```

### Topic Extraction

Once the text is extracted, the system uses OpenAI to identify potential debate topics:

```typescript
// Topic Extraction Example
export async function extractTopics(content: string): Promise<Array<{
  title: string;
  confidence: number;
  arguments: string[];
}>> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4-turbo",
      messages: [
        {
          role: "system",
          content: "You are a topic extraction specialist. Analyze the provided text and identify 3-5 potential debate topics."
        },
        {
          role: "user",
          content: `Extract debate topics from the following content: ${content.substring(0, 8000)}...`
        }
      ],
      temperature: 0.7,
      response_format: { type: "json_object" }
    });
    
    const result = JSON.parse(response.choices[0].message.content);
    return result.topics;
  } catch (error) {
    console.error('Error extracting topics:', error);
    throw new Error('Failed to extract topics from content');
  }
}
```

## Configuration

Content processing can be configured through environment variables:

```
# OpenAI API for topic extraction
OPENAI_API_KEY=your_openai_api_key

# API Limits (to prevent excessive usage)
MAX_DOCUMENT_SIZE_MB=10
MAX_EXTRACTION_TOKENS=16000

# External Service Configurations
YOUTUBE_API_KEY=your_youtube_api_key

# Mock API control
MOCK_API=false                # Set to true to force mock API responses
```

## Common Issues & Solutions

### Large Document Handling
- Documents exceeding size limits are chunked and processed in parts
- Only the most relevant sections are used for topic extraction
- Consider implementing summarization for very large documents

### Media Processing Failures
- YouTube API limitations may require throttling
- Fallback to alternative transcription methods if primary fails
- Cache processed results to avoid repeated processing

### Topic Quality Issues
- Adjust OpenAI prompt to improve topic relevance
- Consider implementing a multi-stage extraction process
- Allow users to provide their own topics if extraction fails

### API Unavailability
- The system automatically detects API unavailability and provides mock data
- Clear notifications inform users when using mock data
- Real error details are displayed to help users understand issues
- Demo topics are available for testing without making API calls

## Related Components
- [Debate Engine](./Debate-Engine.md)
- [API Integration](../api/API-Integration.md) 