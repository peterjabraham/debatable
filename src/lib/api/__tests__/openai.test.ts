import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { generateDebateResponseServer as generateDebateResponse } from '../../openai';
import type { DebateMessage, ExpertProfile } from '../../openai';

describe('OpenAI API Integration', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        // Create a fresh copy of process.env
        process.env = { ...originalEnv };
        // Ensure we're using the real API
        process.env.NEXT_PUBLIC_USE_REAL_API = 'true';
    });

    afterEach(() => {
        // Restore original env
        process.env = originalEnv;
    });

    const testExpert: ExpertProfile = {
        name: 'Dr. Rachel Chen',
        stance: 'pro',
        background: 'Environmental Scientist with expertise in climate change and sustainability',
        expertise: ['Environmental Science', 'Climate Change', 'Sustainability']
    };

    it('should generate a debate response using the real API', async () => {
        const messages: DebateMessage[] = [
            { role: 'system', content: 'You are a helpful assistant' },
            { role: 'user', content: 'What are your thoughts on climate change?' }
        ];

        const result = await generateDebateResponse(messages, testExpert);

        // Verify response structure
        expect(result.response).toBeDefined();
        expect(result.response.length).toBeGreaterThan(100);
        expect(result.usage).toBeDefined();
        expect(result.usage.promptTokens).toBeGreaterThan(0);
        expect(result.usage.completionTokens).toBeGreaterThan(0);
        expect(result.usage.totalTokens).toBeGreaterThan(0);
        expect(result.usage.cost).toBeGreaterThan(0);
    }, 30000); // Increase timeout for API call

    it('should handle API errors gracefully', async () => {
        // Temporarily invalidate API key
        const validKey = process.env.OPENAI_API_KEY;
        process.env.OPENAI_API_KEY = 'invalid-key';

        const messages: DebateMessage[] = [
            { role: 'system', content: 'You are a helpful assistant' },
            { role: 'user', content: 'Test message' }
        ];

        await expect(generateDebateResponse(messages, testExpert))
            .rejects
            .toThrow();

        // Restore valid key
        process.env.OPENAI_API_KEY = validKey;
    });

    it('should maintain expert persona in responses', async () => {
        const messages: DebateMessage[] = [
            { role: 'system', content: 'You are a helpful assistant' },
            { role: 'user', content: 'How does climate change affect biodiversity?' }
        ];

        const result = await generateDebateResponse(messages, testExpert);

        // Verify response maintains expert persona
        expect(result.response).toContain('environmental');
        expect(result.response.length).toBeGreaterThan(200);
    }, 30000); // Increase timeout for API call
}); 