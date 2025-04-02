import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getExpertRecommendedReading, getMultiExpertRecommendedReading, getMockExpertRecommendedReading } from '../perplexity';

// Mock the global fetch function
global.fetch = vi.fn();

describe('Perplexity API Client', () => {
    // Reset mocks before each test
    beforeEach(() => {
        vi.resetAllMocks();
    });

    // Clear all mocks after each test
    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('getExpertRecommendedReading', () => {
        it('should fetch recommended reading for an expert on a topic', async () => {
            // Mock successful API response
            const mockResponse = {
                query: 'John Doe Climate Change research papers academic articles',
                results: [
                    {
                        id: '123',
                        url: 'https://example.com/paper1',
                        title: 'Climate Change Research',
                        snippet: 'A comprehensive study on climate change.'
                    }
                ],
                search_id: 'abc123'
            };

            // Setup the mock fetch to return our mock response
            (global.fetch as any).mockResolvedValueOnce({
                ok: true,
                json: async () => mockResponse
            });

            // Call the function with test parameters
            const results = await getExpertRecommendedReading('John Doe', 'Climate Change');

            // Verify fetch was called with the correct parameters
            expect(global.fetch).toHaveBeenCalledTimes(1);
            expect(global.fetch).toHaveBeenCalledWith(
                'https://api.perplexity.ai/search',
                expect.objectContaining({
                    method: 'POST',
                    headers: expect.objectContaining({
                        'Content-Type': 'application/json',
                        'Authorization': expect.stringContaining('Bearer ')
                    }),
                    body: expect.stringContaining('John Doe Climate Change')
                })
            );

            // Verify the results match our mock response
            expect(results).toEqual(mockResponse.results);
        });

        it('should handle API errors gracefully', async () => {
            // Mock a failed API response
            (global.fetch as any).mockResolvedValueOnce({
                ok: false,
                status: 401,
                statusText: 'Unauthorized'
            });

            // Call the function with test parameters
            const results = await getExpertRecommendedReading('John Doe', 'Climate Change');

            // Verify fetch was called
            expect(global.fetch).toHaveBeenCalledTimes(1);

            // Verify that an empty array is returned on error
            expect(results).toEqual([]);
        });

        it('should handle network errors gracefully', async () => {
            // Mock a network error
            (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

            // Call the function with test parameters
            const results = await getExpertRecommendedReading('John Doe', 'Climate Change');

            // Verify fetch was called
            expect(global.fetch).toHaveBeenCalledTimes(1);

            // Verify that an empty array is returned on error
            expect(results).toEqual([]);
        });
    });

    describe('getMultiExpertRecommendedReading', () => {
        it('should fetch recommended reading for multiple experts', async () => {
            // Mock successful API responses for two experts
            const mockResponseExpert1 = {
                query: 'John Doe Climate Change research papers academic articles',
                results: [
                    {
                        id: '123',
                        url: 'https://example.com/paper1',
                        title: 'Climate Change Research by John Doe',
                        snippet: 'A comprehensive study on climate change.'
                    }
                ],
                search_id: 'abc123'
            };

            const mockResponseExpert2 = {
                query: 'Jane Smith Climate Change research papers academic articles',
                results: [
                    {
                        id: '456',
                        url: 'https://example.com/paper2',
                        title: 'Climate Change Research by Jane Smith',
                        snippet: 'Another comprehensive study on climate change.'
                    }
                ],
                search_id: 'def456'
            };

            // Setup the mock fetch to return our mock responses in sequence
            (global.fetch as any)
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => mockResponseExpert1
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => mockResponseExpert2
                });

            // Call the function with test parameters
            const results = await getMultiExpertRecommendedReading(['John Doe', 'Jane Smith'], 'Climate Change');

            // Verify fetch was called twice (once for each expert)
            expect(global.fetch).toHaveBeenCalledTimes(2);

            // Verify the results match our mock responses
            expect(results).toEqual({
                'John Doe': mockResponseExpert1.results,
                'Jane Smith': mockResponseExpert2.results
            });
        });

        it('should handle errors for some experts while returning results for others', async () => {
            // Mock a successful response for the first expert
            const mockResponseExpert1 = {
                query: 'John Doe Climate Change research papers academic articles',
                results: [
                    {
                        id: '123',
                        url: 'https://example.com/paper1',
                        title: 'Climate Change Research by John Doe',
                        snippet: 'A comprehensive study on climate change.'
                    }
                ],
                search_id: 'abc123'
            };

            // Setup the mock fetch to return a success for the first expert and an error for the second
            (global.fetch as any)
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => mockResponseExpert1
                })
                .mockResolvedValueOnce({
                    ok: false,
                    status: 429,
                    statusText: 'Too Many Requests'
                });

            // Call the function with test parameters
            const results = await getMultiExpertRecommendedReading(['John Doe', 'Jane Smith'], 'Climate Change');

            // Verify fetch was called twice (once for each expert)
            expect(global.fetch).toHaveBeenCalledTimes(2);

            // Verify the results include the successful expert and an empty array for the failed one
            expect(results).toEqual({
                'John Doe': mockResponseExpert1.results,
                'Jane Smith': []
            });
        });
    });

    describe('getMockExpertRecommendedReading', () => {
        it('should generate mock results for an expert on a topic', () => {
            // Call the function with test parameters
            const results = getMockExpertRecommendedReading('John Doe', 'Climate Change');

            // Verify that we get the expected number of mock results
            expect(results.length).toBe(3);

            // Verify that the mock results contain the expert name and topic
            results.forEach(result => {
                expect(result.title).toContain('John Doe') || expect(result.title).toContain('Climate Change');
                expect(result.snippet).toContain('John Doe');
                expect(result.snippet).toContain('Climate Change');
            });

            // Verify that the URLs are formatted correctly
            results.forEach(result => {
                expect(result.url).toMatch(/https:\/\/example\.com\/papers\/john-doe-\d/);
            });
        });

        it('should generate different results for different experts', () => {
            // Get mock results for two different experts
            const resultsExpert1 = getMockExpertRecommendedReading('John Doe', 'Climate Change');
            const resultsExpert2 = getMockExpertRecommendedReading('Jane Smith', 'Climate Change');

            // Verify that the results are different
            expect(resultsExpert1[0].title).not.toBe(resultsExpert2[0].title);
            expect(resultsExpert1[0].url).not.toBe(resultsExpert2[0].url);
        });
    });
}); 