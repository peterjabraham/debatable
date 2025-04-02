import { NextRequest, NextResponse } from 'next/server';
import { getUserById, updateUserProfile, createUser } from '@/lib/db/models/user';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

/**
 * PUT /api/user/profile/update
 * Update a user's profile
 */
export async function PUT(request: NextRequest) {
    try {
        // Check if user is authenticated
        const session = await getServerSession(authOptions);

        if (!session || !session.user || !session.user.id) {
            console.error('Unauthorized attempt to update user profile');
            return NextResponse.json(
                { error: 'Unauthorized: Please sign in to update your profile' },
                { status: 401 }
            );
        }

        // Parse the request body
        const userId = session.user.id;
        const profileData = await request.json();

        console.log(`Updating profile for user ID: ${userId}`);

        try {
            // First check if user exists
            let existingUser = await getUserById(userId);

            if (!existingUser) {
                console.log(`User profile not found for ID: ${userId}, creating new profile`);

                // Use session data to create a basic profile with the updates applied
                const userData = {
                    id: userId,
                    email: session.user.email || `${userId}@example.com`,
                    name: session.user.name || 'New User',
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    lastLoginAt: new Date().toISOString(),
                    profilePicture: session.user.image || null,
                    ...profileData // Include the update data in the initial profile
                };

                try {
                    existingUser = await createUser(userData);
                    console.log(`Successfully created new profile for user ID: ${userId}`);

                    return NextResponse.json({
                        success: true,
                        profile: existingUser,
                        created: true
                    });
                } catch (createError) {
                    const errorMessage = createError instanceof Error ? createError.message : 'Unknown error';
                    console.error('Error creating new user profile:', errorMessage);

                    return NextResponse.json(
                        { error: `Failed to create user profile: ${errorMessage}` },
                        { status: 500 }
                    );
                }
            }

            // Update the user's profile in the database
            const updatedProfile = await updateUserProfile(userId, profileData);

            console.log(`Successfully updated profile for user ID: ${userId}`);
            return NextResponse.json({
                success: true,
                profile: updatedProfile
            });
        } catch (dbError) {
            const errorMessage = dbError instanceof Error ? dbError.message : 'Unknown database error';
            console.error('Database error updating user profile:', errorMessage);

            // Don't create mock data, propagate the error
            return NextResponse.json(
                { error: errorMessage },
                { status: 500 }
            );
        }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('Error updating user profile:', errorMessage);

        return NextResponse.json(
            { error: errorMessage },
            { status: 500 }
        );
    }
} 