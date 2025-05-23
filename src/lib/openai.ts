import OpenAI from 'openai';

// Types for our messages and experts
export interface DebateMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
    name?: string;
}

export interface ExpertProfile {
    name: string;
    stance: 'pro' | 'con';
    background: string;
    expertise: string[];
    voiceId?: string; // ElevenLabs voice ID
}

export interface UsageStats {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    cost: number; // in USD
}

// Helper function to calculate OpenAI API cost
function calculateOpenAICost(usage: { prompt_tokens: number; completion_tokens: number }): UsageStats {
    // Cost varies by model - GPT-4 Turbo pricing
    let PROMPT_COST_PER_1K = 0.01;    // $0.01 per 1K tokens
    let COMPLETION_COST_PER_1K = 0.03; // $0.03 per 1K tokens

    // Check if we're using a different model and adjust pricing
    const model = process.env.OPENAI_MODEL || 'gpt-4-turbo-preview';
    if (model === 'gpt-3.5-turbo') {
        PROMPT_COST_PER_1K = 0.0005;   // $0.0005 per 1K tokens
        COMPLETION_COST_PER_1K = 0.0015; // $0.0015 per 1K tokens
    }

    const promptCost = (usage.prompt_tokens / 1000) * PROMPT_COST_PER_1K;
    const completionCost = (usage.completion_tokens / 1000) * COMPLETION_COST_PER_1K;

    return {
        promptTokens: usage.prompt_tokens,
        completionTokens: usage.completion_tokens,
        totalTokens: usage.prompt_tokens + usage.completion_tokens,
        cost: promptCost + completionCost
    };
}

// Helper function to sanitize names for OpenAI API
function sanitizeNameForOpenAI(name: string | undefined): string | undefined {
    if (!name) return undefined;
    return name.replace(/[^a-zA-Z0-9_-]/g, '_');
}

// Server-side functions with real OpenAI implementation
export async function generateDebateResponseServer(
    messages: DebateMessage[],
    expert: ExpertProfile
): Promise<{ response: string; usage: UsageStats }> {
    try {
        const openai = getOpenAIClient();
        const model = process.env.OPENAI_MODEL || 'gpt-4-turbo-preview';

        // Ensure expert and required fields (name, expertise) are defined.
        // Allow background to be potentially empty, but check for null/undefined explicitly if needed.
        if (!expert || !expert.name || expert.background === null || expert.background === undefined || !expert.expertise) {
            // Log the problematic expert data for debugging
            console.error('Invalid expert data received:', JSON.stringify(expert));
            throw new Error(`Invalid expert data received for expert generation.`);
        }

        // Prepare messages for OpenAI API
        const apiMessages = [
            {
                role: 'system',
                content: `You are ${expert.name}, an expert with the following background: ${expert.background || 'N/A'}. 
                Your areas of expertise include: ${Array.isArray(expert.expertise) ? expert.expertise.join(', ') : 'various fields'}.
                You have a ${expert.stance === 'pro' ? 'strongly supportive' : 'fundamentally opposed'} stance on the topic.
                
                This is a structured debate with opposing viewpoints. As the expert with a "${expert.stance}" stance, your role is to provide ${expert.stance === 'pro' ? 'supporting arguments and evidence in favor of' : 'strong counterarguments and compelling evidence against'} the topic.
                
                ${expert.stance === 'pro' ?
                        'Highlight benefits, advantages, and positive aspects. Refute common criticisms and emphasize why this position is correct.' :
                        'IMPORTANT: You MUST take a strong opposing position. Emphasize serious risks, significant downsides, and negative consequences. Directly challenge and refute claims made by supporters. Use authoritative language to explain why the topic position is fundamentally flawed, impractical, or harmful. Be assertive and confident in your opposition.'}
                
                ${expert.stance === 'pro' ?
                        'Maintain a respectful but firm stance throughout the debate.' :
                        'While remaining professional, do not hedge or qualify your opposition. Your role is to present the strongest possible case AGAINST the topic.'}
                
                Respond in first person as this expert would, with their tone, knowledge level, and perspective.
                Keep responses concise (150-250 words) but substantive, focusing on your strongest arguments.`
            }
        ];

        // Add conversation messages with sanitized names
        messages.forEach(m => {
            apiMessages.push({
                role: m.role as any,
                content: m.content,
                name: sanitizeNameForOpenAI(m.name)
            });
        });

        const response = await openai.chat.completions.create({
            model: model,
            messages: apiMessages,
            temperature: 0.7,
            max_tokens: 500,
        });

        // Parse response
        const responseText = response.choices[0]?.message?.content || 'No response generated';

        // Calculate cost based on OpenAI pricing
        const promptTokens = response.usage?.prompt_tokens || 0;
        const completionTokens = response.usage?.completion_tokens || 0;
        const totalTokens = response.usage?.total_tokens || 0;
        // Use calculateOpenAICost helper for consistency
        const usageStats = calculateOpenAICost({ prompt_tokens: promptTokens, completion_tokens: completionTokens });

        return {
            response: responseText,
            usage: usageStats
        };

    } catch (error) {
        console.error('OpenAI API error in generateDebateResponseServer:', error);
        // Re-throw the error so the API route can handle it
        throw error;
    }
}

// Helper function to get OpenAI client
let openaiClient: OpenAI | null = null;

export function getOpenAIClient(): OpenAI {
    if (!process.env.OPENAI_API_KEY) {
        throw new Error('OpenAI API key is required');
    }

    // Reuse existing client if available
    if (openaiClient) {
        return openaiClient;
    }

    // Create new client with the new API key format
    openaiClient = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY.trim(),
        dangerouslyAllowBrowser: true,
        defaultHeaders: {
            'OpenAI-Organization': process.env.OPENAI_ORG_ID || undefined
        }
    });

    return openaiClient;
}

export default getOpenAIClient(); 