import './setup';
import { describe, it, expect, beforeAll } from 'vitest';
import { generateDebateResponseServer as generateDebateResponse } from '../../openai';
import type { DebateMessage, ExpertProfile } from '../../openai';

describe('OpenAI API Integration', () => {
    beforeAll(() => {
        if (!process.env.OPENAI_API_KEY) {
            throw new Error('OPENAI_API_KEY is required to run these tests');
        }
        process.env.OPENAI_MODEL = 'gpt-4-turbo-preview';
    });

    const testExpert: ExpertProfile = {
        name: 'Dr. Rachel Chen',
        stance: 'pro',
        background: 'Environmental scientist with expertise in climate change research',
        expertise: ['Climate Science', 'Environmental Policy']
    };

    it('should generate a response from OpenAI', async () => {
        const messages: DebateMessage[] = [
            {
                role: 'user',
                content: 'What are the main arguments for taking action on climate change?'
            }
        ];

        const { response, usage } = await generateDebateResponse(messages, testExpert);

        expect(response).toBeTruthy();
        expect(response.length).toBeGreaterThan(100);
        expect(usage).toEqual(expect.objectContaining({
            promptTokens: expect.any(Number),
            completionTokens: expect.any(Number),
            totalTokens: expect.any(Number),
            cost: expect.any(Number)
        }));
    }, 30000);

    it('should maintain expert persona in responses', async () => {
        const messages: DebateMessage[] = [
            {
                role: 'user',
                content: 'What evidence supports your position on climate change?'
            }
        ];

        const { response } = await generateDebateResponse(messages, testExpert);

        // Verify response maintains expert persona
        expect(response).toMatch(/climate|environment|science|research/i);
        expect(response.length).toBeGreaterThan(100);

        // Log for manual verification
        console.log('Expert Persona Response:', {
            expert: testExpert.name,
            response: response.substring(0, 100) + '...'
        });
    }, 30000);

    it('should handle follow-up questions coherently', async () => {
        const messages: DebateMessage[] = [
            {
                role: 'user',
                content: 'What are the economic impacts of climate change?'
            },
            {
                role: 'assistant',
                content: 'Climate change poses significant economic risks through increased natural disasters, agricultural disruption, and infrastructure damage.',
                name: testExpert.name
            },
            {
                role: 'user',
                content: 'Can you provide specific examples of these economic impacts?'
            }
        ];

        const { response } = await generateDebateResponse(messages, testExpert);

        // Verify response is coherent with previous messages
        expect(response).toBeTruthy();
        expect(response).toMatch(/economic|cost|impact|damage|loss/i);
        expect(response.length).toBeGreaterThan(100);

        // Log for manual verification
        console.log('Follow-up Response:', {
            expert: testExpert.name,
            response: response.substring(0, 100) + '...'
        });
    }, 30000);
}); 