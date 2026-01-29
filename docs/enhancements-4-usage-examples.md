# Enhancement 4.A & 4.B Implementation Guide

This document demonstrates how to use the newly implemented **Enhanced Metadata Usage** and **Timestamp Preservation** features for YouTube and podcast content processing.

## Enhancement 4.A: Enhanced Metadata Usage

### YouTube Video Title Context
The system now extracts video titles and includes them in topic extraction for better context-aware results.

```typescript
import { extractYouTubeTextEnhanced } from '@/lib/content-processing/youtube-processor';
import { extractTopicsFromEnhancedYouTube } from '@/lib/content-processing/topic-extractor';

// Extract YouTube content with enhanced metadata
const youtubeUrl = "https://www.youtube.com/watch?v=VIDEO_ID";
const enhancedData = await extractYouTubeTextEnhanced(youtubeUrl);

// enhancedData contains:
// - videoId: string
// - title: string (extracted video title)
// - transcript: string
// - segmentedTranscript: TranscriptSegment[]
// - contextualContent: string (formatted as: `Video: "Title" - transcript`)

// Extract topics with video title context
const topics = await extractTopicsFromEnhancedYouTube(enhancedData);
```

### Podcast Episode Metadata
Similar enhancement for podcast content with episode and podcast titles.

```typescript
import { extractPodcastTextEnhanced } from '@/lib/content-processing/podcast-processor';
import { extractTopicsFromEnhancedPodcast } from '@/lib/content-processing/topic-extractor';

// Extract podcast content with enhanced metadata
const podcastUrl = "https://feeds.example.com/podcast.rss";
const enhancedData = await extractPodcastTextEnhanced(podcastUrl, 0); // Episode index

// enhancedData contains:
// - episodeTitle: string
// - podcastTitle?: string
// - description?: string
// - transcript: string
// - segmentedTranscript: PodcastSegment[]
// - contextualContent: string (formatted with podcast + episode titles)
// - episodeIndex: number
// - audioUrl: string
```

## Enhancement 4.B: Timestamp Preservation

### YouTube Timestamp Citations
YouTube transcripts now preserve exact timestamps for citation purposes.

```typescript
import { 
    TranscriptSegment, 
    formatTimestamp, 
    findRelevantSegments 
} from '@/lib/content-processing/youtube-processor';

// Each transcript segment includes timing data
interface TranscriptSegment {
    text: string;
    timestamp: number;  // Start time in seconds
    duration?: number;  // Duration in seconds
}

// Format timestamp for display (e.g., "1:23" or "1:23:45")
const displayTime = formatTimestamp(83); // Returns "1:23"

// Find relevant segments for a quote or topic
const segments = findRelevantSegments(
    enhancedData.segmentedTranscript,
    "machine learning",  // Search text
    5,  // Context before (segments)
    5   // Context after (segments)
);

// Generate YouTube URLs with timestamp
segments.forEach(segment => {
    const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}&t=${Math.floor(segment.timestamp)}s`;
    console.log(`"${segment.text}" at ${formatTimestamp(segment.timestamp)}: ${youtubeUrl}`);
});
```

### Podcast Timestamp Estimation
Podcast transcripts include estimated timestamps based on content segmentation.

```typescript
import { 
    PodcastSegment, 
    createSegmentedTranscript 
} from '@/lib/content-processing/podcast-processor';

// Podcast segments with estimated timing
interface PodcastSegment {
    text: string;
    timestamp: number;  // Estimated timestamp in seconds
    segmentIndex: number;
}

// Create segmented transcript with timing estimates
const segments = createSegmentedTranscript(
    transcript, 
    3600  // Estimated duration in seconds (1 hour)
);
```

## Usage in Topic Extraction

### Enhanced Topic Metadata
Topics extracted using enhanced processing include additional metadata for citations:

```typescript
// YouTube topics include:
const youtubeTopics = await extractTopicsFromEnhancedYouTube(enhancedData);
// Each topic has:
// - sourceTitle: video title
// - sourceType: 'youtube'
// - sourceId: video ID
// - segmentedTranscript: for finding citations

// Podcast topics include:
const podcastTopics = await extractTopicsFromEnhancedPodcast(enhancedData);
// Each topic has:
// - sourceTitle: episode title
// - podcastTitle: podcast name
// - sourceType: 'podcast'
// - sourceUrl: audio URL
// - episodeIndex: episode number
// - segmentedTranscript: for finding citations
```

### Citation Generation
Find specific citations for debate points:

```typescript
import { findTimestampCitations } from '@/lib/content-processing/topic-extractor';

// Find citations for a specific argument or quote
const citations = findTimestampCitations(
    topicWithMetadata, 
    "artificial intelligence risks"
);

// Returns array of:
// {
//   timestamp: "1:23:45",
//   text: "segment text containing the search term",
//   url: "https://www.youtube.com/watch?v=VIDEO_ID&t=5025s"
// }
```

## API Integration

The enhanced processing is automatically used in the `/api/content/process-source` endpoint:

```typescript
// When processing YouTube URLs, the system automatically:
// 1. Attempts enhanced extraction with video title
// 2. Falls back to basic extraction if enhanced fails
// 3. Uses enhanced topic extraction when available

// Same for podcast URLs:
// 1. Attempts enhanced extraction with episode metadata
// 2. Falls back to basic extraction if enhanced fails
// 3. Uses enhanced topic extraction when available
```

## Backward Compatibility

All existing functions remain available for backward compatibility:

```typescript
// These still work as before:
const transcript = await extractYouTubeText(url);
const podcastTranscript = await extractPodcastText(url);
const topics = await extractTopicsFromText(transcript, 'youtube');
```

## Benefits

### 4.A: Enhanced Metadata Usage
- **Better Topic Context**: Video/episode titles provide additional context for more relevant topic extraction
- **Improved Accuracy**: AI topic generation considers both content and source metadata
- **Source Attribution**: Topics are properly attributed to their source content

### 4.B: Timestamp Preservation
- **Precise Citations**: Link directly to specific moments in videos/podcasts
- **Debate Evidence**: Support arguments with timestamped evidence
- **User Experience**: Allow users to jump to relevant content sections
- **Accountability**: Enable fact-checking with specific source timestamps

## Example Output

### Before Enhancement
```
Topic: "AI Ethics Discussion"
Summary: "General discussion about AI ethics and safety concerns"
```

### After Enhancement 4.A & 4.B
```
Topic: "AI Alignment and Safety Challenges"
Summary: "Discussion of AI alignment problems and safety research, as covered in 'The Future of AI Safety' podcast episode"
Source: "The Future of AI Safety" - Episode: "Alignment Research Update"
Citations:
- "AI alignment is crucial" at 12:34: https://youtube.com/watch?v=abc&t=754s
- "Safety research priorities" at 18:45: https://youtube.com/watch?v=abc&t=1125s
```

The enhancements provide richer, more contextual, and better-cited content for improved debate quality. 