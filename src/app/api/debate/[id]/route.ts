import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getDocument, updateDocument, deleteDocument, COLLECTIONS } from '@/lib/db/firestore';

// Get a specific debate
export async function GET(
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

        // Fetch the debate
        const debate = await getDocument(COLLECTIONS.DEBATES, id);

        if (!debate) {
            return NextResponse.json({ error: 'Debate not found' }, { status: 404 });
        }

        // Check if the user has permission to access this debate
        if (debate.userId !== session.user.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Get the messages for this debate
        const messagesRef = await getDocument(`${COLLECTIONS.DEBATES}/${id}/messages`, '*');
        const messages = messagesRef || [];

        // Return the debate with messages
        return NextResponse.json({
            debate: {
                ...debate,
                messages
            }
        });
    } catch (error) {
        console.error(`Error fetching debate ${params.id}:`, error);
        const message = error instanceof Error ? error.message : 'Unknown error occurred';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

// Update a debate
export async function PATCH(
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

        // Get the update data from the request body
        const data = await request.json();

        // Validate the data
        if (!data || Object.keys(data).length === 0) {
            return NextResponse.json({ error: 'No update data provided' }, { status: 400 });
        }

        // Check if the debate exists and if the user has permission to update it
        const existingDebate = await getDocument(COLLECTIONS.DEBATES, id);

        if (!existingDebate) {
            return NextResponse.json({ error: 'Debate not found' }, { status: 404 });
        }

        if (existingDebate.userId !== session.user.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Update the debate
        const updatedDebate = await updateDocument(COLLECTIONS.DEBATES, id, {
            ...data,
            updatedAt: new Date().toISOString()
        });

        return NextResponse.json({ debate: updatedDebate });
    } catch (error) {
        console.error(`Error updating debate ${params.id}:`, error);
        const message = error instanceof Error ? error.message : 'Unknown error occurred';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

// Delete a debate
export async function DELETE(
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

        // Check if the debate exists and if the user has permission to delete it
        const existingDebate = await getDocument(COLLECTIONS.DEBATES, id);

        if (!existingDebate) {
            return NextResponse.json({ error: 'Debate not found' }, { status: 404 });
        }

        if (existingDebate.userId !== session.user.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Delete the debate
        await deleteDocument(COLLECTIONS.DEBATES, id);

        return NextResponse.json({ success: true, message: 'Debate deleted successfully' });
    } catch (error) {
        console.error(`Error deleting debate ${params.id}:`, error);
        const message = error instanceof Error ? error.message : 'Unknown error occurred';
        return NextResponse.json({ error: message }, { status: 500 });
    }
} 