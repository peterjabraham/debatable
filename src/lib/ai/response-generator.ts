import { Expert } from '@/types/expert';
import { Message } from '@/types/message';
import openai, { calculateCost, getModel } from './openai-client';

// Import document processor conditionally to prevent build issues
let documentProcessor: any;

// In production, use the safe version
if (process.env.NODE_ENV === 'production') {
    // Use the safe document processor that doesn't depend on problematic libraries
    console.log('Using safe document processor for production');
    import('./document-processor-safe').then(module => {
        documentProcessor = module.documentProcessor;
    }).catch(error => {
        console.error('Failed to load safe document processor:', error);
        // Create simple mock if even the safe version fails
        documentProcessor = {
            retrieveRelevantContent: async () => []
        };
    });
} else {
    // In development, try to use the full version
    try {
        console.log('Using full document processor for development');
        import('./document-processor').then(module => {
            documentProcessor = module.documentProcessor;
        }).catch(error => {
            console.error('Failed to load document processor:', error);
            // Fallback to simple mock
            documentProcessor = {
                retrieveRelevantContent: async () => []
            };
        });
    } catch (error) {
        console.error('Error importing document processor:', error);
        // Fallback to simple mock
        documentProcessor = {
            retrieveRelevantContent: async () => []
        };
    }
}

export async function generateResponse(
    expert: Expert,
    topic: string,
    messages: Message[],
    useCitations: boolean = true,
    debateId?: string
): Promise<{ response: string; usage: any }> {
    try {
        // Log explicitly that we're using the real OpenAI API
        console.log(`Using REAL OpenAI API with key format: ${process.env.OPENAI_API_KEY?.substring(0, 7)}...`);
        console.log(`OpenAI model in use: ${getModel()}`);
        console.log(`Environment: ${process.env.NODE_ENV}`);
        console.log(`USE_MOCK_DATA: ${process.env.USE_MOCK_DATA}`);
        console.log(`NEXT_PUBLIC_USE_REAL_API: ${process.env.NEXT_PUBLIC_USE_REAL_API}`);

        const lastUserMessage = messages
            .filter(m => m.role === 'user')
            .pop();

        let relevantContent: string = '';
        if (debateId && lastUserMessage && documentProcessor) {
            try {
                const results = await documentProcessor.retrieveRelevantContent(
                    lastUserMessage.content,
                    debateId
                );

                if (results.length > 0) {
                    relevantContent = results
                        .map((result: any, index: number) => `[${index + 1}] ${result.text.trim()} (relevance: ${Math.round(result.score * 100)}%)`)
                        .join('\n\n');
                }
            } catch (error) {
                console.error('Error retrieving relevant content:', error);
            }
        }

        const systemPrompt = getSystemPrompt(expert, topic, useCitations, relevantContent);
        const formattedMessages = formatMessagesForAPI(messages);

        const response = await openai.chat.completions.create({
            model: getModel(),
            messages: [
                { role: 'system', content: systemPrompt },
                ...formattedMessages
            ],
            temperature: 0.7,
            max_tokens: 1000
        });

        const content = response.choices[0]?.message?.content;
        if (!content) {
            throw new Error('No response from OpenAI');
        }

        const usage = {
            promptTokens: response.usage?.prompt_tokens || 0,
            completionTokens: response.usage?.completion_tokens || 0,
            totalTokens: response.usage?.total_tokens || 0,
            cost: calculateCost(response.usage?.total_tokens || 0)
        };

        return { response: content, usage };
    } catch (error) {
        console.error('Error generating response:', error);
        throw error;
    }
}

function getSystemPrompt(
    expert: Expert,
    topic: string,
    useCitations: boolean,
    relevantContent?: string
): string {
    let prompt = `You are ${expert.name}, ${expert.title}`;

    if ('era' in expert) {
        prompt += ` from ${expert.era}`;
    } else if ('field' in expert) {
        prompt += `, an expert in ${expert.field}`;
    }

    prompt += `. ${expert.bio}
  
  You are participating in a debate on the topic: "${topic}"
  
  Your perspective on this topic is: ${expert.perspective}
  
  Respond in the first person as if you are ${expert.name}. Use language, references, and examples that would be authentic to your character and time period. Keep your responses concise (3-5 sentences) but insightful.`;

    if (relevantContent) {
        prompt += `
  
  RELEVANT DOCUMENT CONTENT:
  ${relevantContent}
  
  When answering, use the provided document content to inform your response. Cite specific information from the document when possible. If the document content is relevant to the question, prioritize using that information over general knowledge.`;
    }

    if (useCitations && expert.sourceReferences) {
        prompt += `
    
    When appropriate, cite sources using the format [Citation: X] where X is a number. For example: "The data shows a clear trend [Citation: 1]."
    
    You have access to the following sources:
    ${expert.sourceReferences.map((ref, i) => `${i + 1}. ${ref.title} - ${ref.author || 'Unknown'} (${ref.year || 'Unknown'})`).join('\n')}`;
    }

    return prompt;
}

function formatMessagesForAPI(messages: Message[]): { role: string; content: string }[] {
    return messages.map(message => ({
        role: message.role === 'user' ? 'user' : 'assistant',
        content: message.role === 'assistant'
            ? `${message.speaker}: ${message.content}`
            : message.content
    }));
} 