import { NextRequest, NextResponse } from 'next/server';
import { firestore, COLLECTIONS } from '@/lib/db/firestore';
import { Message } from '@/types/message';

/**
 * GET handler for fetching only new messages since a specific message ID
 * 
 * This optimizes polling by only fetching messages that have appeared since
 * the last known message, reducing Firebase reads
 */
export async function GET(
    request: NextRequest,
    { params }: { params: { debateId: string } }
) {
    // Fix: Properly access params without destructuring
    const debateId = params.debateId;
    if (!debateId) {
        return NextResponse.json(
            { error: 'Debate ID is required' },
            { status: 400 }
        );
    }

    const searchParams = new URL(request.url).searchParams;
    // Get the 'since' parameter - could be a message ID or timestamp
    const sinceParam = searchParams.get('since');

    try {
        // For now, since we're using an optimized message handling approach,
        // we're going to use mock messages for this endpoint
        console.log(`Mocking GET new messages for debate ${debateId} since ${sinceParam || 'none'}`);

        // Get messages from store instead of Firestore
        const { useDebateStore } = await import('@/lib/store');
        const allMessages = useDebateStore.getState().messages || [];

        let newMessages: Message[] = [];

        if (!sinceParam) {
            // If no 'since' parameter, return the most recent messages (10)
            newMessages = allMessages.slice(-10);
        } else {
            // Find messages newer than the given message ID
            const lastMessageIndex = allMessages.findIndex(msg => msg.id === sinceParam);

            if (lastMessageIndex !== -1) {
                // Get all messages after the found message
                newMessages = allMessages.slice(lastMessageIndex + 1);
            } else {
                // If message not found, get the last 5 messages to ensure client has something
                newMessages = allMessages.slice(-5);
            }
        }

        // Add logging to debug
        console.log(`Returning ${newMessages.length} new messages`);

        return NextResponse.json({
            messages: newMessages,
            source: 'store'
        });

        // The code below would be used if we were actually fetching from Firestore
        /*
        if (!sinceParam) {
            // If no 'since' parameter, return the most recent messages
            const snapshot = await firestore
                .collection(COLLECTIONS.DEBATES)
                .doc(debateId)
                .collection('messages')
                .orderBy('timestamp', 'desc')
                .limit(10)
                .get();

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
        }

        // First check if sinceParam is a timestamp
        let timestampQuery;
        let mostRecentMessageReference;

        if (sinceParam.match(/^\d{4}-\d{2}-\d{2}T/)) {
            // It's an ISO timestamp
            timestampQuery = sinceParam;
        } else {
            // It's a message ID, get its timestamp
            try {
                mostRecentMessageReference = await firestore
                    .collection(COLLECTIONS.DEBATES)
                    .doc(debateId)
                    .collection('messages')
                    .doc(sinceParam)
                    .get();

                if (mostRecentMessageReference.exists) {
                    const data = mostRecentMessageReference.data();
                    timestampQuery = data?.timestamp;
                }
            } catch (error) {
                console.error('Error getting message reference:', error);
                // Continue with no timestamp filter
            }
        }

        // Query for messages newer than the timestamp
        let query = firestore
            .collection(COLLECTIONS.DEBATES)
            .doc(debateId)
            .collection('messages')
            .orderBy('timestamp', 'desc')
            .limit(20);

        if (timestampQuery) {
            query = query.where('timestamp', '>', timestampQuery);
        }

        const snapshot = await query.get();

        if (snapshot.empty) {
            return NextResponse.json({ messages: [] });
        }

        // Map documents to Message objects
        const messages: Message[] = [];
        snapshot.forEach(doc => {
            // Skip the reference message if it's included
            if (mostRecentMessageReference && doc.id === mostRecentMessageReference.id) {
                return;
            }

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
        console.error('Error fetching new messages:', error);
        return NextResponse.json(
            { error: 'Failed to fetch new messages' },
            { status: 500 }
        );
    }
} 