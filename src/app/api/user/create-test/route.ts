import { NextRequest, NextResponse } from 'next/server';
import { createUser, getUserByEmail } from '@/lib/db/models/user';

/**
 * POST /api/user/create-test
 * Creates a test user profile for debugging purposes
 */
export async function POST(request: NextRequest) {
    try {
        // Get user info from request body
        const { email, name } = await request.json();

        if (!email) {
            return NextResponse.json(
                { error: 'Email is required' },
                { status: 400 }
            );
        }

        // Check if user already exists
        const existingUser = await getUserByEmail(email);

        if (existingUser) {
            return NextResponse.json({
                message: 'User already exists',
                user: existingUser,
                created: false
            });
        }

        // Create a new user
        const userId = `user_${Date.now()}`;
        const userData = {
            id: userId,
            email: email,
            name: name || 'Test User',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            lastLoginAt: new Date().toISOString(),
            profilePicture: null,
            preferredLanguage: 'en',
            preferredTopics: [],
            expertTypes: ['domain', 'historical'],
            settings: {
                notifications: true,
                theme: 'system'
            }
        };

        const newUser = await createUser(userData);
        console.log('Test user created successfully:', newUser);

        return NextResponse.json({
            message: 'Test user created successfully',
            user: newUser,
            created: true
        });
    } catch (error) {
        console.error('Error creating test user:', error);
        return NextResponse.json(
            { error: 'Failed to create test user', details: error instanceof Error ? error.message : String(error) },
            { status: 500 }
        );
    }
} 