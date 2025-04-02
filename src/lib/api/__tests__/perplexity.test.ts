import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getExpertRecommendedReading, getMultiExpertRecommendedReading } from '../perplexity';

describe('Perplexity API Integration', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        process.env = { ...originalEnv };
        process.env.NEXT_PUBLIC_USE_REAL_API = 'true';
    });

    afterEach(() => {
        process.env = originalEnv;
    });

    it('should fetch recommended reading for a single expert', async () => {
        const result = await getExpertRecommendedReading(
            'Environmental Scientist',
            'climate change impact on biodiversity'
        );

        expect(Array.isArray(result)).toBe(true);
        expect(result.length).toBeGreaterThan(0);
        result.forEach(item => {
            expect(item).toHaveProperty('title');
            expect(item).toHaveProperty('url');
            expect(item).toHaveProperty('snippet');
        });
    }, 30000);

    it('should fetch recommended reading for multiple experts', async () => {
        const experts = [
            { role: 'Environmental Scientist', topic: 'climate change' },
            { role: 'Economist', topic: 'carbon pricing' }
        ];

        const result = await getMultiExpertRecommendedReading(experts);

        expect(Array.isArray(result)).toBe(true);
        expect(result.length).toBe(experts.length);
        result.forEach((expertResults, index) => {
            expect(expertResults.expert).toBe(experts[index].role);
            expect(Array.isArray(expertResults.readings)).toBe(true);
            expect(expertResults.readings.length).toBeGreaterThan(0);
            expertResults.readings.forEach(reading => {
                expect(reading).toHaveProperty('title');
                expect(reading).toHaveProperty('url');
                expect(reading).toHaveProperty('snippet');
            });
        });
    }, 30000);

    it('should handle API errors gracefully', async () => {
        // Temporarily invalidate API key
        const validKey = process.env.PERPLEXITY_API_KEY;
        process.env.PERPLEXITY_API_KEY = 'invalid-key';

        await expect(getExpertRecommendedReading(
            'Environmental Scientist',
            'climate change'
        )).rejects.toThrow();

        // Restore valid key
        process.env.PERPLEXITY_API_KEY = validKey;
    });

    it('should return relevant results for the given topic', async () => {
        const topic = 'renewable energy adoption';
        const expertRole = 'Energy Policy Expert';

        const results = await getExpertRecommendedReading(expertRole, topic);

        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => {
            // Check if results contain relevant keywords
            const relevantContent = (
                result.title.toLowerCase() +
                result.snippet.toLowerCase()
            ).includes('energy') ||
                result.snippet.toLowerCase().includes('renewable');
            expect(relevantContent).toBe(true);
        });
    }, 30000);
}); 