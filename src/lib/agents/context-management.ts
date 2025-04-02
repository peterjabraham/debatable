/**
 * Context Management Agent
 * 
 * This module manages the debate context across multiple turns,
 * providing memory, speaker tracking, and "thinking" simulation.
 */

import { Message, DebateContext, ExpertContext, TurnRecord } from '@/types/message';
import { Expert } from '@/types/expert';
import { createChatModel, agentConfig } from '../langchain-config';
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { getDebateById, updateDebateContext as updateDebateContextInDB } from '@/lib/db/models/debate';

// In-memory store for context while the debate is active
const activeDebateContexts: Record<string, DebateContext> = {};

/**
 * Initialize a new debate context
 * 
 * @param debateId The ID of the debate
 * @param topic The debate topic
 * @returns The initialized context
 */
export async function initializeDebateContext(
    debateId: string,
    topic: string
): Promise<DebateContext> {
    console.log(`Initializing debate context for debate ${debateId} on topic "${topic}"`);

    // Create a new context
    const newContext: DebateContext = {
        debateId,
        expertContexts: {},
        mainPoints: [],
        userQuestions: [],
        turnHistory: [],
    };

    // Store in memory for quick access
    activeDebateContexts[debateId] = newContext;

    // Update in the database
    try {
        await updateDebateContextInDB(debateId, newContext);
        console.log(`Successfully initialized debate context for ${debateId}`);
    } catch (error) {
        console.error('Error saving debate context to database:', error);
    }

    return newContext;
}

/**
 * Update the debate context with a new message
 * 
 * @param message The new message to incorporate into the context
 * @returns Updated context
 */
export async function updateDebateContext(
    message: Message
): Promise<DebateContext> {
    const debateId = message.debateContext?.debateId;

    if (!debateId) {
        throw new Error('Message is missing debate context ID');
    }

    // Get the current context from memory or database
    let context = activeDebateContexts[debateId];

    if (!context) {
        // Try to load from database
        try {
            const debate = await getDebateById(debateId);
            context = debate?.context || { debateId, expertContexts: {}, mainPoints: [], userQuestions: [] };
            activeDebateContexts[debateId] = context;
        } catch (error) {
            console.error(`Error loading debate context for ${debateId}:`, error);
            context = { debateId, expertContexts: {}, mainPoints: [], userQuestions: [] };
            activeDebateContexts[debateId] = context;
        }
    }

    // Record the turn in history
    const turnRecord: TurnRecord = {
        speakerId: message.senderInfo?.id || 'unknown',
        timestamp: message.timestamp || new Date().toISOString(),
        messageId: message.id || 'unknown-message'
    };

    context.turnHistory = [...(context.turnHistory || []), turnRecord];

    // If this is a user message, extract questions
    if (message.role === 'user') {
        try {
            const questions = await extractQuestionsFromMessage(message.content);
            context.userQuestions = [...(context.userQuestions || []), ...questions];
        } catch (error) {
            console.error('Error extracting questions from user message:', error);
        }
    }

    // If this is an expert message, update their context
    if (message.role === 'assistant' && message.senderInfo?.type === 'expert') {
        const expertId = message.senderInfo.id;
        const expertName = message.senderInfo.name || 'Unknown Expert';

        // Create expert context if it doesn't exist
        if (!context.expertContexts) {
            context.expertContexts = {};
        }

        if (!context.expertContexts[expertName]) {
            context.expertContexts[expertName] = {
                expertId,
                keyPoints: [],
                recentArguments: []
            };
        }

        // Extract key points from the message
        try {
            const keyPoints = await extractKeyPointsFromMessage(message.content);
            context.expertContexts[expertName].keyPoints = [
                ...(context.expertContexts[expertName].keyPoints || []),
                ...keyPoints
            ].slice(-5); // Keep only the 5 most recent points

            // Add to recent arguments
            context.expertContexts[expertName].recentArguments = [
                ...(context.expertContexts[expertName].recentArguments || []),
                message.content
            ].slice(-2); // Keep only the 2 most recent arguments
        } catch (error) {
            console.error(`Error extracting key points for expert ${expertName}:`, error);
        }
    }

    // Extract main points for the overall debate
    try {
        const mainPoints = await extractMainPointsFromMessage(message.content);
        context.mainPoints = [...(context.mainPoints || []), ...mainPoints].slice(-10); // Keep last 10 main points
    } catch (error) {
        console.error('Error extracting main points from message:', error);
    }

    // Update the next speaker based on turn history
    context.nextSpeaker = determineNextSpeaker(context.turnHistory || []);

    // Update the context in memory and database
    activeDebateContexts[debateId] = context;

    try {
        await updateDebateContextInDB(debateId, context);
    } catch (error) {
        console.error('Error updating debate context in database:', error);
    }

    return context;
}

