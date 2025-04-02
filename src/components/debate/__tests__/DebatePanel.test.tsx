import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DebatePanel } from '../DebatePanel';
import { getMultiExpertRecommendedReading } from '@/lib/api/perplexity';

// Mock the perplexity API
vi.mock('@/lib/api/perplexity', () => ({
    getMultiExpertRecommendedReading: vi.fn(),
    getMockExpertRecommendedReading: vi.fn(),
}));

describe('DebatePanel', () => {
    const mockExperts = [
        { name: 'John Doe', stance: 'pro' },
        { name: 'Jane Smith', stance: 'con' }
    ];

    const mockMessages = [
        { role: 'assistant', speaker: 'John Doe', content: 'This is a test message from John.' },
        { role: 'assistant', speaker: 'Jane Smith', content: 'This is a test message from Jane.' },
        { role: 'user', content: 'This is a user message.' }
    ];

    const mockTopic = 'Test Topic';

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should fetch Perplexity results when debate ends', async () => {
        // Mock the API response
        const mockApiResponse = {
            'John Doe': [
                {
                    id: '1',
                    url: 'https://example.com/1',
                    title: 'Test Paper 1',
                    snippet: 'Test snippet 1'
                }
            ],
            'Jane Smith': [
                {
                    id: '2',
                    url: 'https://example.com/2',
                    title: 'Test Paper 2',
                    snippet: 'Test snippet 2'
                }
            ]
        };

        (getMultiExpertRecommendedReading as any).mockResolvedValue(mockApiResponse);

        // Render the component
        render(
            <DebatePanel
                topic={mockTopic}
                experts={mockExperts}
                messages={mockMessages}
            />
        );

        // Find and click the End Debate button
        const endDebateButton = screen.getByText(/End Debate/i);
        fireEvent.click(endDebateButton);

        // Verify the API was called with correct parameters
        await waitFor(() => {
            expect(getMultiExpertRecommendedReading).toHaveBeenCalledWith(
                ['John Doe', 'Jane Smith'],
                mockTopic
            );
        });

        // Verify the results are displayed in the summary
        await waitFor(() => {
            expect(screen.getByText('Test Paper 1')).toBeInTheDocument();
            expect(screen.getByText('Test Paper 2')).toBeInTheDocument();
        });
    });

    it('should handle API errors when ending debate', async () => {
        // Mock the API to throw an error
        (getMultiExpertRecommendedReading as any).mockRejectedValue(new Error('API Error'));

        // Render the component
        render(
            <DebatePanel
                topic={mockTopic}
                experts={mockExperts}
                messages={mockMessages}
            />
        );

        // Find and click the End Debate button
        const endDebateButton = screen.getByText(/End Debate/i);
        fireEvent.click(endDebateButton);

        // Verify error message is displayed
        await waitFor(() => {
            expect(screen.getByText(/Failed to fetch recommended readings/i)).toBeInTheDocument();
        });
    });

    it('should not fetch readings if debate ends without topic or experts', async () => {
        // Render with missing topic
        render(
            <DebatePanel
                topic=""
                experts={mockExperts}
                messages={mockMessages}
            />
        );

        // Find and click the End Debate button
        const endDebateButton = screen.getByText(/End Debate/i);
        fireEvent.click(endDebateButton);

        // Verify no API call was made
        expect(getMultiExpertRecommendedReading).not.toHaveBeenCalled();

        // Render with no experts
        render(
            <DebatePanel
                topic={mockTopic}
                experts={[]}
                messages={mockMessages}
            />
        );

        // Find and click the End Debate button
        const endDebateButton2 = screen.getByText(/End Debate/i);
        fireEvent.click(endDebateButton2);

        // Verify no API call was made
        expect(getMultiExpertRecommendedReading).not.toHaveBeenCalled();
    });
}); 