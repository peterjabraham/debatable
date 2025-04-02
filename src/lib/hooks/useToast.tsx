'use client';

import { useState, useCallback } from 'react';
import { AppError } from '../errors/types';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
    id: string;
    type: ToastType;
    title: string;
    message: string;
    duration?: number;
    action?: {
        label: string;
        onClick: () => void;
    };
}

interface ToastOptions {
    duration?: number;
    action?: {
        label: string;
        onClick: () => void;
    };
}

export const useToast = () => {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const addToast = useCallback(
        (type: ToastType, title: string, message: string, options?: ToastOptions) => {
            const id = Math.random().toString(36).substr(2, 9);
            const toast: Toast = {
                id,
                type,
                title,
                message,
                duration: options?.duration ?? 5000,
                action: options?.action,
            };

            setToasts((prev) => [...prev, toast]);

            if (toast.duration > 0) {
                setTimeout(() => {
                    removeToast(id);
                }, toast.duration);
            }

            return id;
        },
        []
    );

    const removeToast = useCallback((id: string) => {
        setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, []);

    const showError = useCallback(
        (error: AppError, options?: ToastOptions) => {
            const title = error.code.replace(/_/g, ' ').toLowerCase();
            addToast('error', title, error.message, {
                ...options,
                action: error.retryable
                    ? {
                        label: 'Retry',
                        onClick: options?.action?.onClick || (() => { }),
                    }
                    : options?.action,
            });
        },
        [addToast]
    );

    const showSuccess = useCallback(
        (title: string, message: string, options?: ToastOptions) => {
            addToast('success', title, message, options);
        },
        [addToast]
    );

    const showWarning = useCallback(
        (title: string, message: string, options?: ToastOptions) => {
            addToast('warning', title, message, options);
        },
        [addToast]
    );

    const showInfo = useCallback(
        (title: string, message: string, options?: ToastOptions) => {
            addToast('info', title, message, options);
        },
        [addToast]
    );

    return {
        toasts,
        showError,
        showSuccess,
        showWarning,
        showInfo,
        removeToast,
    };
}; 