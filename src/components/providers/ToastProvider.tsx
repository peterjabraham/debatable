'use client';

import React from 'react';
import {
    Toast,
    ToastProvider as RadixToastProvider,
    ToastViewport,
    ToastTitle,
    ToastDescription,
    ToastClose,
    ToastAction,
} from '@/components/ui/toast';
import { useToast } from '@/lib/hooks/useToast';

function ToastList() {
    const { toasts, removeToast } = useToast();

    return (
        <>
            {toasts.map((toast) => (
                <Toast
                    key={toast.id}
                    variant={toast.type === 'error' ? 'destructive' : toast.type === 'success' ? 'success' : toast.type === 'warning' ? 'warning' : 'default'}
                    onOpenChange={(open) => {
                        if (!open) removeToast(toast.id);
                    }}
                >
                    <div className="grid gap-1">
                        <ToastTitle>{toast.title}</ToastTitle>
                        <ToastDescription>{toast.message}</ToastDescription>
                    </div>
                    {toast.action && (
                        <ToastAction
                            altText={toast.action.label}
                            onClick={toast.action.onClick}
                        >
                            {toast.action.label}
                        </ToastAction>
                    )}
                    <ToastClose />
                </Toast>
            ))}
            <ToastViewport />
        </>
    );
}

// Renamed to avoid conflicts with UI module
export function AppToastProvider({ children }: { children: React.ReactNode }) {
    return (
        <RadixToastProvider>
            {children}
            <ToastList />
        </RadixToastProvider>
    );
} 