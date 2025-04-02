'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';

// Type definitions
export interface UserProfile {
    id: string;
    email: string;
    name?: string;
    profilePicture?: string | null;
    createdAt?: string;
    updatedAt?: string;
    lastLoginAt?: string;
    preferredLanguage?: string;
    preferredTopics?: string[];
    expertTypes?: string[];
    settings?: {
        notifications?: boolean;
        theme?: string;
    };
    isGuest?: boolean;
    isFallback?: boolean;
    isTemporary?: boolean;
}

// Default profile for when no profile exists yet
const getDefaultUserProfile = (userId?: string, userEmail?: string | null, userName?: string | null, userImage?: string | null): UserProfile => ({
    id: userId || 'guest-user',
    email: userEmail || 'guest@example.com',
    name: userName || 'Guest User',
    profilePicture: userImage || null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lastLoginAt: new Date().toISOString(),
    preferredLanguage: 'en',
    preferredTopics: [],
    expertTypes: ['ai', 'historical'],
    settings: {
        notifications: true,
        theme: 'system'
    },
    isTemporary: true
});

/**
 * Hook to fetch and cache user profile data
 * @returns The user profile data, loading state, and error
 */
export function useUser() {
    const { data: session, status } = useSession();
    const queryClient = useQueryClient();

    // Use React Query to fetch and cache user profile
    const {
        data: profile,
        isLoading,
        error,
        refetch
    } = useQuery({
        queryKey: ['userProfile', session?.user?.id],
        queryFn: async (): Promise<UserProfile> => {
            console.log('Fetching user profile data from API');
            const response = await fetch('/api/user/profile');
            if (!response.ok) {
                throw new Error('Failed to fetch profile');
            }
            const userData = await response.json();

            // Migrate domain -> ai in expertTypes if needed
            if (userData.expertTypes && userData.expertTypes.includes('domain')) {
                console.log('Migrating domain -> ai in expertTypes');

                // Replace domain with ai
                const updatedExpertTypes = userData.expertTypes.map(
                    (type: string) => type === 'domain' ? 'ai' : type
                );

                // Update the profile with new expert types
                try {
                    const updateResponse = await fetch('/api/user/profile/update', {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ expertTypes: updatedExpertTypes }),
                    });

                    if (updateResponse.ok) {
                        console.log('Successfully migrated domain -> ai in expertTypes');
                        const updatedData = await updateResponse.json();
                        return {
                            ...userData,
                            expertTypes: updatedExpertTypes
                        };
                    }
                } catch (err) {
                    console.error('Failed to migrate domain -> ai:', err);
                    // Return the original profile with manual fix applied
                    return {
                        ...userData,
                        expertTypes: updatedExpertTypes
                    };
                }
            }

            // If we got a temporary profile, schedule a refetch
            if (userData.isTemporary) {
                console.log('Got temporary profile, scheduling refetch');
                setTimeout(() => refetch(), 2000);
            }

            return userData;
        },
        // Only fetch if authenticated
        enabled: status === 'authenticated',
        // Keep cached profile for longer
        staleTime: 1000 * 60 * 10, // 10 minutes
        cacheTime: 1000 * 60 * 30, // 30 minutes
        // Use placeholder data if available
        placeholderData: () => {
            // First try to get user from React Query cache
            const cachedData = queryClient.getQueryData<UserProfile>(['userProfile', session?.user?.id]);
            if (cachedData) return cachedData;

            // Fall back to default profile based on session
            if (session?.user) {
                return getDefaultUserProfile(
                    session.user.id,
                    session.user.email,
                    session.user.name,
                    session.user.image
                );
            }

            return getDefaultUserProfile();
        },
        // Retry options 
        retry: 2,
        retryDelay: 1000,
    });

    // Mutation for updating user profile
    const { mutateAsync: updateProfile, isPending: isUpdating } = useMutation({
        mutationFn: async (newData: Partial<UserProfile>) => {
            const response = await fetch('/api/user/profile/update', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(newData),
            });

            if (!response.ok) {
                throw new Error('Failed to update profile');
            }

            return response.json();
        },
        onSuccess: (updatedProfile) => {
            // Optimistically update the cached profile
            queryClient.setQueryData(['userProfile', session?.user?.id], (oldData: UserProfile | undefined) => {
                if (!oldData) return updatedProfile;
                return { ...oldData, ...updatedProfile.profile };
            });
        },
    });

    return {
        profile,
        isLoading,
        isUpdating,
        error,
        updateProfile,
        refetchProfile: refetch,
        isAuthenticated: status === 'authenticated',
        isAnonymous: status === 'unauthenticated',
    };
} 