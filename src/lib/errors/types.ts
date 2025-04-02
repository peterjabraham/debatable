export type ErrorCode =
    | 'VALIDATION_ERROR'
    | 'AUTHENTICATION_ERROR'
    | 'AUTHORIZATION_ERROR'
    | 'NOT_FOUND'
    | 'API_ERROR'
    | 'NETWORK_ERROR'
    | 'STORAGE_ERROR'
    | 'VOICE_SYNTHESIS_ERROR'
    | 'EXPERT_SELECTION_ERROR'
    | 'DEBATE_INITIALIZATION_ERROR'
    | 'RESPONSE_GENERATION_ERROR';

export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface AppError {
    code: ErrorCode;
    message: string;
    severity: ErrorSeverity;
    timestamp: number;
    retryable: boolean;
    context?: Record<string, unknown>;
    originalError?: unknown;
}

export class ApplicationError extends Error {
    constructor(public error: AppError) {
        super(error.message);
        this.name = 'ApplicationError';
    }
}

export const createError = (
    code: ErrorCode,
    message: string,
    severity: ErrorSeverity = 'medium',
    retryable = false,
    context?: Record<string, unknown>,
    originalError?: unknown
): AppError => ({
    code,
    message,
    severity,
    timestamp: Date.now(),
    retryable,
    context,
    originalError
});

export const isRetryableError = (error: AppError): boolean => {
    return error.retryable || [
        'NETWORK_ERROR',
        'API_ERROR',
        'STORAGE_ERROR'
    ].includes(error.code);
};

export const getErrorMessage = (error: unknown): string => {
    if (error instanceof ApplicationError) {
        return error.error.message;
    }
    if (error instanceof Error) {
        return error.message;
    }
    return String(error);
}; 