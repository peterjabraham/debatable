import OpenAI from 'openai';

// Lazy-initialized OpenAI client singleton
let openaiClient: OpenAI | null = null;

// Get or create the OpenAI client instance
function getOpenAIClient(): OpenAI {
    if (openaiClient) {
        return openaiClient;
    }

    if (!process.env.OPENAI_API_KEY) {
        throw new Error('OPENAI_API_KEY environment variable is not set');
    }

    openaiClient = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
    });

    // Log configuration in development
    if (process.env.NODE_ENV === 'development') {
        const keyFormat = process.env.OPENAI_API_KEY.substring(0, 7) + "...";
        console.log(`OpenAI API key format: ${keyFormat}`);
        console.log(`Using OpenAI model: ${getModel()}`);

        if (process.env.OPENAI_API_KEY.startsWith('sk-proj-')) {
            console.warn("Using a project-based API key (sk-proj-...)");
        }
    }

    return openaiClient;
}

// Helper function to calculate cost based on token usage
export function calculateCost(tokens: number): number {
    // GPT-4 Turbo pricing: $0.01 per 1K input tokens, $0.03 per 1K output tokens
    // This is a simplified calculation
    const costPer1KTokens = 0.02; // Average cost
    return (tokens / 1000) * costPer1KTokens;
}

// Get the preferred model to use
export function getModel(): string {
    return process.env.OPENAI_MODEL || "gpt-4-turbo";
}

// Export the lazy getter as a proxy that calls getOpenAIClient() on access
const openaiProxy = new Proxy({} as OpenAI, {
    get(_target, prop) {
        const client = getOpenAIClient();
        const value = client[prop as keyof OpenAI];
        if (typeof value === 'function') {
            return value.bind(client);
        }
        return value;
    }
});

export { getOpenAIClient };
export default openaiProxy;