/**
 * Get a concise summary of the current debate context
 * 
 * @param debateId Optional debate ID to get context for
 * @returns A string summary of the debate context
 */
export async function getDebateContextSummary(debateId?: string): Promise<string> {
    // If no debate ID is specified, provide a generic summary
    if (!debateId) {
        return "The debate is ongoing. Consider the points raised so far and respond accordingly.";
    }

    // Get the context from memory or database
    let context = activeDebateContexts[debateId];

    if (!context) {
        try {
            const debate = await getDebateById(debateId);
            context = debate?.context;

            if (context) {
                activeDebateContexts[debateId] = context;
            }
        } catch (error) {
            console.error(`Error loading debate context for ${debateId}:`, error);
            return "Unable to retrieve debate context. Please respond based on the most recent messages.";
        }
    }

    // If still no context, return generic message
    if (!context) {
        return "The debate is just starting. Provide your opening perspective on the topic.";
    }

    // Format the main points
    const mainPointsList = (context.mainPoints || [])
        .slice(-5) // Only the 5 most recent main points
        .map(point => `- ${point}`)
        .join('\n');

    // Format the user questions
    const userQuestionsList = (context.userQuestions || [])
        .slice(-3) // Only the 3 most recent questions
        .map(question => `- ${question}`)
        .join('\n');

    // Create the summary
    const summary = `
Current Debate Context:

${mainPointsList ? `Main points raised:\n${mainPointsList}\n` : 'No main points have been established yet.'}

${userQuestionsList ? `Recent user questions:\n${userQuestionsList}\n` : 'No user questions have been asked yet.'}

${context.nextSpeaker ? `The next speaker should be: ${context.nextSpeaker}` : ''}
`.trim();

    return summary;
}

/**
 * Determine which expert should speak next based on turn history
 * 
 * @param turnHistory The history of turns in the debate
 * @returns The ID or name of the next speaker
 */
