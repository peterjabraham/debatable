import { v4 as uuidv4 } from 'uuid';
import { Expert } from '@/types/expert';
import { Message, DebateContext, ExpertContext } from '@/types/message';
import { firestore, COLLECTIONS, createDocument, getDocument, updateDocument, deleteDocument, queryDocuments } from '../firestore';

export interface SavedDebate {
    id: string;
    userId: string;
    topic: string;
    experts: Expert[];
    messages: Message[];
    expertType: 'historical' | 'domain';
    createdAt: string;
    updatedAt: string;
    status?: string;
    isFavorite?: boolean;
    tags?: string[];
    summary?: string;
    context?: DebateContext;
}

export interface CreateDebateParams {
    id?: string;
    userId: string;
    topic: string;
    experts: Expert[];
    messages?: Message[];
    expertType?: 'historical' | 'domain';
    status?: string;
    createdAt?: string;
    updatedAt?: string;
    tags?: string[];
    summary?: string;
}

/**
 * Create a new debate with retry logic and exponential backoff
 */
export async function createDebate(debateData: Partial<SavedDebate>): Promise<SavedDebate> {
    console.log('Creating debate with data:', debateData);

    // Ensure we have valid data
    const safeDebateData = debateData || {};

    // Ensure required fields
    if (!safeDebateData.topic) {
        throw new Error('Debate topic is required');
    }

    if (!safeDebateData.userId) {
        throw new Error('User ID is required');
    }

    // Set default values for optional fields
    if (!safeDebateData.messages) {
        safeDebateData.messages = [];
    }

    const debate = await createDocument(COLLECTIONS.DEBATES, safeDebateData);
    console.log('Debate created successfully:', debate.id);

    // Wait for the document to be available with exponential backoff
    let retries = 0;
    const maxRetries = 8; // Increased from 5 to 8
    let createdDebate = null;
    let waitTime = 2000; // Start with 2 seconds (increased from 1)

    while (retries < maxRetries) {
        try {
            // Add exponential backoff delay before checking
            await new Promise(resolve => setTimeout(resolve, waitTime));
            console.log(`Attempt ${retries + 1}: Checking for debate document (waiting ${waitTime}ms)...`);

            createdDebate = await getDebateById(debate.id);
            if (createdDebate) {
                console.log('Debate document found on attempt:', retries + 1);
                break;
            }
        } catch (error) {
            console.log(`Retry ${retries + 1} failed, next wait time will be ${waitTime * 2}ms...`);
        }
        retries++;
        waitTime *= 2; // Double the wait time for next attempt
    }

    if (!createdDebate) {
        throw new Error(`Database operation timeout: Failed to verify debate creation after ${maxRetries} attempts (total wait time: ${calculateTotalWaitTime(maxRetries, 2000)}ms). Please try again.`);
    }

    return createdDebate;
}

/**
 * Get a debate by ID with retry logic and exponential backoff
 */
export async function getDebateById(debateId: string): Promise<SavedDebate | null> {
    console.log('Getting debate by ID:', debateId);

    if (!debateId) {
        console.error('getDebateById called with invalid debateId');
        throw new Error('Invalid debate ID provided');
    }

    let retries = 0;
    const maxRetries = 8; // Increased from 5 to 8
    let debate = null;
    let waitTime = 2000; // Start with 2 seconds (increased from 1)

    while (retries < maxRetries) {
        try {
            debate = await getDocument(COLLECTIONS.DEBATES, debateId);
            if (debate) break;

            // Add exponential backoff delay before retrying
            await new Promise(resolve => setTimeout(resolve, waitTime));
            console.log(`Retry ${retries + 1} failed, waiting ${waitTime}ms before next attempt...`);
        } catch (error) {
            console.log(`Error on attempt ${retries + 1}, next wait time will be ${waitTime * 2}ms...`);
        }
        retries++;
        waitTime *= 2; // Double the wait time for next attempt
    }

    return debate as SavedDebate | null;
}

// Helper function to calculate total potential wait time
function calculateTotalWaitTime(maxRetries: number, initialWait: number): number {
    let total = 0;
    let current = initialWait;
    for (let i = 0; i < maxRetries; i++) {
        total += current;
        current *= 2;
    }
    return total;
}

