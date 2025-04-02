import { NextRequest, NextResponse } from 'next/server';
import { deleteUser, getUserById } from '@/lib/db/models/user';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

/**
 * DELETE /api/user/account/delete
 * Delete a user's account and all associated data
 */
export async function DELETE(request: NextRequest) {
    try {
        // Check if user is authenticated
        const session = await getServerSession(authOptions);

        if (!session || !session.user || !session.user.id) {
            return NextResponse.json(
                { error: 'Unauthorized: Please sign in to access this resource' },
                { status: 401 }
            );
        }

        const userId = session.user.id;

        // Check if user exists
        const userProfile = await getUserById(userId);
        if (!userProfile) {
            return NextResponse.json(
                { error: 'User profile not found' },
                { status: 404 }
            );
        }

        // Delete user account
        await deleteUser(userId);

        return NextResponse.json({
            success: true,
            message: 'Your account has been successfully deleted.'
        });
    } catch (error) {
        console.error('Error deleting user account:', error);
        return NextResponse.json(
            {
                error: 'Internal server error',
                details: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        );
    }
} 