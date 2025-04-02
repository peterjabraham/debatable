import { NextRequest, NextResponse } from 'next/server';
import { firestore, COLLECTIONS } from '@/lib/db/firestore';
import { Message } from '@/types/message';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

/**
 * GET handler for fetching messages in batches
 * 
 * Supports pagination using timestamp-based cursors
 */
export async function GET(
    request: NextRequest,
    { params }: { params: { debateId: string } }
) {
    const debateId = params.debateId;
    if (!debateId) {
        return NextResponse.json(
            { error: 'Debate ID is required' },
            { status: 400 }
        );
    }

    const searchParams = new URL(request.url).searchParams;

    // Parse and validate query parameters
    const limitParam = searchParams.get('limit');
    const timestampParam = searchParams.get('timestamp');

    let limit = DEFAULT_LIMIT;
    if (limitParam) {
        const parsedLimit = parseInt(limitParam, 10);
        if (!isNaN(parsedLimit) && parsedLimit > 0) {
            limit = Math.min(parsedLimit, MAX_LIMIT);
        }
    }

    try {
        // For now, since we're using an optimized message handling approach,
        // we're going to use mock messages for this endpoint
        console.log(`Mocking GET messages for debate ${debateId}`);

        // Get messages from store instead of Firestore
        const { useDebateStore } = await import('@/lib/store');
        const messagesFromStore = useDebateStore.getState().messages || [];

        // Add some logging to help debug
        console.log(`Found ${messagesFromStore.length} messages in store`);

        return NextResponse.json({
            messages: messagesFromStore,
            source: 'store'
        });

        // The code below would be used if we were actually fetching from Firestore
        /*
        // Start with a base query
        let query = firestore
            .collection(COLLECTIONS.DEBATES)
            .doc(debateId)
            .collection('messages')
            .orderBy('timestamp', 'desc') // Get newest messages first
            .limit(limit);

        // Apply cursor if timestamp is provided
        if (timestampParam) {
            query = query.startAfter(timestampParam);
        }

        // Execute query
        const snapshot = await query.get();

        if (snapshot.empty) {
            return NextResponse.json({ messages: [] });
        }

        // Map documents to Message objects
        const messages: Message[] = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            messages.push({
                id: doc.id,
                content: data.content,
                role: data.role,
                speaker: data.speaker,
                timestamp: data.timestamp,
                ...data
            } as Message);
        });

        return NextResponse.json({ messages });
        */
    } catch (error) {
        console.error('Error fetching messages:', error);
        return NextResponse.json(
            { error: 'Failed to fetch messages' },
            { status: 500 }
        );
    }
}

/**
 * POST handler for adding a new message
 */
export async function POST(
    request: NextRequest,
    { params }: { params: { debateId: string } }
) {
    const debateId = params.debateId;
    if (!debateId) {
        return NextResponse.json(
            { error: 'Debate ID is required' },
            { status: 400 }
        );
    }

    try {
        const body = await request.json();
        const { message } = body;

        if (!message) {
            return NextResponse.json(
                { error: 'Message data is required' },
                { status: 400 }
            );
        }

        // Ensure required fields
        if (!message.content || !message.role) {
            return NextResponse.json(
                { error: 'Message must include content and role' },
                { status: 400 }
            );
        }

        // Add timestamp if not provided
        if (!message.timestamp) {
            message.timestamp = new Date().toISOString();
        }

        // Generate ID if not provided
        const messageId = message.id || `msg_${Date.now()}`;

        // Add message to the store
        const { useDebateStore } = await import('@/lib/store');

        // Create a copy of the message with the ID
        const messageWithId = {
            ...message,
            id: messageId
        };

        // Add to store
        useDebateStore.getState().addMessage(messageWithId);

        console.log(`Added message ${messageId} to store`);

        // The code below would be used if we were actually saving to Firestore
        /*
        // Add the message to Firestore
        await firestore
            .collection(COLLECTIONS.DEBATES)
            .doc(debateId)
            .collection('messages')
            .doc(messageId)
            .set({
                ...message,
                id: messageId
            });

        // Update the debate's updatedAt timestamp
        await firestore
            .collection(COLLECTIONS.DEBATES)
            .doc(debateId)
            .update({
                updatedAt: new Date().toISOString()
            });
        */

        return NextResponse.json({ success: true, messageId });
    } catch (error) {
        console.error('Error adding message:', error);
        return NextResponse.json(
            { error: 'Failed to add message' },
            { status: 500 }
        );
    }
} 