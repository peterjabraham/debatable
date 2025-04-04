'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const router = useRouter();

    // This would normally check for admin permissions
    useEffect(() => {
        // For demonstration purposes, we're not implementing actual auth checks
        console.log('Admin layout mounted');
    }, []);

    return (
        <div className="min-h-screen">
            <div className="container mx-auto py-4">
                <h1 className="text-2xl font-bold mb-4">Admin Dashboard</h1>
                {children}
            </div>
        </div>
    );
} 