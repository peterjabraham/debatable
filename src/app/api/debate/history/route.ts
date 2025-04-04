import { NextRequest, NextResponse } from 'next/server';
import { getDebatesByUserId } from '@/lib/db/models/debate';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET(request: NextRequest) {
    try {
        // Get the current session
        const session = await getServerSession(authOptions);

        // Get the userId from query params
        const url = new URL(request.url);
        const requestedUserId = url.searchParams.get('userId');

        // Safety check: Ensure the requested userId matches the authenticated user's ID
        if (!session || !session.user || !session.user.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Only allow users to access their own debates
        const userId = session.user.id;

        if (requestedUserId && requestedUserId !== userId) {
            console.warn(`User ${userId} attempted to access debates for user ${requestedUserId}`);
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Fetch debates from Firestore
        console.log(`Fetching debates for user ${userId}`);
        const debates = await getDebatesByUserId(userId);

        // Sort debates by createdAt date (newest first)
        const sortedDebates = debates.sort((a, b) => {
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });

        return NextResponse.json({
            debates: sortedDebates,
            count: sortedDebates.length
        });
    } catch (error) {
        console.error('Error fetching debate history:', error);
        const message = error instanceof Error ? error.message : 'Unknown error occurred';
        return NextResponse.json({ error: message }, { status: 500 });
    }
} 