export function determineNextSpeaker(
    turnHistory: TurnRecord[] | Message[]
): string {
    // If no turn history, return empty string (any speaker can go first)
    if (!turnHistory || turnHistory.length === 0) {
        return '';
    }

    // For typed TurnRecord array
    if ('speakerId' in turnHistory[turnHistory.length - 1]) {
        const records = turnHistory as TurnRecord[];

        // Get unique speaker IDs excluding 'user'
        const expertIds = [...new Set(records
            .map(turn => turn.speakerId)
            .filter(id => id !== 'user')
        )];

        // If only one expert, they should speak after the user
        if (expertIds.length === 1) {
            const lastSpeakerId = records[records.length - 1].speakerId;
            return lastSpeakerId === 'user' ? expertIds[0] : 'user';
        }

        // If multiple experts, they should take turns
        if (expertIds.length > 1) {
            const lastSpeakerId = records[records.length - 1].speakerId;

            // If last speaker was user, first expert should speak
            if (lastSpeakerId === 'user') {
                return expertIds[0];
            }

            // If last speaker was an expert, find the next one
            const lastExpertIndex = expertIds.indexOf(lastSpeakerId);
            if (lastExpertIndex >= 0) {
                // Next expert in the list, or back to the first if we're at the end
                return expertIds[(lastExpertIndex + 1) % expertIds.length];
            }

            // Fallback
            return expertIds[0];
        }
    }
    // For Message array
    else if ('role' in turnHistory[turnHistory.length - 1]) {
        const messages = turnHistory as Message[];

        // Get unique expert names
        const expertNames = [...new Set(messages
            .filter(msg => msg.role === 'assistant' && msg.senderInfo?.type === 'expert')
            .map(msg => msg.senderInfo?.name || '')
            .filter(name => name.length > 0)
        )];

        // Simple alternating logic
        const lastMsg = messages[messages.length - 1];

        // If last message was from user, first expert should speak
        if (lastMsg.role === 'user') {
            return expertNames[0] || '';
        }

        // If last message was from an expert, find the next one
        if (lastMsg.role === 'assistant' && lastMsg.senderInfo?.type === 'expert') {
            const lastExpertName = lastMsg.senderInfo.name || '';
            const lastExpertIndex = expertNames.indexOf(lastExpertName);

            if (lastExpertIndex >= 0) {
                // Next expert in the list, or back to the first if we're at the end
                return expertNames[(lastExpertIndex + 1) % expertNames.length];
            }
        }
    }

    // Fallback
    return '';
}

/**
 * Simulate "thinking" by adding a delay before responding
 * 
 * @param minSeconds Minimum seconds to delay
 * @param maxSeconds Maximum seconds to delay
 * @returns A promise that resolves after the delay
 */
export async function simulateThinking(
    minSeconds: number = 2,
    maxSeconds: number = 5
): Promise<void> {
    // Calculate a random delay within the specified range
    const delayMs = Math.floor(Math.random() * (maxSeconds - minSeconds + 1) + minSeconds) * 1000;

    // Return a promise that resolves after the delay
    return new Promise(resolve => setTimeout(resolve, delayMs));
}

/**
 * Extract key points from a message
 * 
 * @param messageContent The content of the message
 * @returns Array of key points
 */
async function extractKeyPointsFromMessage(messageContent: string): Promise<string[]> {
    try {
        // Skip short messages
        if (messageContent.length < 50) {
            return [];
        }

        const model = createChatModel({
            temperature: 0.3,
            maxTokens: 300
        });

        const systemPrompt = `Extract the 2-3 most important key points from the following message.
Return each point as a concise sentence on a new line.
Focus on the core claims or arguments, not background details.
Do not add any commentary, numbering, or bullet points.`;

        const response = await model.call([
            new SystemMessage(systemPrompt),
            new HumanMessage(messageContent)
        ]);

        // Split by newlines and remove empty lines
        return (response.content as string)
            .split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0);
    } catch (error) {
        console.error('Error extracting key points:', error);
        return [];
    }
}

/**
 * Extract main points from a message
 * 
 * @param messageContent The content of the message
 * @returns Array of main points
 */
async function extractMainPointsFromMessage(messageContent: string): Promise<string[]> {
    // This could have more sophisticated logic to extract debate-level points
    // For now, we'll reuse the key points extraction logic
    return extractKeyPointsFromMessage(messageContent);
}

/**
 * Extract questions from a user message
 * 
 * @param messageContent The content of the user message
 * @returns Array of questions
 */
async function extractQuestionsFromMessage(messageContent: string): Promise<string[]> {
    try {
        const model = createChatModel({
            temperature: 0.2,
            maxTokens: 200
        });

        const systemPrompt = `Identify any explicit or implicit questions in the following user message.
For each question, extract or reformulate it as a clear, standalone question.
Return each question on a new line.
If there are no questions, return an empty response.`;

        const response = await model.call([
            new SystemMessage(systemPrompt),
            new HumanMessage(messageContent)
        ]);

        // Split by newlines and remove empty lines
        return (response.content as string)
            .split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0 && line.endsWith('?'));
    } catch (error) {
        console.error('Error extracting questions:', error);
        return [];
    }
} 