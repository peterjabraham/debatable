import { Message } from '@/types/message';
import { manageConversationContext } from './contextManager';
import { generateSupporterResponse, generateOpposerResponse } from './mockResponses';
import { openaiService } from './openai';

/**
 * Response structure returned by generateExpertResponses
 */
export interface ExpertResponses {
    supporter: Message;
    opposer: Message;
    isMockResponse: boolean;
}

/**
 * Function to parse the JSON response from OpenAI
 * Safely handles potential JSON parsing errors
 */
function safeParseJson(jsonString: string): any {
    try {
        return JSON.parse(jsonString);
    } catch (error) {
        console.error('Error parsing JSON response:', error);
        // Extract data using regex as fallback
        try {
            const supporterMatch = jsonString.match(/"supporter_response":\s*{\s*"content":\s*"([^"]+)"/);
            const opposerMatch = jsonString.match(/"opposer_response":\s*{\s*"content":\s*"([^"]+)"/);

            return {
                supporter_response: {
                    content: supporterMatch ? supporterMatch[1] : "I support this position based on the available evidence."
                },
                opposer_response: {
                    content: opposerMatch ? opposerMatch[1] : "I challenge this position due to several important concerns."
                }
            };
        } catch (regexError) {
            console.error('Regex fallback failed:', regexError);
            return {
                supporter_response: {
                    content: "I support this position based on the available evidence."
                },
                opposer_response: {
                    content: "I challenge this position due to several important concerns."
                }
            };
        }
    }
}

/**
 * Generates mock expert responses when the API call fails
 * @param messages Previous conversation messages
 * @param topic The debate topic
 * @returns Mock supporter and opposer responses
 */
function generateMockResponses(
    messages: Message[],
    topic: string
): ExpertResponses {
    // Get the last user message
    const lastUserMessage = messages.findLast(msg => msg.role === 'user')?.content || '';

    // Generate contextual mock responses based on topic and last message
    let supporterContent = generateSupporterResponse(topic, lastUserMessage);
    let opposerContent = generateOpposerResponse(topic, lastUserMessage);

    return {
        supporter: {
            id: `msg_supporter_${Date.now()}`,
            role: 'assistant',
            content: supporterContent.substring(0, 1000),
            speaker: 'Supporter',
            usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
        },
        opposer: {
            id: `msg_opposer_${Date.now()}`,
            role: 'assistant',
            content: opposerContent.substring(0, 1000),
            speaker: 'Opposer',
            usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
        },
        isMockResponse: true
    };
}

/**
 * Generates expert responses (supporter and opposer) for a given topic and conversation context
 * @param messages Previous conversation messages
 * @param topic The debate topic
 * @returns Supporter and opposer responses
 */
export async function generateExpertResponses(
    messages: Message[],
    topic: string
): Promise<ExpertResponses> {
    try {
        // Prepare optimized context for the API call
        const context = manageConversationContext(messages, topic);

        console.log(`Generating expert responses for topic: ${topic} with ${context.length} context messages`);

        // Call OpenAI API
        const apiResponse = await openaiService.createCompletion({
            model: "gpt-4o",
            messages: context,
            temperature: 0.7,
            response_format: { type: "json_object" },
            // Request the response in a specific format with function calling
            function_call: {
                name: "generate_debate_responses",
                arguments: JSON.stringify({
                    topic: topic,
                    supporter_response: {
                        content: "Limited to 1000 characters",
                        perspective: "pro",
                    },
                    opposer_response: {
                        content: "Limited to 1000 characters",
                        perspective: "con",
                    }
                })
            }
        });

        // Parse API response
        const functionArgs = apiResponse.choices[0].message.function_call?.arguments || '{}';
        const responseData = safeParseJson(functionArgs);

        console.log('Received API response for debate experts');

        return {
            supporter: {
                id: `msg_supporter_${Date.now()}`,
                role: 'assistant',
                content: responseData.supporter_response.content.substring(0, 1000), // Enforce 1000 char limit
                speaker: 'Supporter',
                usage: apiResponse.usage
            },
            opposer: {
                id: `msg_opposer_${Date.now()}`,
                role: 'assistant',
                content: responseData.opposer_response.content.substring(0, 1000), // Enforce 1000 char limit
                speaker: 'Opposer',
                usage: apiResponse.usage
            },
            isMockResponse: false
        };
    } catch (error) {
        console.error('Error generating expert responses:', error);
        console.log('Falling back to mock responses');

        // Fallback to mock responses
        return generateMockResponses(messages, topic);
    }
} 