"use client";

import React, { useState, useEffect } from 'react';
import { Loader2, CheckCircle, XCircle, Info } from 'lucide-react';

export type NotificationStatus = 'loading' | 'success' | 'error' | 'info';

export interface NotificationProps {
    status: NotificationStatus;
    title: string;
    message?: string;
    duration?: number; // Duration in milliseconds, 0 for persistent
    onClose?: () => void;
}

export function Notification({
    status,
    title,
    message,
    duration = 5000,
    onClose,
}: NotificationProps) {
    const [isVisible, setIsVisible] = useState(true);

    useEffect(() => {
        if (duration > 0 && status !== 'loading') {
            const timer = setTimeout(() => {
                setIsVisible(false);
                onClose?.();
            }, duration);

            return () => clearTimeout(timer);
        }
    }, [duration, status, onClose]);

    if (!isVisible) return null;

    return (
        <div className="fixed top-0 left-0 right-0 z-[100] mx-auto max-w-md w-full md:w-auto">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border p-4 flex items-start gap-3 m-2">
                {status === 'loading' && (
                    <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
                )}
                {status === 'success' && (
                    <CheckCircle className="w-5 h-5 text-green-500" />
                )}
                {status === 'error' && (
                    <XCircle className="w-5 h-5 text-red-500" />
                )}
                {status === 'info' && (
                    <Info className="w-5 h-5 text-blue-500" />
                )}

                <div className="flex-1">
                    <h4 className="text-sm font-medium">{title}</h4>
                    {message && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{message}</p>
                    )}
                </div>

                <button
                    onClick={() => {
                        setIsVisible(false);
                        onClose?.();
                    }}
                    className="text-gray-400 hover:text-gray-500 dark:text-gray-500 dark:hover:text-gray-400"
                >
                    <span className="sr-only">Close</span>
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>
        </div>
    );
}

export interface NotificationProviderProps {
    children: React.ReactNode;
}

interface NotificationContextState {
    notifications: Array<NotificationProps & { id: string }>;
    addNotification: (notification: Omit<NotificationProps, 'onClose'>) => string;
    updateNotification: (id: string, notification: Partial<NotificationProps>) => void;
    removeNotification: (id: string) => void;
}

export const NotificationContext = React.createContext<NotificationContextState | undefined>(undefined);

export function NotificationProvider({ children }: NotificationProviderProps) {
    const [notifications, setNotifications] = useState<Array<NotificationProps & { id: string }>>([]);

    const addNotification = (notification: Omit<NotificationProps, 'onClose'>) => {
        const id = `notification-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        setNotifications(prev => [...prev, { ...notification, id, onClose: () => removeNotification(id) }]);
        return id;
    };

    const updateNotification = (id: string, notification: Partial<NotificationProps>) => {
        setNotifications(prev =>
            prev.map(n =>
                n.id === id ? { ...n, ...notification } : n
            )
        );
    };

    const removeNotification = (id: string) => {
        setNotifications(prev => prev.filter(n => n.id !== id));
    };

    return (
        <NotificationContext.Provider value={{ notifications, addNotification, updateNotification, removeNotification }}>
            {children}
            <div className="fixed top-0 left-0 right-0 z-[100] mx-auto flex flex-col items-center gap-2 pt-2">
                {notifications.map(notification => (
                    <Notification
                        key={notification.id}
                        status={notification.status}
                        title={notification.title}
                        message={notification.message}
                        duration={notification.duration}
                        onClose={() => removeNotification(notification.id)}
                    />
                ))}
            </div>
        </NotificationContext.Provider>
    );
}

export function useNotification() {
    const context = React.useContext(NotificationContext);
    if (context === undefined) {
        throw new Error('useNotification must be used within a NotificationProvider');
    }
    return context;
} 