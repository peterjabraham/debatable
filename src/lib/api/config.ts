interface ApiConfig {
    useRealApi: boolean;
    apiServerAvailable: boolean;
    baseUrl: string;
    debug: boolean;
}

interface OpenAIConfig {
    apiKey: string;
    model: string;
    maxTokens: number;
    temperature: number;
}

export function getApiConfig(): ApiConfig {
    return {
        useRealApi: process.env.NEXT_PUBLIC_USE_REAL_API === 'true',
        apiServerAvailable: process.env.API_SERVER_AVAILABLE === 'true',
        baseUrl: process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000',
        debug: process.env.NODE_ENV === 'development'
    };
}

export function isApiEnabled(): boolean {
    const config = getApiConfig();
    return config.useRealApi && !!process.env.OPENAI_API_KEY;
}

export function getOpenAIConfig(): OpenAIConfig {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        throw new Error('OpenAI API key not configured');
    }

    return {
        apiKey,
        model: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview',
        maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS || '2000', 10),
        temperature: parseFloat(process.env.OPENAI_TEMPERATURE || '0.7')
    };
} 