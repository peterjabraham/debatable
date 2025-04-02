import OpenAI from 'openai';

// Initialize a single OpenAI client instance to be shared across the application
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// Validate the API key and log information about the configuration
function validateApiKey(): boolean {
    if (!process.env.OPENAI_API_KEY) {
        console.error("OpenAI API key is missing");
        return false;
    }

    // Log the API key format (first few chars) for debugging
    const keyFormat = process.env.OPENAI_API_KEY.substring(0, 7) + "...";
    console.log(`OpenAI API key format: ${keyFormat}`);

    // Log the model being used
    const model = process.env.OPENAI_MODEL || "gpt-4-turbo";
    console.log(`Using OpenAI model: ${model}`);

    // Warn if using project-based OpenAI API key
    if (process.env.OPENAI_API_KEY.startsWith('sk-proj-')) {
        console.warn("WARNING: Using a project-based API key (sk-proj-...). If you encounter authentication issues, you may need to use a standard API key (sk-...) instead.");
    }

    return true;
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

// Validate the API key when this module is imported
validateApiKey();

// Export the shared OpenAI client
export default openai; 