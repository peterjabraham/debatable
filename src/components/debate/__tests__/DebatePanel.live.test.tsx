import '../../../lib/api/__tests__/setup';
import { describe, it, expect, beforeAll } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DebatePanel } from '../DebatePanel';
import { ThemeProvider } from '@/components/ThemeProvider';
import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/card';
import { MessageBubble } from '@/components/debate/MessageBubble';

// Mock UI components
vi.mock('@/components/ui/button', () => ({
    Button: ({ children, onClick, ...props }: any) => (
        <button onClick={onClick} {...props}>{children}</button>
    )
}));

vi.mock('@/components/ui/input', () => ({
    Input: ({ onChange, ...props }: any) => (
        <input onChange={onChange} {...props} />
    )
}));

// Mock icons
vi.mock('@/components/ui/icons', () => ({
    BookOpenIcon: () => <div data-testid="book-open-icon" />,
    SendIcon: () => <div data-testid="send-icon" />,
    MicrophoneIcon: () => <div data-testid="microphone-icon" />,
    StopIcon: () => <div data-testid="stop-icon" />,
}));

const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
    >
        <div className="debate-panel-test-wrapper">
            {children}
        </div>
    </ThemeProvider>
);

const customRender = (ui: React.ReactElement) => {
    return render(ui, { wrapper: Wrapper });
};

describe('DebatePanel Live Integration', () => {
    const mockExperts = [
        {
            name: 'Dr. Rachel Chen',
            stance: 'Supporting',
            background: 'Environmental scientist with expertise in climate change research',
            expertise: ['Climate Science', 'Environmental Policy']
        },
        {
            name: 'Professor Michael Torres',
            stance: 'Opposing',
            background: 'Economic policy analyst specializing in resource allocation',
            expertise: ['Economic Policy', 'Resource Management']
        }
    ];

    it('should generate real initial expert responses', async () => {
        customRender(
            <DebatePanel
                topic="What are the most effective solutions to climate change?"
                experts={mockExperts}
                messages={[]}
            />
        );

        // Wait for initial responses
        await waitFor(async () => {
            // First wait for the panel to be rendered
            const panel = await screen.findByTestId('debate-panel');
            expect(panel).toBeTruthy();

            // Then wait for messages to appear
            const messages = await screen.findAllByRole('article');
            expect(messages.length).toBeGreaterThan(1); // Should have at least 2 expert responses
        }, { timeout: 30000 });
    });

    it('should handle real-time user interaction', async () => {
        customRender(
            <DebatePanel
                topic="What are the economic implications of climate change policies?"
                experts={mockExperts}
                messages={[]}
            />
        );

        // Wait for initial responses
        await waitFor(async () => {
            const messages = await screen.findAllByRole('article');
            expect(messages.length).toBeGreaterThan(1);
        }, { timeout: 30000 });

        // Find and interact with input
        const input = await screen.findByPlaceholderText(/Enter your message/i);
        expect(input).toBeTruthy();

        fireEvent.change(input, {
            target: { value: 'How would carbon pricing affect different industries?' }
        });

        const sendButton = await screen.findByRole('button', { name: /send/i });
        expect(sendButton).toBeTruthy();

        fireEvent.click(sendButton);

        // Wait for new responses
        await waitFor(async () => {
            const messages = await screen.findAllByRole('article');
            // Should have initial messages + user message + at least one response
            expect(messages.length).toBeGreaterThan(3);
        }, { timeout: 30000 });
    });

    it('should maintain context in extended conversations', async () => {
        const initialMessages = [
            {
                role: 'user',
                content: 'What are the main challenges in implementing climate policies?'
            },
            {
                role: 'assistant',
                content: 'The main challenges include economic costs, political resistance, and technological limitations.',
                name: mockExperts[0].name
            }
        ];

        customRender(
            <DebatePanel
                topic="Climate Policy Implementation"
                experts={mockExperts}
                messages={initialMessages}
            />
        );

        // Wait for initial render
        await waitFor(async () => {
            const messages = await screen.findAllByRole('article');
            expect(messages.length).toBeGreaterThan(1);
        }, { timeout: 30000 });

        // Send follow-up
        const input = await screen.findByPlaceholderText(/Enter your message/i);
        fireEvent.change(input, {
            target: { value: 'Can you elaborate on the economic costs?' }
        });

        const sendButton = await screen.findByRole('button', { name: /send/i });
        fireEvent.click(sendButton);

        // Wait for contextual responses
        await waitFor(async () => {
            const messages = await screen.findAllByRole('article');
            // Should have initial messages + new user message + at least one response
            expect(messages.length).toBeGreaterThan(3);
        }, { timeout: 30000 });
    });
}); 