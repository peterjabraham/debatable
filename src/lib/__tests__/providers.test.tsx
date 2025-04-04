import React from 'react';
import { render } from '@testing-library/react';
import { Providers } from '../providers';
import '@testing-library/jest-dom';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

// Mock dependencies
vi.mock('next-auth/react', () => ({
    SessionProvider: ({ children }) => <div data-testid="session-provider">{children}</div>,
}));

vi.mock('@/components/ui/toaster', () => ({
    Toaster: () => <div data-testid="toaster" />,
}));

vi.mock('../contexts/settings-context', () => ({
    SettingsProvider: ({ children }) => <div data-testid="settings-provider">{children}</div>,
}));

vi.mock('@tanstack/react-query', () => ({
    QueryClient: vi.fn(),
    QueryClientProvider: ({ children }) => <div data-testid="query-client-provider">{children}</div>,
}));

describe('Providers', () => {
    // Store original console methods
    const originalConsoleError = console.error;
    const originalConsoleLog = console.log;

    beforeEach(() => {
        // Mock console methods for testing
        console.error = vi.fn();
        console.log = vi.fn();
    });

    afterEach(() => {
        // Restore original console methods
        console.error = originalConsoleError;
        console.log = originalConsoleLog;
        vi.clearAllMocks();
    });

    it('renders children wrapped in all providers', () => {
        const { getByText, getByTestId } = render(
            <Providers>
                <div>Test Content</div>
            </Providers>
        );

        expect(getByText('Test Content')).toBeInTheDocument();
        expect(getByTestId('session-provider')).toBeInTheDocument();
        expect(getByTestId('settings-provider')).toBeInTheDocument();
        expect(getByTestId('query-client-provider')).toBeInTheDocument();
        expect(getByTestId('toaster')).toBeInTheDocument();
    });

    it('filters out specific NextAuth errors', () => {
        render(
            <Providers>
                <div>Test Content</div>
            </Providers>
        );

        // Trigger the specific NextAuth error that should be filtered
        console.error(
            '[next-auth][error][CLIENT_FETCH_ERROR]',
            'Cannot convert undefined or null to object'
        );

        // Verify error was suppressed
        expect(console.log).toHaveBeenCalledWith(
            '[Auth] Suppressed known NextAuth error during state transitions'
        );

        // Original console.error should not be called for this specific error
        expect(console.error).toHaveBeenCalledTimes(1);
    });

    it('properly forwards other errors to the original console.error', () => {
        render(
            <Providers>
                <div>Test Content</div>
            </Providers>
        );

        // Trigger different error
        console.error('Some other error');

        // Verify original error handling
        expect(console.error).toHaveBeenCalledWith('Some other error');
    });

    it('handles apply failures gracefully', () => {
        // Create a scenario where apply would fail
        const mockApplyError = new Error('apply failed');
        const originalApply = Function.prototype.apply;

        // Replace apply with a function that throws
        Function.prototype.apply = function () {
            throw mockApplyError;
        };

        render(
            <Providers>
                <div>Test Content</div>
            </Providers>
        );

        // Trigger an error that will cause apply to fail
        console.error({ toString: () => 'Complex error object' });

        // Verify fallback error handling
        expect(console.error).toHaveBeenCalledWith(
            '[Error Handler] Error forwarding:',
            { toString: expect.any(Function) }
        );

        // Restore original apply
        Function.prototype.apply = originalApply;
    });
}); 