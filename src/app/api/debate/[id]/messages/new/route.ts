import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db/prisma';

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
        const existingDebate = await prisma.debate.findUnique({
            where: { id },
            select: { userId: true }
        });

        if (!existingDebate) {
            return NextResponse.json({ error: 'Debate not found' }, { status: 404 });
        }

        if (existingDebate.userId !== session.user.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Get current message count for sequence
        const messageCount = await prisma.message.count({
            where: { debateId: id }
        });

        // Generate a message ID
        const messageId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

        // Create the message in the database
        const message = await prisma.message.create({
            data: {
                id: messageId,
                debateId: id,
                content: data.content,
                role: (data.role?.toUpperCase() || 'USER') as any,
                speaker: data.speaker || session.user.name || 'User',
                sequence: messageCount
            }
        });

        // Update the debate's timestamp
        await prisma.debate.update({
            where: { id },
            data: { updatedAt: new Date() }
        });

        return NextResponse.json({
            success: true,
            message: {
                id: message.id,
                content: message.content,
                role: message.role.toLowerCase(),
                speaker: message.speaker,
                timestamp: message.createdAt.toISOString(),
                userId: session.user.id
            }
        });
    } catch (error) {
        console.error(`Error adding message to debate ${params.id}:`, error);
        const message = error instanceof Error ? error.message : 'Unknown error occurred';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
