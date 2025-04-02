import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getApiConfig, isApiEnabled, getOpenAIConfig } from '../config';

describe('API Configuration', () => {
    beforeEach(() => {
        vi.resetModules();
        // Reset environment variables
        process.env.NEXT_PUBLIC_USE_REAL_API = 'true';
        process.env.OPENAI_API_KEY = 'test-key';
        process.env.API_SERVER_AVAILABLE = 'false';
    });

    describe('getApiConfig', () => {
        it('should return correct configuration based on environment', () => {
            const config = getApiConfig();

            expect(config).toEqual({
                useRealApi: true,
                apiServerAvailable: false,
                baseUrl: expect.any(String),
                debug: expect.any(Boolean)
            });
        });

        it('should handle missing environment variables', () => {
            process.env.NEXT_PUBLIC_USE_REAL_API = undefined;
            process.env.API_SERVER_AVAILABLE = undefined;

            const config = getApiConfig();

            // Should use defaults
            expect(config.useRealApi).toBe(false);
            expect(config.apiServerAvailable).toBe(false);
        });
    });

    describe('isApiEnabled', () => {
        it('should return true when all required configs are present', () => {
            expect(isApiEnabled()).toBe(true);
        });

        it('should return false when API is explicitly disabled', () => {
            process.env.NEXT_PUBLIC_USE_REAL_API = 'false';
            expect(isApiEnabled()).toBe(false);
        });

        it('should return false when API key is missing', () => {
            process.env.OPENAI_API_KEY = '';
            expect(isApiEnabled()).toBe(false);
        });
    });

    describe('getOpenAIConfig', () => {
        it('should return correct OpenAI configuration', () => {
            const config = getOpenAIConfig();

            expect(config).toEqual({
                apiKey: 'test-key',
                model: expect.any(String),
                maxTokens: expect.any(Number),
                temperature: expect.any(Number)
            });
        });

        it('should throw error when API key is missing', () => {
            process.env.OPENAI_API_KEY = '';

            expect(() => getOpenAIConfig()).toThrow('OpenAI API key not configured');
        });

        it('should use default model when not specified', () => {
            process.env.OPENAI_MODEL = '';

            const config = getOpenAIConfig();
            expect(config.model).toBe('gpt-4-turbo-preview'); // Default model
        });
    });
}); 