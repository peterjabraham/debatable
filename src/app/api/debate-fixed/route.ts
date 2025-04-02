import { NextRequest, NextResponse } from 'next/server';
import { Message } from '@/types/message';
import { Expert } from '@/types/expert';
import { v4 as uuidv4 } from 'uuid';
import { DebateStorage } from '@/lib/storage/debate-storage';
import { selectExperts } from '@/lib/ai/expert-selector';
import openai, { calculateCost, getModel } from '@/lib/ai/openai-client';

// Safe response generator that doesn't depend on document-processor
async function generateResponseSafe(
    expert: Expert,
    topic: string,
    messages: Message[]
): Promise<{ response: string; usage: any }> {
    try {
        console.log(`Generating response for ${expert.name} on topic: ${topic}`);

        // Prepare the system prompt
        let systemPrompt = `You are ${expert.name}, ${expert.title}`;

        if ('era' in expert) {
            systemPrompt += ` from ${expert.era}`;
        } else if ('field' in expert) {
            systemPrompt += `, an expert in ${expert.field}`;
        }

        systemPrompt += `. ${expert.bio}
  
  You are participating in a debate on the topic: "${topic}"
  
  Your perspective on this topic is: ${expert.perspective}
  
  Respond in the first person as if you are ${expert.name}. Use language, references, and examples that would be authentic to your character and time period. Keep your responses concise (3-5 sentences) but insightful.`;

        // Format messages for the API
        const formattedMessages = messages.map(message => ({
            role: message.role === 'user' ? 'user' : 'assistant',
            content: message.role === 'assistant'
                ? `${message.speaker}: ${message.content}`
                : message.content
        }));

        // Make the OpenAI API call
        const response = await openai.chat.completions.create({
            model: getModel(),
            messages: [
                { role: 'system', content: systemPrompt },
                ...formattedMessages
            ],
            temperature: 0.7,
            max_tokens: 1000
        });

        // Extract the content
        const content = response.choices[0]?.message?.content;
        if (!content) {
            throw new Error('No response from OpenAI');
        }

        // Calculate usage
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

// Handle GET requests
export async function GET(request: NextRequest) {
    console.log('Debate-Fixed API GET called');

    try {
        const { searchParams } = request.nextUrl;
        const action = searchParams.get('action');
        const debateId = searchParams.get('debateId');

        console.log('Debate-Fixed API GET params:', { action, debateId });

        // Handle test action
        if (action === 'test') {
            return NextResponse.json({
                status: 'success',
                message: 'Debate-Fixed API test endpoint is working',
                timestamp: new Date().toISOString()
            });
        }

        // If debateId is provided, try to fetch debate data
        if (debateId) {
            try {
                const debateStorage = await DebateStorage.getInstance();
                const debate = await debateStorage.getDebate(debateId);

                if (!debate) {
                    return NextResponse.json(
                        { error: `Debate with ID ${debateId} not found` },
                        { status: 404 }
                    );
                }

                return NextResponse.json(debate);
            } catch (error) {
                console.error('Error fetching debate:', error);
                return NextResponse.json(
                    { error: 'Failed to fetch debate data' },
                    { status: 500 }
                );
            }
        }

        // Default response if no specific action
        return NextResponse.json({
            status: 'success',
            message: 'Debate-Fixed API is working',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error in Debate-Fixed API GET:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

// Handle POST requests
export async function POST(request: NextRequest) {
    console.log('Debate-Fixed API POST called');

    try {
        const { searchParams } = request.nextUrl;
        const action = searchParams.get('action');
        const body = await request.json();

        console.log('Debate-Fixed API POST params:', { action, body });

        // Handle different actions
        switch (action) {
            case 'select-experts':
                return handleSelectExperts(body);
            case 'initialize-debate':
                return handleInitializeDebate(body);
            case 'generate-response':
                try {
                    // Check if we should use real API - prioritize NEXT_PUBLIC_USE_REAL_API env var
                    const useRealApi = process.env.NEXT_PUBLIC_USE_REAL_API === 'true';
                    const useMockData = process.env.USE_MOCK_DATA === 'true';

                    // Use real API when explicitly requested or when not explicitly mocked
                    if (useRealApi || (!useMockData && process.env.NODE_ENV !== 'development')) {
                        console.log('Generating real response with OpenAI (forced real mode)');
                        const { expert, topic, messages } = body;

                        if (!expert || !topic || !messages) {
                            return NextResponse.json(
                                { error: 'Missing required fields: expert, topic, messages' },
                                { status: 400 }
                            );
                        }

                        const result = await generateResponseSafe(expert, topic, messages);
                        console.log('Response generated successfully');

                        return NextResponse.json(result);
                    }

                    // Fall back to mock response only if explicitly configured
                    if (useMockData) {
                        console.log('Using mock response as configured');
                        return NextResponse.json({
                            response: "This is a mock response because USE_MOCK_DATA=true. Set NEXT_PUBLIC_USE_REAL_API=true to force real API usage.",
                            usage: {
                                promptTokens: 100,
                                completionTokens: 50,
                                totalTokens: 150,
                                cost: 0.002
                            }
                        });
                    }

                    // Default to real API
                    console.log('Generating real response with OpenAI (default behavior)');
                    const { expert, topic, messages } = body;

                    if (!expert || !topic || !messages) {
                        return NextResponse.json(
                            { error: 'Missing required fields: expert, topic, messages' },
                            { status: 400 }
                        );
                    }

                    const result = await generateResponseSafe(expert, topic, messages);
                    console.log('Response generated successfully');

                    return NextResponse.json(result);

                } catch (error) {
                    console.error('Error generating response:', error);
                    return NextResponse.json(
                        {
                            error: 'Failed to generate response',
                            message: error instanceof Error ? error.message : 'Unknown error'
                        },
                        { status: 500 }
                    );
                }
            default:
                return NextResponse.json(
                    { error: 'Invalid action specified' },
                    { status: 400 }
                );
        }
    } catch (error) {
        console.error('Error in Debate-Fixed API POST:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

// Helper function to handle expert selection
async function handleSelectExperts(body: any) {
    try {
        const { topic, expertType = 'historical', count = 2 } = body;

        if (!topic) {
            return NextResponse.json(
                { error: 'Topic is required' },
                { status: 400 }
            );
        }

        const experts = await selectExperts(topic, expertType, count);
        return NextResponse.json({ experts });
    } catch (error) {
        console.error('Error selecting experts:', error);
        return NextResponse.json(
            { error: 'Failed to select experts' },
            { status: 500 }
        );
    }
}

// Helper function to initialize a debate
async function handleInitializeDebate(body: any) {
    try {
        const { topic, experts, userId = 'anonymous' } = body;

        if (!topic || !experts || !Array.isArray(experts)) {
            return NextResponse.json(
                { error: 'Topic and experts array are required' },
                { status: 400 }
            );
        }

        // Generate a unique debate ID
        const debateId = uuidv4();

        // Initialize debate in storage
        const debateStorage = await DebateStorage.getInstance();
        const result = await debateStorage.initializeDebate(
            debateId,
            topic,
            experts,
            userId
        );

        if (!result.success) {
            return NextResponse.json(
                { error: result.error || 'Failed to initialize debate' },
                { status: 500 }
            );
        }

        return NextResponse.json({ debateId, topic, experts });
    } catch (error) {
        console.error('Error initializing debate:', error);
        return NextResponse.json(
            { error: 'Failed to initialize debate' },
            { status: 500 }
        );
    }
} 