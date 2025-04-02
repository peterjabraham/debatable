# Perplexity API Integration

This document outlines the integration of the Perplexity API for fetching recommended reading links in the Debate-able application.

## Overview

The Perplexity API is used to fetch relevant research papers, articles, and other resources related to the debate topic and experts. This enhances the user experience by providing curated reading materials that are specific to each expert's perspective on the topic.

## Implementation Details

### API Client

The Perplexity API client is implemented in `src/lib/api/perplexity.ts`. It provides the following functions:

- `getExpertRecommendedReading(expertName, topic)`: Fetches recommended reading links for a specific expert on a topic.
- `getMultiExpertRecommendedReading(experts, topic)`: Fetches recommended reading links for multiple experts on a topic.
- `getMockExpertRecommendedReading(expertName, topic)`: Provides mock data for testing or when the API is unavailable.

### Integration in DebateSummary Component

The DebateSummary component (`src/components/debate/DebateSummary.tsx`) has been updated to use the Perplexity API for fetching recommended reading links. The implementation includes:

- Loading state while fetching the links
- Error handling for API failures
- Fallback to Google search when no results are found
- Displaying the fetched links with titles, snippets, and publication dates

### Configuration

To use the Perplexity API, you need to set the following environment variable:

```
PERPLEXITY_API_KEY=your_api_key_here
```

You can obtain an API key by signing up at [Perplexity AI](https://www.perplexity.ai/api).

## Testing

Tests for the Perplexity API integration are implemented in:

- `src/lib/api/__tests__/perplexity.test.ts`: Tests for the API client functions
- `src/components/debate/__tests__/DebateSummary.test.tsx`: Tests for the DebateSummary component with the Perplexity integration

To run the tests:

```bash
npm test
```

## Mock Mode

The current implementation uses mock data by default to avoid requiring an API key for development. To switch to using the actual API:

1. Uncomment the `getMultiExpertRecommendedReading` call in the `useEffect` hook in `DebateSummary.tsx`
2. Comment out the mock data implementation
3. Ensure you have set the `PERPLEXITY_API_KEY` environment variable

## Future Improvements

Potential improvements for the Perplexity API integration:

1. **Caching**: Implement caching of API responses to reduce API calls and improve performance
2. **Rate Limiting**: Add rate limiting to prevent exceeding API quotas
3. **Filtering**: Add options to filter results by publication date, source, or relevance
4. **Pagination**: Add pagination for viewing more results
5. **Customization**: Allow users to customize the search query or filter results

## Troubleshooting

Common issues and solutions:

- **API Key Issues**: Ensure the `PERPLEXITY_API_KEY` environment variable is set correctly
- **No Results**: Check that the expert names and topic are specific enough to return relevant results
- **Rate Limiting**: If you encounter rate limiting errors, implement a backoff strategy or reduce the number of concurrent requests 