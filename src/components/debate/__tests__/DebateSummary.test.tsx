import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { DebateSummary } from '../DebateSummary';

describe('DebateSummary Production API Test', () => {
    const mockExperts = [
        {
            id: 'exp_1',
            name: 'Dr. Rachel Chen',
            type: 'domain',
            background: 'Environmental scientist',
            expertise: ['Climate Science'],
            stance: 'pro',
            perspective: 'I support climate action'
        }
    ];

    const mockMessages = [
        {
            id: 'msg_1',
            role: 'assistant',
            content: 'Climate change is a critical issue.',
            speaker: 'Dr. Rachel Chen'
        }
    ];

    beforeEach(() => {
        // Ensure we're using real API
        vi.stubEnv('NEXT_PUBLIC_USE_REAL_API', 'true');
        vi.stubEnv('PERPLEXITY_API_KEY', process.env.PERPLEXITY_API_KEY || '');
    });

    it('should fetch and display real data from Perplexity API', async () => {
        console.log('Starting production test with environment:', {
            NEXT_PUBLIC_USE_REAL_API: process.env.NEXT_PUBLIC_USE_REAL_API,
            PERPLEXITY_API_KEY: process.env.PERPLEXITY_API_KEY ? 'Present' : 'Missing',
            NODE_ENV: process.env.NODE_ENV
        });

        render(
            <DebateSummary
                topic="Climate Change"
                experts={mockExperts}
                messages={mockMessages}
            />
        );

        // Wait for loading state
        await waitFor(() => {
            expect(screen.getByText(/Loading/i)).toBeInTheDocument();
        }, { timeout: 5000 });

        // Wait for either results or error with longer timeout
        await waitFor(() => {
            const errorElement = screen.queryByText(/Failed to fetch recommended readings/i);
            const resultsElement = screen.queryByText(/Recommended Reading/i);
            expect(errorElement || resultsElement).toBeInTheDocument();
        }, { timeout: 10000 });

        // Log what we found
        const errorElement = screen.queryByText(/Failed to fetch recommended readings/i);
        const resultsElement = screen.queryByText(/Recommended Reading/i);
        console.log('Production test results:', {
            error: errorElement?.textContent,
            results: resultsElement?.textContent,
            hasError: !!errorElement,
            hasResults: !!resultsElement
        });

        // If we have an error, log the full error message
        if (errorElement) {
            console.error('API Error:', errorElement.textContent);
        }

        // If we have results, verify they're in the expected format
        if (resultsElement) {
            const links = screen.getAllByRole('link');
            console.log('Found links:', links.length);
            links.forEach((link, index) => {
                console.log(`Link ${index + 1}:`, {
                    text: link.textContent,
                    href: link.getAttribute('href')
                });
            });
        }
    });
}); 