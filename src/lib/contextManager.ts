import { Message } from '@/types/message';

// API Message structure for OpenAI completion
export interface ApiMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
    name?: string;
}

/**
 * Helper function to estimate token count from a string
 * This is a simple approximation (~4 chars per token)
 */
export function estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
}

/**
 * Extract key points from a list of messages to summarize earlier conversation
 */
export function extractKeyPoints(messages: Message[]): string {
    // Group messages by speaker
    const userPoints: string[] = [];
    const supporterPoints: string[] = [];
    const opposerPoints: string[] = [];

    messages.forEach(msg => {
        // Get first 1-2 sentences of each message as key points
        const sentences = msg.content
            .split(/\. |\.\n/)
            .filter(s => s.trim().length > 0)
            .slice(0, 2)
            .map(s => s.trim() + (s.endsWith('.') ? '' : '.'));

        if (sentences.length === 0) return;

        const keyPoint = sentences.join(' ');

        if (msg.role === 'user') {
            userPoints.push(`User: ${keyPoint}`);
        } else if (msg.speaker === 'Supporter') {
            supporterPoints.push(`Supporter: ${keyPoint}`);
        } else if (msg.speaker === 'Opposer') {
            opposerPoints.push(`Opposer: ${keyPoint}`);
        }
    });

    // Combine all points, limiting to a reasonable number from each role
    return [
        ...userPoints.slice(-2),
        ...supporterPoints.slice(-2),
        ...opposerPoints.slice(-2)
    ].join(' ');
}

/**
 * Implements a sliding window approach that keeps recent messages
 * and extracts key points from older ones
 * @param messages Previous conversation messages
 * @param topic The debate topic
 * @returns Optimized context for the API call
 */
export function manageConversationContext(messages: Message[], topic: string): ApiMessage[] {
    const RECENT_MESSAGES_COUNT = 6; // Keep last 6 messages in full
    const MAX_TOKENS = 4000; // Safe limit for context window
    const context: ApiMessage[] = [];

    // Add system prompt with debate instructions and topic
    context.push({
        role: 'system',
        content: `You are participating in a debate about "${topic}". 
              Generate two responses:
              1. A supporter perspective (PRO) who advocates for the position
              2. An opposer perspective (CON) who challenges the position
              Keep each response under 1,000 characters and directly address the user's points.
              Reference previous exchanges for continuity.
              Your responses must be relevant to the topic and user's messages.
              Format your output as a JSON object with supporter_response and opposer_response fields.`
    });

    // If we have more than the recent message count
    if (messages.length > RECENT_MESSAGES_COUNT) {
        // Extract key points from older messages
        const olderMessages = messages.slice(0, messages.length - RECENT_MESSAGES_COUNT);
        const keyPoints = extractKeyPoints(olderMessages);

        context.push({
            role: 'system',
            content: `Key points from earlier in the conversation: ${keyPoints}`
        });
    }

    // Add the most recent messages in full
    const recentMessages = messages.slice(Math.max(0, messages.length - RECENT_MESSAGES_COUNT));

    // Convert to API format
    recentMessages.forEach(msg => {
        context.push({
            role: msg.role === 'user' ? 'user' : 'assistant',
            content: msg.content,
            name: msg.role === 'assistant' ? msg.speaker : undefined
        });
    });

    // Estimate total tokens and trim if needed
    let totalTokens = context.reduce((sum, msg) => sum + estimateTokens(msg.content), 0);

    if (totalTokens > MAX_TOKENS) {
        // Remove some messages from the middle, keeping the first system message and the most recent messages
        const systemMessages = context.filter(msg => msg.role === 'system');
        const userAndAssistantMessages = context.filter(msg => msg.role !== 'system');

        // Determine how many user/assistant messages we can keep
        const systemTokens = systemMessages.reduce((sum, msg) => sum + estimateTokens(msg.content), 0);
        const tokensAvailableForMessages = MAX_TOKENS - systemTokens;

        // Keep as many recent messages as possible within token limit
        const trimmedMessages: ApiMessage[] = [];
        let currentTokens = 0;

        // Add messages from newest to oldest until we approach the limit
        for (let i = userAndAssistantMessages.length - 1; i >= 0; i--) {
            const msg = userAndAssistantMessages[i];
            const msgTokens = estimateTokens(msg.content);

            if (currentTokens + msgTokens <= tokensAvailableForMessages) {
                trimmedMessages.unshift(msg); // Add to beginning of array to maintain order
                currentTokens += msgTokens;
            } else {
                break;
            }
        }

        // Reconstruct context with system messages and trimmed user/assistant messages
        context.length = 0; // Clear the array
        context.push(...systemMessages);
        context.push(...trimmedMessages);
    }

    return context;
} 