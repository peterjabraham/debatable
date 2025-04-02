import { NextRequest, NextResponse } from 'next/server';
import { getUserById, createUser, createDefaultUserProfile } from '@/lib/db/models/user';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

// Simple in-memory cache to prevent repeated profile creation within a short timeframe
// This prevents the issue of multiple components requesting the profile simultaneously
// and all of them creating new users when none exists
const userCreationCache: Record<string, { timestamp: number, pending: boolean, attempts: number }> = {};
const CACHE_TTL = 30000; // 30 seconds
const MAX_ATTEMPTS = 3;

/**
 * GET /api/user/profile
 * Fetch a user's profile
 */
export async function GET() {
    try {
        // Check if user is authenticated
        const session = await getServerSession(authOptions);

        if (!session || !session.user || !session.user.id) {
            console.log('Unauthenticated request to user profile API - returning empty response');

            // Return 401 unauthorized instead of mock data to force proper authentication
            return NextResponse.json(
                { error: 'Authentication required' },
                { status: 401 }
            );
        }

        // Get user profile from database
        const userId = session.user.id;
        console.log(`Fetching profile for user ID: ${userId}`);

        try {
            let userProfile = await getUserById(userId);

            // Check if we need to create a new user profile
            if (!userProfile) {
                console.log(`No existing profile found for ID: ${userId}`);

                // Check cache to see if we're already creating this user
                const now = Date.now();
                const cacheEntry = userCreationCache[userId];

                if (cacheEntry) {
                    // If profile creation is already in progress, wait for a moment and try again
                    if (cacheEntry.pending) {
                        console.log(`User creation for ${userId} already in progress, waiting...`);

                        // Increment attempts
                        userCreationCache[userId].attempts = (cacheEntry.attempts || 0) + 1;

                        // If we've tried too many times, just create a new profile
                        if (userCreationCache[userId].attempts > MAX_ATTEMPTS) {
                            console.log(`Exceeded max attempts for ${userId}, force creating new profile`);
                            delete userCreationCache[userId];
                        } else {
                            // Wait 500ms to give time for the other request to complete
                            await new Promise(resolve => setTimeout(resolve, 500));

                            // Try again to see if the profile was created
                            userProfile = await getUserById(userId);

                            if (userProfile) {
                                console.log(`Profile for ${userId} was created by another request`);
                                return NextResponse.json(userProfile);
                            }
                        }
                    } else if (now - cacheEntry.timestamp < CACHE_TTL) {
                        // If profile was recently created but not found, something's wrong
                        // Let's clear the cache and try again
                        console.log(`User ${userId} should have been created but wasn't found, retrying`);
                        delete userCreationCache[userId];
                    }
                }

                // Mark this user as being created
                userCreationCache[userId] = { timestamp: now, pending: true, attempts: 0 };
                console.log(`Creating new profile for user ID: ${userId}`);

                // Use session data to create a basic profile
                const userData = {
                    id: userId,
                    email: session.user.email || `${userId}@example.com`,
                    name: session.user.name || 'New User',
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    lastLoginAt: new Date().toISOString(),
                    profilePicture: session.user.image || null,
                    preferredLanguage: 'en',
                    preferredTopics: [],
                    expertTypes: ['ai', 'historical'],
                    settings: {
                        notifications: true,
                        theme: 'system'
                    }
                };

                try {
                    userProfile = await createUser(userData);
                    console.log(`Successfully created new profile for user ID: ${userId}`);

                    // Update cache to mark creation as complete
                    userCreationCache[userId] = { timestamp: Date.now(), pending: false, attempts: 0 };
                } catch (createError) {
                    // Remove from cache on error
                    delete userCreationCache[userId];

                    const errorMessage = createError instanceof Error ? createError.message : 'Unknown error';
                    console.error('Error creating new user profile:', errorMessage);

                    return NextResponse.json(
                        { error: `Failed to create user profile: ${errorMessage}` },
                        { status: 500 }
                    );
                }
            }

            // Final check to make sure we have a profile after all attempts
            if (!userProfile) {
                return NextResponse.json(
                    { error: "Failed to retrieve or create user profile" },
                    { status: 500 }
                );
            }

            return NextResponse.json(userProfile);
        } catch (dbError) {
            // Reset cache entry if there was an error
            if (userCreationCache[userId]) {
                delete userCreationCache[userId];
            }

            const errorMessage = dbError instanceof Error ? dbError.message : 'Unknown database error';
            console.error('Database error fetching user profile:', errorMessage);

            return NextResponse.json(
                { error: `Database error: ${errorMessage}` },
                { status: 500 }
            );
        }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('Error in user profile API:', errorMessage);

        return NextResponse.json(
            { error: `Server error: ${errorMessage}` },
            { status: 500 }
        );
    }
} 