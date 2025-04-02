import { UserProfile } from '@/lib/db/models/user';

/**
 * Mock user profiles for development
 */
export const mockUsers: Record<string, UserProfile> = {
    // Default mock user
    'default': {
        id: 'mock-user-123',
        email: 'user@example.com',
        name: 'Test User',
        profilePicture: 'https://api.dicebear.com/7.x/avataaars/svg?seed=TestUser',
        preferences: {
            defaultExpertType: 'domain',
            useVoiceSynthesis: false,
            theme: 'system',
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    },

    // Admin user
    'admin': {
        id: 'mock-admin-456',
        email: 'admin@example.com',
        name: 'Admin User',
        profilePicture: 'https://api.dicebear.com/7.x/avataaars/svg?seed=AdminUser',
        preferences: {
            defaultExpertType: 'historical',
            useVoiceSynthesis: true,
            theme: 'dark',
        },
        createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days ago
        updatedAt: new Date().toISOString(),
    }
};

/**
 * Get a mock user profile by ID
 */
export function getMockUserProfile(userId: string): UserProfile {
    // If the user ID matches a specific mock user, return it
    if (mockUsers[userId]) {
        return { ...mockUsers[userId] };
    }

    // Otherwise, return the default mock user with the requested ID
    return {
        ...mockUsers.default,
        id: userId,
        name: `User ${userId.slice(0, 5)}`,
        profilePicture: `https://api.dicebear.com/7.x/avataaars/svg?seed=${userId}`,
    };
} 