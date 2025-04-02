import { generateExpertResponses } from '../src/lib/responseGenerator';
import { openaiService } from '../src/lib/openai';

jest.mock('../src/lib/openai', () => ({
    openaiService: {
        createCompletion: jest.fn()
    }
}));

describe('Expert Response Generation', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('Expert responses should be under 1,000 characters', async () => {
        // Mock successful API response
        (openaiService.createCompletion as jest.Mock).mockResolvedValue({
            choices: [{
                message: {
                    function_call: {
                        arguments: JSON.stringify({
                            supporter_response: {
                                content: 'This is a supporter response that is well under 1,000 characters.'
                            },
                            opposer_response: {
                                content: 'This is an opposer response that is also well under 1,000 characters.'
                            }
                        })
                    }
                }
            }],
            usage: { prompt_tokens: 100, completion_tokens: 100, total_tokens: 200 }
        });

        // Arrange
        const topic = "Climate Change";
        const userMessage = "Solar energy is too expensive to be a viable solution for most countries.";
        const mockMessages = [
            {
                id: 'msg1',
                role: 'user',
                content: userMessage,
                speaker: 'You'
            }
        ];

        // Act
        const responses = await generateExpertResponses(mockMessages, topic);

        // Assert
        expect(responses.supporter.content.length).toBeLessThanOrEqual(1000);
        expect(responses.opposer.content.length).toBeLessThanOrEqual(1000);
    });

    test('Expert responses should be relevant to the debate topic', async () => {
        // Arrange
        const topic = "Artificial Intelligence";
        const userMessage = "AI will lead to mass unemployment.";
        const mockMessages = [
            {
                id: 'msg1',
                role: 'user',
                content: userMessage,
                speaker: 'You'
            }
        ];

        // Mock API response with topic-relevant content
        (openaiService.createCompletion as jest.Mock).mockResolvedValue({
            choices: [{
                message: {
                    function_call: {
                        arguments: JSON.stringify({
                            supporter_response: {
                                content: 'While AI will automate many jobs, it will create new opportunities in technology sectors.'
                            },
                            opposer_response: {
                                content: 'AI poses serious risks to employment as automation replaces human workers across industries.'
                            }
                        })
                    }
                }
            }],
            usage: { prompt_tokens: 100, completion_tokens: 100, total_tokens: 200 }
        });

        // Act
        const responses = await generateExpertResponses(mockMessages, topic);

        // Assert
        expect(responses.supporter.content).toContain('AI');
        expect(responses.opposer.content).toContain('employment');
        // Check for topic relevance using key terms
        const relevantTerms = ['automation', 'jobs', 'technology', 'workers'];
        expect(relevantTerms.some(term =>
            responses.supporter.content.toLowerCase().includes(term) ||
            responses.opposer.content.toLowerCase().includes(term)
        )).toBe(true);
    });

    test('Expert responses should directly address user input', async () => {
        // Arrange
        const topic = "Education Reform";
        const userMessage = "Standardized testing fails to measure student abilities accurately.";
        const mockMessages = [
            {
                id: 'msg1',
                role: 'user',
                content: userMessage,
                speaker: 'You'
            }
        ];

        // Mock API response that addresses user input
        (openaiService.createCompletion as jest.Mock).mockResolvedValue({
            choices: [{
                message: {
                    function_call: {
                        arguments: JSON.stringify({
                            supporter_response: {
                                content: 'You raise a valid point about standardized testing. These tests often fail to capture creative thinking and practical skills that are essential in today\'s world.'
                            },
                            opposer_response: {
                                content: 'While standardized testing has limitations, it provides objective measures that help identify educational gaps across different demographics.'
                            }
                        })
                    }
                }
            }],
            usage: { prompt_tokens: 100, completion_tokens: 100, total_tokens: 200 }
        });

        // Act
        const responses = await generateExpertResponses(mockMessages, topic);

        // Assert
        expect(responses.supporter.content).toContain('testing');
        expect(responses.opposer.content).toContain('testing');
        expect(responses.supporter.content).toContain('standardized');
        expect(responses.opposer.content).toContain('standardized');
    });

    test('Expert responses should maintain conversation context', async () => {
        // Arrange
        const topic = "Healthcare";
        const initialPrompt = "Universal healthcare would improve public health outcomes.";
        const followUpMessage = "But wouldn't it increase wait times for procedures?";

        // Create multi-turn conversation context
        const mockMessages = [
            {
                id: 'msg1',
                role: 'user',
                content: initialPrompt,
                speaker: 'You'
            },
            {
                id: 'msg2',
                role: 'assistant',
                content: 'As a supporter, I believe universal healthcare would indeed improve outcomes by increasing access for all citizens...',
                speaker: 'Supporter'
            },
            {
                id: 'msg3',
                role: 'assistant',
                content: 'As an opposer, I must point out that universal systems often lead to inefficiencies and lower quality care...',
                speaker: 'Opposer'
            },
            {
                id: 'msg4',
                role: 'user',
                content: followUpMessage,
                speaker: 'You'
            }
        ];

        // Mock API response that maintains context
        (openaiService.createCompletion as jest.Mock).mockResolvedValue({
            choices: [{
                message: {
                    function_call: {
                        arguments: JSON.stringify({
                            supporter_response: {
                                content: 'Regarding wait times in universal healthcare, evidence from countries with successful systems shows that proper resource allocation can maintain reasonable wait times while ensuring everyone has access.'
                            },
                            opposer_response: {
                                content: 'You\'ve identified a key problem with universal healthcare - increased demand without proportional increase in resources inevitably leads to longer wait times, as seen in Canada and the UK.'
                            }
                        })
                    }
                }
            }],
            usage: { prompt_tokens: 200, completion_tokens: 150, total_tokens: 350 }
        });

        // Act
        const responses = await generateExpertResponses(mockMessages, topic);

        // Assert
        expect(responses.supporter.content).toContain('wait time');
        expect(responses.opposer.content).toContain('wait time');
        // Verify responses reference previous context
        expect(responses.supporter.content).toContain('universal');
        expect(responses.opposer.content).toContain('universal');
    });

    test('System should use mock responses when API fails', async () => {
        // Arrange
        const topic = "Space Exploration";
        const userMessage = "Private companies should lead space exploration, not governments.";
        const mockMessages = [
            {
                id: 'msg1',
                role: 'user',
                content: userMessage,
                speaker: 'You'
            }
        ];

        // Mock API failure
        (openaiService.createCompletion as jest.Mock).mockRejectedValue(new Error('API Error'));

        // Act
        const responses = await generateExpertResponses(mockMessages, topic);

        // Assert
        expect(responses.supporter).not.toBeNull();
        expect(responses.opposer).not.toBeNull();
        expect(responses.supporter.content.length).toBeGreaterThan(0);
        expect(responses.opposer.content.length).toBeGreaterThan(0);
        expect(responses.isMockResponse).toBe(true);
    });
}); 