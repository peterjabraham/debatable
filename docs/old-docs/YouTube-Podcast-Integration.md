# YouTube and Podcast Integration

This document outlines the implementation of the YouTube and podcast integration feature, which allows users to provide links to YouTube videos or podcasts, extract debate topics, and incorporate them into live debates.

## Overview

The YouTube and podcast integration feature sits alongside the existing PDF upload functionality but operates as a separate process. It enables users to:

1. Input a YouTube video URL or podcast URL
2. Process the media to extract audio and generate a transcript
3. Analyze the transcript to identify debate topics, subtopics, and supporting evidence
4. Store the processed data in Firestore
5. Incorporate the extracted topics into live debate sessions

## Architecture

### Frontend Components

- **ContentUploader**: Enhanced to handle YouTube and podcast URLs, with tabs for different content types
- **Notification System**: Real-time status updates during processing

### Backend Services

- **Media API Endpoint**: `/api/content/media` - Handles YouTube and podcast URL processing
- **MediaProcessor**: Core service for downloading media, extracting audio, and generating transcripts
- **TopicExtractor**: NLP service for identifying debate topics and arguments from transcripts
- **Firestore Integration**: Stores processed media, transcripts, and extracted topics

## Implementation Details

### Media Processing Pipeline

1. **URL Validation**: Ensures the provided URL is valid and accessible
2. **Metadata Extraction**: Retrieves title, duration, author, and other metadata
3. **Audio Extraction**: Downloads and extracts audio from the media
4. **Transcription**: Generates a transcript using OpenAI's Whisper API
5. **Topic Extraction**: Analyzes the transcript to identify debate topics and arguments
6. **Data Storage**: Stores the processed data in Firestore for future reference

### User Experience

1. User selects the YouTube or podcast tab in the ContentUploader
2. User enters a valid URL and clicks "Extract Topics"
3. The system displays a loading notification with status updates
4. Once processing is complete, extracted topics are displayed
5. User selects a topic and proceeds to the debate

## Dependencies

- **youtube-dl-exec**: For downloading YouTube videos
- **fluent-ffmpeg**: For audio processing
- **@tensorflow-models/universal-sentence-encoder**: For semantic analysis of transcripts
- **compromise**: For natural language processing
- **OpenAI Whisper API**: For speech-to-text transcription

## Configuration

The media processing pipeline can be configured with the following options:

- **downloadMedia**: Whether to download the media (default: true)
- **extractAudio**: Whether to extract audio from the media (default: true)
- **generateTranscript**: Whether to generate a transcript (default: true)
- **maxDuration**: Maximum allowed duration in seconds (default: 3600 - 1 hour)
- **language**: Language code for transcription (default: 'en')

## Error Handling

The system includes robust error handling for various scenarios:

- Invalid URLs
- Inaccessible media
- Exceeded duration limits
- Transcription failures
- Topic extraction errors

Error messages are displayed to the user through the notification system, and detailed logs are available in the server console.

## Testing

The implementation includes comprehensive test coverage:

- **Unit Tests**: For MediaProcessor and TopicExtractor
- **Integration Tests**: For the media API endpoint
- **End-to-End Tests**: For the complete user flow

## Future Enhancements

Potential future enhancements include:

- Support for additional media sources (e.g., Vimeo, SoundCloud)
- Improved transcript accuracy with speaker diarization
- Real-time progress updates during processing
- Batch processing of multiple media sources
- Integration with external fact-checking services 