/**
 * Update a debate
 */
export async function updateDebate(id: string, updates: Partial<SavedDebate>): Promise<SavedDebate> {
    try {
        if (!id) {
            throw new Error('No debate ID provided for update');
        }

        // Add last updated timestamp
        const updatedValues = {
            ...updates,
            updatedAt: new Date().toISOString()
        };

        const updatedDebate = await updateDocument(COLLECTIONS.DEBATES, id, updatedValues);
        return updatedDebate as SavedDebate;
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error updating debate';
        console.error('Error updating debate:', errorMessage);
        throw error;
    }
}

/**
 * Delete a debate
 */
export async function deleteDebate(id: string): Promise<boolean> {
    try {
        if (!id) {
            throw new Error('No debate ID provided for deletion');
        }

        await deleteDocument(COLLECTIONS.DEBATES, id);
        return true;
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error deleting debate';
        console.error('Error deleting debate:', errorMessage);
        throw error;
    }
}

/**
 * Get debates by user ID
 */
export async function getDebatesByUserId(userId: string): Promise<SavedDebate[]> {
    console.log('Getting debates by user ID:', userId);

    if (!userId) {
        console.error('getDebatesByUserId called with invalid userId');
        throw new Error('Invalid user ID provided');
    }

    const debates = await queryDocuments(COLLECTIONS.DEBATES, [
        {
            field: 'userId',
            operator: '==',
            value: userId
        }
    ]);

    return debates as SavedDebate[];
}

/**
 * Add a message to a debate
 */
export async function addMessageToDebate(debateId: string, message: Message): Promise<SavedDebate | null> {
    console.log('Adding message to debate ID:', debateId);

    if (!debateId || !message) {
        console.error('addMessageToDebate called with invalid parameters');
        throw new Error('Invalid parameters for adding message to debate');
    }

    // Get the current debate
    const debate = await getDebateById(debateId);

    if (!debate) {
        throw new Error(`Debate with ID ${debateId} not found`);
    }

    // Add the message to the debate
    const messages = [...(debate.messages || []), message];

    // Update the debate with the new message
    const updatedDebate = await updateDocument(
        COLLECTIONS.DEBATES,
        debateId,
        {
            messages,
            updatedAt: new Date().toISOString()
        }
    );

    return updatedDebate as SavedDebate;
}

/**
 * Set a debate as a favorite
 */
export async function setDebateFavorite(
    debateId: string,
    isFavorite: boolean
): Promise<SavedDebate> {
    try {
        return await updateDebate(debateId, { isFavorite });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error setting favorite status';
        console.error('Error setting debate favorite status:', errorMessage);
        throw error;
    }
}

/**
 * Update debate context
 */
export async function updateDebateContext(debateId: string, context: Partial<DebateContext>): Promise<SavedDebate | null> {
    console.log('Updating debate context for ID:', debateId);

    if (!debateId) {
        console.error('updateDebateContext called with invalid debateId');
        throw new Error('Invalid debate ID provided');
    }

    const safeContext = context || {};

    // Get the current debate
    const debate = await getDebateById(debateId);

    if (!debate) {
        throw new Error(`Debate with ID ${debateId} not found`);
    }

    // Update the context
    const updatedContext = {
        ...(debate.context || {}),
        ...safeContext
    };

    // Update the debate with the new context
    const updatedDebate = await updateDocument(
        COLLECTIONS.DEBATES,
        debateId,
        {
            context: updatedContext,
            updatedAt: new Date().toISOString()
        }
    );

    return updatedDebate as SavedDebate;
}

/**
 * Extract context for an expert to use in generating responses
 */
