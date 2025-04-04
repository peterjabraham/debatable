import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ContentUploader } from '../ContentUploader';
import { useDebateStore } from '@/lib/store';
import { useNotification } from '@/components/ui/notification';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom';

// Mock the store
vi.mock('@/lib/store', () => ({
    useDebateStore: vi.fn(),
}));

// Mock the notification hook
vi.mock('@/components/ui/notification', () => ({
    useNotification: vi.fn(),
}));

// Mock fetch
global.fetch = vi.fn();

describe('ContentUploader args handling', () => {
    // Focus just on testing the args conversion
    it('handles topic extraction results with args instead of arguments properly', async () => {
        // Mock the hooks
        vi.mocked(useDebateStore).mockReturnValue({
            setTopic: vi.fn(),
        });

        vi.mocked(useNotification).mockReturnValue({
            addNotification: vi.fn().mockReturnValue('mock-id'),
            updateNotification: vi.fn(),
            removeNotification: vi.fn(),
        });

        // Mock API response with 'args' property instead of 'arguments'
        vi.mocked(global.fetch).mockResolvedValue({
            ok: true,
            text: vi.fn().mockResolvedValue(JSON.stringify({
                topics: [
                    {
                        title: 'Backend Format Topic',
                        confidence: 0.9,
                        // Note: Using 'args' instead of 'arguments'
                        args: [
                            {
                                claim: 'This is from the backend',
                                evidence: 'Should be properly handled',
                            },
                        ],
                    },
                ],
            }))
        } as any);

        render(<ContentUploader />);

        // Select document tab and upload a file
        const documentTab = screen.getByText('Document');
        fireEvent.click(documentTab);

        // Upload a PDF file
        const fileInput = screen.getByLabelText(/click to upload/i);
        const mockFile = new File(['test content'], 'test.pdf', { type: 'application/pdf' });
        fireEvent.change(fileInput, { target: { files: [mockFile] } });

        // Find all Extract Topics buttons and click the first non-disabled one
        const buttons = screen.getAllByRole('button', { name: /extract topics/i });
        const activeButton = buttons.find(button => !button.hasAttribute('disabled'));
        expect(activeButton).toBeDefined();
        fireEvent.click(activeButton);

        // The component should handle the 'args' property and display it correctly
        await waitFor(() => {
            // Topic title should be displayed
            expect(screen.getByText('Backend Format Topic')).toBeInTheDocument();

            // The claim from args should be converted to arguments and displayed
            expect(screen.getByText('This is from the backend')).toBeInTheDocument();
        });
    });
}); 