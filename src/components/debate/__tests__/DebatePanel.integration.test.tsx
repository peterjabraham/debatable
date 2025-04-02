import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DebatePanel } from '../DebatePanel';
import { generateDebateResponseServer as generateDebateResponse } from '@/lib/openai';

// Mock the OpenAI API
vi.mock('@/lib/openai', () => ({
    generateDebateResponseServer: vi.fn()
}));

// Mock all UI components
vi.mock('@/components/ui/button', () => ({
    Button: ({ children, ...props }: any) => <button {...props}>{children}</button>
}));

vi.mock('@/components/ui/input', () => ({
    Input: ({ ...props }: any) => <input {...props} />
}));

// Mock layout components
vi.mock('@/components/ui/card', () => ({
    Card: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    CardHeader: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    CardContent: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    CardFooter: ({ children, ...props }: any) => <div {...props}>{children}</div>,
}));

// Mock message components
vi.mock('@/components/debate/MessageBubble', () => ({
    MessageBubble: ({ children, content, ...props }: any) => <div {...props}>{content || children}</div>
}));

// Mock icons
vi.mock('@/components/ui/icons', () => ({
    BookOpenIcon: () => <div data-testid="book-open-icon" />,
    SendIcon: () => <div data-testid="send-icon" />,
    MicrophoneIcon: () => <div data-testid="microphone-icon" />,
    StopIcon: () => <div data-testid="stop-icon" />,
}));

// Create a wrapper component for providers
const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <div className="debate-panel-test-wrapper">
        {children}
    </div>
);

// Update the render function to use the wrapper
const customRender = (ui: React.ReactElement) => {
    return render(ui, { wrapper: Wrapper });
};

describe('DebatePanel Integration with OpenAI', () => {
    const mockExperts = [
        {
            name: 'Dr. Rachel Chen',
            stance: 'Supporting',
            background: 'Environmental scientist',
            expertise: ['Climate change', 'Sustainability']
        },
        {
            name: 'Professor Michael Torres',
            stance: 'Opposing',
            background: 'Economic policy analyst',
            expertise: ['Economic policy', 'Resource allocation']
        }
    ];

    const mockUsage = {
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
        cost: 0.002
    };

    beforeEach(() => {
        vi.clearAllMocks();
        // Reset environment variables
        process.env.NEXT_PUBLIC_USE_REAL_API = 'true';
        process.env.OPENAI_API_KEY = 'test-key';
    });

    it('should generate initial expert responses when debate starts', async () => {
        // Mock the OpenAI response
        (generateDebateResponse as any).mockResolvedValueOnce({
            response: 'Initial response from Dr. Chen',
            usage: mockUsage
        });
        (generateDebateResponse as any).mockResolvedValueOnce({
            response: 'Initial response from Prof. Torres',
            usage: mockUsage
        });

        customRender(
            <DebatePanel
                topic="Is earth flat?"
                experts={mockExperts}
                messages={[]}
            />
        );

        // Wait for initial responses to be generated
        await waitFor(() => {
            expect(generateDebateResponse).toHaveBeenCalledTimes(2);
            expect(screen.getByText('Initial response from Dr. Chen')).toBeInTheDocument();
            expect(screen.getByText('Initial response from Prof. Torres')).toBeInTheDocument();
        });
    });

    it('should handle user input and generate expert responses', async () => {
        // Mock the OpenAI responses
        (generateDebateResponse as any).mockResolvedValueOnce({
            response: 'Response to user from Dr. Chen',
            usage: mockUsage
        });
        (generateDebateResponse as any).mockResolvedValueOnce({
            response: 'Response to user from Prof. Torres',
            usage: mockUsage
        });

        customRender(
            <DebatePanel
                topic="Is earth flat?"
                experts={mockExperts}
                messages={[]}
            />
        );

        // Find and fill the input field
        const input = screen.getByPlaceholderText(/Enter your message/i);
        fireEvent.change(input, { target: { value: 'What about satellite images?' } });

        // Submit the message
        const sendButton = screen.getByText(/Send/i);
        fireEvent.click(sendButton);

        // Wait for expert responses
        await waitFor(() => {
            expect(generateDebateResponse).toHaveBeenCalledTimes(2);
            expect(screen.getByText('Response to user from Dr. Chen')).toBeInTheDocument();
            expect(screen.getByText('Response to user from Prof. Torres')).toBeInTheDocument();
        });
    });

    it('should handle API errors gracefully', async () => {
        // Mock API error
        (generateDebateResponse as any).mockRejectedValue(new Error('API Error'));

        customRender(
            <DebatePanel
                topic="Is earth flat?"
                experts={mockExperts}
                messages={[]}
            />
        );

        // Wait for error message
        await waitFor(() => {
            expect(screen.getByText(/Failed to generate response/i)).toBeInTheDocument();
        });
    });

    it('should use mock responses when NEXT_PUBLIC_USE_REAL_API is false', async () => {
        process.env.NEXT_PUBLIC_USE_REAL_API = 'false';

        customRender(
            <DebatePanel
                topic="Is earth flat?"
                experts={mockExperts}
                messages={[]}
            />
        );

        // Wait for mock responses
        await waitFor(() => {
            const messages = screen.getAllByText(/Mock response|As an expert/i);
            expect(messages.length).toBeGreaterThan(0);
        });

        // Verify no real API calls were made
        expect(generateDebateResponse).not.toHaveBeenCalled();
    });
}); 