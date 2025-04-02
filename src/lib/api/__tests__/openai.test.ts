import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { generateDebateResponseServer as generateDebateResponse } from '../../openai';
import type { DebateMessage, ExpertProfile } from '../../openai';

// Mock OpenAI
vi.mock('openai', () => ({
    OpenAI: vi.fn().mockImplementation(() => ({
        chat: {
            completions: {
                create: vi.fn()
            }
        }
    }))
}));

describe('OpenAI API Integration', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        vi.clearAllMocks();
        vi.resetModules();
        // Create a fresh copy of process.env
        process.env = { ...originalEnv };
        // Set test environment variables
        process.env.OPENAI_API_KEY = 'test-key';
        process.env.NEXT_PUBLIC_USE_REAL_API = 'true';
    });

    afterEach(() => {
        // Restore original env
        process.env = originalEnv;
        vi.restoreAllMocks();
    });

    const mockExpert: ExpertProfile = {
        name: 'Dr. Test Expert',
        stance: 'pro',
        background: 'Test background',
        expertise: ['Testing', 'Mocking']
    };

    it('should properly configure OpenAI client with API key', async () => {
        const mockMessages: DebateMessage[] = [
            { role: 'system', content: 'You are a helpful assistant' },
            { role: 'user', content: 'Test message' }
        ];

        // Mock OpenAI response
        const { OpenAI } = require('openai');
        const mockCreate = OpenAI.mock.results[0].value.chat.completions.create;
        mockCreate.mockResolvedValueOnce({
            choices: [{ message: { content: 'Test response' } }],
            usage: {
                prompt_tokens: 100,
                completion_tokens: 50,
                total_tokens: 150
            }
        });

        const { response, usage } = await generateDebateResponse(mockMessages, mockExpert);

        expect(OpenAI).toHaveBeenCalledWith({
            apiKey: 'test-key'
        });
        expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
            messages: expect.any(Array),
            temperature: expect.any(Number),
            max_tokens: expect.any(Number)
        }));
        expect(response).toBe('Test response');
        expect(usage).toEqual({
            promptTokens: 100,
            completionTokens: 50,
            totalTokens: 150,
            cost: expect.any(Number)
        });
    });

    it('should handle missing API key gracefully', async () => {
        process.env.OPENAI_API_KEY = '';

        const mockMessages: DebateMessage[] = [
            { role: 'system', content: 'You are a helpful assistant' },
            { role: 'user', content: 'Test message' }
        ];

        const result = await generateDebateResponse(mockMessages, mockExpert);
        // Should return mock data when API key is missing
        expect(result.response).toMatch(/^(Mock response|As an expert)/);
        expect(result.usage).toBeDefined();
    });

    it('should handle API errors gracefully', async () => {
        // Mock OpenAI error
        const { OpenAI } = require('openai');
        const mockCreate = OpenAI.mock.results[0].value.chat.completions.create;
        mockCreate.mockRejectedValueOnce(new Error('API Error: Too Many Requests'));

        const mockMessages: DebateMessage[] = [
            { role: 'system', content: 'You are a helpful assistant' },
            { role: 'user', content: 'Test message' }
        ];

        await expect(generateDebateResponse(mockMessages, mockExpert))
            .rejects
            .toThrow('API Error: Too Many Requests');
    });

    it('should use mock responses when NEXT_PUBLIC_USE_REAL_API is false', async () => {
        process.env.NEXT_PUBLIC_USE_REAL_API = 'false';

        const mockMessages: DebateMessage[] = [
            { role: 'system', content: 'You are a helpful assistant' },
            { role: 'user', content: 'Test message' }
        ];

        const { response, usage } = await generateDebateResponse(mockMessages, mockExpert);

        // Mock response should be deterministic based on input
        expect(response).toMatch(/^(Mock response|As an expert)/);
        expect(usage).toBeDefined();
        // Verify no API call was made
        const { OpenAI } = require('openai');
        const mockCreate = OpenAI.mock.results[0].value.chat.completions.create;
        expect(mockCreate).not.toHaveBeenCalled();
    });
}); 