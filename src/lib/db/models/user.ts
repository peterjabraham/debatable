import { v4 as uuid } from 'uuid';
import { firestore, COLLECTIONS, createDocument, getDocument, updateDocument, deleteDocument, queryDocuments } from '../firestore';

// Function to check if Firestore is enabled
function isFirestoreEnabled() {
    // Always return true since we've migrated fully to Firestore
    return true;
}

export interface User {
    id: string;
    email: string;
    name?: string;
    createdAt?: string;
    updatedAt?: string;
    lastLoginAt?: string;
    metadata?: Record<string, any>;
    isAnonymous?: boolean;
}

export interface UserProfile extends User {
    preferredLanguage?: string;
    preferredTopics?: string[];
    expertTypes?: string[];
    settings?: {
        notifications?: boolean;
        theme?: string;
    };
}

export interface CreateUserParams {
    email: string;
    name: string;
    profilePicture?: string;
}

/**
 * Create a new user profile in Firestore
 */
export async function createUser(userData: Partial<User>): Promise<User> {
    try {
        console.log('Creating user with data:', userData);

        // Ensure we have valid data
        const safeUserData = userData || {};

        // Ensure required fields
        if (!safeUserData.email) {
            safeUserData.email = `user-${Date.now()}@example.com`;
        }

        const user = await createDocument(COLLECTIONS.USERS, safeUserData);
        console.log('User created successfully:', user.id);
        return user as User;
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error creating user';
        console.error('Error in createUser:', errorMessage);
        throw error;
    }
}

/**
 * Get a user by ID from Firestore
 */
export async function getUserById(id: string): Promise<UserProfile | null> {
    if (!id) {
        console.error('Invalid user ID provided to getUserById');
        throw new Error('Invalid user ID provided');
    }

    try {
        console.log(`Getting user by ID: ${id}`);
        return await getDocument(COLLECTIONS.USERS, id) as UserProfile | null;
    } catch (error) {
        // Safely log error without passing null to source mapping
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('Error in getUserById:', errorMessage);

        // Re-throw the error to be handled by the API route
        throw error;
    }
}

/**
 * Get a user by email from Firestore
 */
export async function getUserByEmail(email: string): Promise<UserProfile | null> {
    if (!email) {
        console.error('Invalid email provided to getUserByEmail');
        throw new Error('Invalid email provided');
    }

    try {
        console.log(`Getting user by email: ${email}`);

        // Use the queryDocuments function from firestore.ts
        const users = await queryDocuments(COLLECTIONS.USERS, [
            { field: 'email', operator: '==', value: email }
        ]);

        if (!users || users.length === 0) {
            console.log(`No user found with email: ${email}`);
            return null;
        }

        return users[0] as UserProfile;
    } catch (error) {
        // Safely log error without passing null to source mapping
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('Error in getUserByEmail:', errorMessage);

        // Re-throw the error to be handled by the API route
        throw error;
    }
}

/**
 * Update a user's profile in Firestore
 */
export async function updateUserProfile(userId: string, profileData: Partial<UserProfile>): Promise<UserProfile> {
    if (!userId) {
        console.error('updateUserProfile called with invalid userId');
        throw new Error('Invalid user ID provided');
    }

    try {
        console.log('Updating user profile for ID:', userId);

        // Ensure we have valid data
        const safeProfileData = profileData || {};

        const updatedUser = await updateDocument(COLLECTIONS.USERS, userId, safeProfileData);
        return updatedUser as UserProfile;
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('Error in updateUserProfile:', errorMessage);
        throw error;
    }
}

/**
 * Delete a user from Firestore
 */
export async function deleteUser(id: string): Promise<boolean> {
    try {
        await deleteDocument(COLLECTIONS.USERS, id);
        return true;
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('Error in deleteUser:', errorMessage);
        throw error;
    }
}

/**
 * Create a default user profile (not a mock)
 */
export function createDefaultUserProfile(id: string): UserProfile {
    const now = new Date().toISOString();

    return {
        id: id || 'anonymous',
        email: `${id}@example.com`,
        name: 'Guest User',
        profilePicture: 'https://i.pravatar.cc/150?u=' + id,
        preferredLanguage: 'en',
        preferredTopics: [],
        expertTypes: ['ai'],
        settings: {
            notifications: true,
            theme: 'system'
        },
        createdAt: now,
        updatedAt: now
    };
} 