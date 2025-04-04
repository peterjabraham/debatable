import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getDocument, updateDocument, COLLECTIONS } from '@/lib/db/firestore';

// Add new message to a debate
export async function POST(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        // Get the current session
        const session = await getServerSession(authOptions);

        // Ensure user is authenticated
        if (!session || !session.user || !session.user.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id } = params;
        if (!id) {
            return NextResponse.json({ error: 'Debate ID is required' }, { status: 400 });
        }

        // Get the message data from the request body
        const data = await request.json();

        // Validate the data
        if (!data || !data.content) {
            return NextResponse.json({ error: 'Message content is required' }, { status: 400 });
        }

        // Check if the debate exists and if the user has permission
        const existingDebate = await getDocument(COLLECTIONS.DEBATES, id);

        if (!existingDebate) {
            return NextResponse.json({ error: 'Debate not found' }, { status: 404 });
        }

        if (existingDebate.userId !== session.user.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Generate a message ID
        const messageId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

        // Prepare the message data
        const messageData = {
            id: messageId,
            content: data.content,
            role: data.role || 'user',
            speaker: data.speaker || session.user.name || 'User',
            timestamp: new Date().toISOString(),
            userId: session.user.id
        };

        // Store the message in Firestore
        const messagesPath = `${COLLECTIONS.DEBATES}/${id}/messages`;
        await updateDocument(messagesPath, messageId, messageData);

        // Update the debate's lastUpdated timestamp
        await updateDocument(COLLECTIONS.DEBATES, id, {
            updatedAt: new Date().toISOString()
        });

        return NextResponse.json({
            success: true,
            message: messageData
        });
    } catch (error) {
        console.error(`Error adding message to debate ${params.id}:`, error);
        const message = error instanceof Error ? error.message : 'Unknown error occurred';
        return NextResponse.json({ error: message }, { status: 500 });
    }
} 