export function extractExpertResponseContext(
    debate: SavedDebate,
    expertName: string,
    opponentName?: string
): {
    systemPrompt: string;
    messages: Message[];
    keyContextPoints: string[];
} {
    const context = debate.context || {
        expertContexts: {},
        mainPoints: [],
        userQuestions: []
    };

    // Get the expert's context
    const expertContext = context.expertContexts[expertName] || {
        keyPoints: [],
        recentArguments: []
    };

    // Get opponent context if available
    const opponentContext = opponentName ? context.expertContexts[opponentName] : null;

    // Get recent relevant messages (last 6 messages or fewer)
    const recentMessages = debate.messages.slice(-6);

    // Build expert system prompt with context
    const keyPoints = expertContext.keyPoints.slice(-5);
    const opponentPoints = opponentContext?.keyPoints.slice(-3) || [];

    // Create the system prompt
    const systemPrompt = `
As ${expertName} discussing ${debate.topic}, remember these points from your previous arguments:
${keyPoints.map(point => `- ${point}`).join('\n')}

${opponentPoints.length > 0 ? `Your opponent (${opponentName}) has made these key points:
${opponentPoints.map(point => `- ${point}`).join('\n')}
` : ''}

Stay consistent with your established position and respond directly to the most recent points.
`;

    return {
        systemPrompt,
        messages: recentMessages,
        keyContextPoints: [...keyPoints, ...opponentPoints]
    };
}

/**
 * Get mock debates for a user (for development)
 */
export function getMockDebates(userId: string): SavedDebate[] {
    const now = new Date().toISOString();

    return [
        {
            id: uuidv4(),
            userId,
            topic: 'The Future of AI Ethics',
            experts: [
                { id: '1', name: 'Tech Optimist', avatar: 'https://i.pravatar.cc/150?u=1' },
                { id: '2', name: 'Ethics Professor', avatar: 'https://i.pravatar.cc/150?u=2' }
            ],
            messages: [
                { id: '1', sender: 'user', content: 'What are the ethical implications of AI?', timestamp: now }
            ],
            expertType: 'domain',
            createdAt: now,
            updatedAt: now,
            isFavorite: true,
            tags: ['AI', 'Ethics', 'Technology']
        },
        {
            id: uuidv4(),
            userId,
            topic: 'Climate Change Solutions',
            experts: [
                { id: '3', name: 'Environmental Scientist', avatar: 'https://i.pravatar.cc/150?u=3' },
                { id: '4', name: 'Policy Expert', avatar: 'https://i.pravatar.cc/150?u=4' }
            ],
            messages: [
                { id: '1', sender: 'user', content: 'What are effective approaches to addressing climate change?', timestamp: now }
            ],
            expertType: 'domain',
            createdAt: now,
            updatedAt: now,
            isFavorite: false,
            tags: ['Climate', 'Environment', 'Policy']
        }
    ];
}

/**
 * Get an expert by ID from a debate and optionally update it
 */
export async function getExpertById(expertId: string, updates?: Partial<Expert>): Promise<Expert | null> {
    try {
        console.log('Getting/updating expert by ID:', expertId);

        if (!expertId) {
            throw new Error('No expert ID provided');
        }

        // First, we need to find which debate contains this expert
        const debates = await queryDocuments(COLLECTIONS.DEBATES, [
            {
                field: "experts",
                op: "array-contains",
                value: { id: expertId }
            }
        ]);

        if (!debates || debates.length === 0) {
            console.log(`No debate found containing expert ${expertId}`);
            return null;
        }

        const debate = debates[0] as SavedDebate;
        const expertIndex = debate.experts.findIndex(e => e.id === expertId);

        if (expertIndex === -1) {
            console.log(`Expert ${expertId} not found in debate ${debate.id}`);
            return null;
        }

        // If no updates, just return the expert
        if (!updates) {
            return debate.experts[expertIndex];
        }

        // Apply updates to the expert
        const updatedExperts = [...debate.experts];
        updatedExperts[expertIndex] = {
            ...updatedExperts[expertIndex],
            ...updates
        };

        // Update the debate with the modified experts array
        await updateDocument(COLLECTIONS.DEBATES, debate.id, {
            experts: updatedExperts,
            updatedAt: new Date().toISOString()
        });

        console.log(`Updated expert ${expertId} in debate ${debate.id}`);
        return updatedExperts[expertIndex];
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error getting/updating expert';
        console.error('Error in getExpertById:', errorMessage);
        throw error;
    }
} 