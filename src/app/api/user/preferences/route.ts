import { NextRequest, NextResponse } from 'next/server';
import { getUserById, updateUserProfile, createUser } from '@/lib/db/models/user';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

/**
 * GET /api/user/preferences
 * Fetch a user's preferences
 */
export async function GET() {
    try {
        // Check if user is authenticated
        const session = await getServerSession(authOptions);

        if (!session || !session.user || !session.user.id) {
            console.error('Unauthorized access attempt to user preferences API');
            return NextResponse.json(
                { error: 'Unauthorized: Please sign in to access this resource' },
                { status: 401 }
            );
        }

        // Get user preferences from database
        const userId = session.user.id;
        console.log(`Fetching preferences for user ID: ${userId}`);

        try {
            let userProfile = await getUserById(userId);

            // Create a new user profile if one doesn't exist
            if (!userProfile) {
                console.log(`No existing profile found for ID: ${userId}, creating new profile`);

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
                } catch (createError) {
                    const errorMessage = createError instanceof Error ? createError.message : 'Unknown error';
                    console.error('Error creating new user profile:', errorMessage);

                    return NextResponse.json(
                        { error: `Failed to create user profile: ${errorMessage}` },
                        { status: 500 }
                    );
                }
            }

            // Extract just the preferences-related fields
            const { preferredLanguage, preferredTopics, expertTypes, settings } = userProfile;
            return NextResponse.json({ preferredLanguage, preferredTopics, expertTypes, settings });
        } catch (dbError) {
            const errorMessage = dbError instanceof Error ? dbError.message : 'Unknown database error';
            console.error('Database error fetching user preferences:', errorMessage);

            return NextResponse.json(
                { error: `Database error: ${errorMessage}` },
                { status: 500 }
            );
        }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('Error fetching user preferences:', errorMessage);

        return NextResponse.json(
            { error: `Error fetching user preferences: ${errorMessage}` },
            { status: 500 }
        );
    }
}

/**
 * PUT /api/user/preferences
 * Update a user's preferences
 */
export async function PUT(request: NextRequest) {
    try {
        // Check if user is authenticated
        const session = await getServerSession(authOptions);

        if (!session || !session.user || !session.user.id) {
            console.error('Unauthorized attempt to update user preferences');
            return NextResponse.json(
                { error: 'Unauthorized: Please sign in to update preferences' },
                { status: 401 }
            );
        }

        // Parse request body
        const userId = session.user.id;
        const preferenceData = await request.json();
        console.log(`Updating preferences for user ID: ${userId}`);

        try {
            // Update user profile with new preference data
            const updatedProfile = await updateUserProfile(userId, preferenceData);

            console.log(`Successfully updated preferences for user ID: ${userId}`);
            return NextResponse.json({
                success: true,
                preferences: {
                    preferredLanguage: updatedProfile.preferredLanguage,
                    preferredTopics: updatedProfile.preferredTopics,
                    expertTypes: updatedProfile.expertTypes,
                    settings: updatedProfile.settings
                }
            });
        } catch (dbError) {
            const errorMessage = dbError instanceof Error ? dbError.message : 'Unknown database error';
            console.error('Database error updating user preferences:', errorMessage);

            return NextResponse.json(
                { error: `Database error: ${errorMessage}` },
                { status: 500 }
            );
        }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('Error updating user preferences:', errorMessage);

        return NextResponse.json(
            { error: `Error updating user preferences: ${errorMessage}` },
            { status: 500 }
        );
    }
} 