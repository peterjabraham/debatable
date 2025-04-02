'use client';

import { useState, useCallback } from 'react';
import { AppError, ApplicationError, ErrorCode, createError, isRetryableError } from '../errors/types';

interface ErrorState {
    error: AppError | null;
    retryCount: number;
}

interface ErrorHandlerOptions {
    maxRetries?: number;
    onError?: (error: AppError) => void;
    onRetry?: () => void;
}

export const useErrorHandler = (options: ErrorHandlerOptions = {}) => {
    const { maxRetries = 3, onError, onRetry } = options;
    const [errorState, setErrorState] = useState<ErrorState>({
        error: null,
        retryCount: 0,
    });

    const clearError = useCallback(() => {
        setErrorState({ error: null, retryCount: 0 });
    }, []);

    const handleError = useCallback(
        (error: unknown, context?: Record<string, unknown>) => {
            let appError: AppError;

            if (error instanceof ApplicationError) {
                appError = error.error;
            } else {
                // Convert unknown error to AppError
                appError = createError(
                    'API_ERROR',
                    error instanceof Error ? error.message : 'An unexpected error occurred',
                    'medium',
                    true,
                    context,
                    error
                );
            }

            setErrorState(prev => ({
                error: appError,
                retryCount: prev.retryCount + 1,
            }));

            onError?.(appError);

            // Return whether the operation can be retried
            return (
                isRetryableError(appError) &&
                errorState.retryCount < maxRetries
            );
        },
        [maxRetries, onError, errorState.retryCount]
    );

    const retry = useCallback(async () => {
        if (!errorState.error || errorState.retryCount >= maxRetries) {
            return false;
        }

        onRetry?.();
        return true;
    }, [errorState.error, errorState.retryCount, maxRetries, onRetry]);

    return {
        error: errorState.error,
        retryCount: errorState.retryCount,
        handleError,
        clearError,
        retry,
        canRetry: errorState.error ? isRetryableError(errorState.error) && errorState.retryCount < maxRetries : false,
    };
};

export type ErrorHandler = ReturnType<typeof useErrorHandler>; 