/**
 * Fact Checking Agent
 * 
 * This module provides fact checking functionality for debate statements.
 * It uses LangChain to evaluate claims made during the debate.
 */

import { FactCheck, SourceReference } from '@/types/message';
import { createChatModel, agentConfig } from '../langchain-config';
import { HumanMessage, SystemMessage } from "@langchain/core/messages";

// In-memory cache for fact checks
const factCheckCache: Record<string, FactCheck> = {};

/**
 * Check the factual accuracy of a claim
 * 
 * @param claim The claim to check
 * @param topic The debate topic for context
 * @returns A fact check result
 */
export async function checkFactualAccuracy(
    claim: string,
    topic: string
): Promise<FactCheck> {
    // Create a cache key for this claim
    const cacheKey = `${claim.substring(0, 100)}`;

    // Return cached result if available
    if (factCheckCache[cacheKey]) {
        return factCheckCache[cacheKey];
    }

    console.log(`Checking factual accuracy of claim: "${claim.substring(0, 50)}..."`);

    try {
        // Create model for fact checking
        const model = createChatModel({
            temperature: 0.2, // Lower temperature for more factual evaluation
            maxTokens: 800
        });

        // Create the system prompt for fact checking
        const systemPrompt = `You are a fact-checking assistant evaluating claims made in a debate about "${topic}".

Your task is to assess the following claim for factual accuracy. Consider:
1. Is the claim objectively verifiable?
2. Is it supported by evidence and expert consensus?
3. Does it make reasonable interpretations of facts?
4. Does it include any logical fallacies or misleading statistics?

Provide your assessment of accuracy as one of the following:
- "true" (claim is factually accurate and fairly presented)
- "false" (claim is demonstrably incorrect)
- "partially true" (claim contains some truth but is missing context or has inaccuracies)
- "uncertain" (insufficient evidence to determine accuracy)

Format your response as JSON:
{
  "accuracy": "true|false|partially true|uncertain",
  "explanation": "Your detailed explanation of the assessment",
  "confidence": 0.XX, // your confidence in the assessment from 0 to 1
  "sources": [optional array of source references]
}`;

        // Get the response from the model
        const response = await model.call([
            new SystemMessage(systemPrompt),
            new HumanMessage(`Claim to fact-check: "${claim}"`)
        ]);

        // Parse the JSON response
        const content = response.content as string;
        const jsonMatch = content.match(/{[\s\S]*}/);

        let factCheck: FactCheck;

        if (jsonMatch) {
            try {
                factCheck = JSON.parse(jsonMatch[0]) as FactCheck;
            } catch (e) {
                // Fallback if JSON parsing fails
                factCheck = {
                    claim,
                    accuracy: 'uncertain',
                    explanation: 'Unable to assess due to technical issues',
                    confidence: 0.0
                };
            }
        } else {
            // Fallback if no JSON is found
            factCheck = {
                claim,
                accuracy: 'uncertain',
                explanation: 'Unable to extract a structured assessment',
                confidence: 0.0
            };
        }

        // Cache the result
        factCheckCache[cacheKey] = factCheck;

        return factCheck;
    } catch (error) {
        console.error('Error checking factual accuracy:', error);

        // Return a default fact check on error
        const defaultFactCheck: FactCheck = {
            claim,
            accuracy: 'uncertain',
            explanation: 'An error occurred during fact checking',
            confidence: 0.0
        };

        return defaultFactCheck;
    }
}

/**
 * Extract potential claims from a message that should be fact-checked
 * 
 * @param messageContent The message content to analyze
 * @param topic The debate topic
 * @returns Array of potential claims to check
 */
export async function extractClaimsToCheck(
    messageContent: string,
    topic: string
): Promise<string[]> {
    // Skip short messages
    if (messageContent.length < 50) {
        return [];
    }

    try {
        // Create model
        const model = createChatModel({
            temperature: 0.2,
            maxTokens: 500
        });

        // Create the system prompt
        const systemPrompt = `You are an assistant identifying factual claims within a debate message about "${topic}".

Analyze the following message and extract specific factual claims that should be fact-checked.
Focus on statements that:
1. Present specific statistics, numbers, or percentages
2. Make historical claims
3. Attribute opinions or actions to individuals or organizations
4. Present causal relationships
5. Make generalizations about groups

Return ONLY the claims, one per line, with no additional commentary.
Extract no more than 3 of the most important claims to verify.`;

        // Get response
        const response = await model.call([
            new SystemMessage(systemPrompt),
            new HumanMessage(messageContent)
        ]);

        // Split the response by lines and filter empty lines
        const claims = (response.content as string)
            .split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0);

        return claims;
    } catch (error) {
        console.error('Error extracting claims to check:', error);
        return [];
    }
} 