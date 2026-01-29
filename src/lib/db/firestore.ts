/**
 * Database Access Layer
 * 
 * This module was originally Firestore but has been migrated to Prisma/PostgreSQL.
 * The API is maintained for backwards compatibility with existing code.
 */

import { prisma } from './prisma';
import { v4 as uuid } from 'uuid';

// Collections mapping (kept for backwards compatibility with API)
export const COLLECTIONS = {
    USERS: 'users',
    DEBATES: 'debates',
    MESSAGES: 'messages',
    PROCESSED_MEDIA: 'processed_media',
    USER_CONTENT: 'userContent',
    CONTENT_JOBS: 'contentJobs'
};

// Legacy exports for backwards compatibility
export const USER_CONTENT = 'userContent';
export const CONTENT_JOBS = 'contentJobs';
export const DEBATES = 'debates';
export const MESSAGES = 'messages';

// Export prisma as "firestore" for backwards compatibility with imports
// that directly use firestore.collection() - these will need to be updated
export const firestore = null; // Set to null to catch any direct usage

/**
 * Get a document by ID
 * Maps collection names to Prisma models
 */
export async function getDocument(collectionPath: string, documentId: string): Promise<any | null> {
    if (!collectionPath || !documentId) {
        console.error('getDocument called with invalid parameters:', { collectionPath, documentId });
        throw new Error('Invalid parameters for getDocument');
    }

    console.log(`Getting document from ${collectionPath}/${documentId}`);

    try {
        const collection = collectionPath.split('/')[0];
        
        switch (collection) {
            case COLLECTIONS.USERS:
            case 'users':
                const user = await prisma.user.findUnique({
                    where: { id: documentId }
                });
                return user ? { id: user.id, ...user } : null;
                
            case COLLECTIONS.DEBATES:
            case 'debates':
                const debate = await prisma.debate.findUnique({
                    where: { id: documentId },
                    include: {
                        messages: {
                            orderBy: { sequence: 'asc' }
                        },
                        experts: true
                    }
                });
                if (!debate) return null;
                
                // Transform to match legacy format
                return {
                    id: debate.id,
                    userId: debate.userId,
                    topic: debate.topic,
                    status: debate.status,
                    expertType: debate.expertType.toLowerCase(),
                    context: debate.context,
                    isFavorite: debate.isFavorite,
                    tags: debate.tags,
                    summary: debate.summary,
                    createdAt: debate.createdAt.toISOString(),
                    updatedAt: debate.updatedAt.toISOString(),
                    messages: debate.messages.map(m => ({
                        id: m.id,
                        role: m.role.toLowerCase(),
                        content: m.content,
                        speaker: m.speaker,
                        sequence: m.sequence,
                        usage: m.usage,
                        citations: m.citations,
                        hasProcessedCitations: m.hasProcessedCitations,
                        timestamp: m.createdAt.toISOString()
                    })),
                    experts: debate.experts.map(e => ({
                        id: e.id,
                        name: e.name,
                        background: e.background,
                        stance: e.stance.toLowerCase(),
                        perspective: e.perspective,
                        expertise: e.expertise,
                        type: e.type.toLowerCase(),
                        identifier: e.identifier,
                        voiceId: e.voiceId,
                        sourceReferences: e.sourceReferences
                    }))
                };
                
            default:
                console.warn(`Unknown collection: ${collection}`);
                return null;
        }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error getting document';
        console.error(`Error getting document ${collectionPath}/${documentId}:`, errorMessage);
        throw error;
    }
}

/**
 * Create a document with given data
 */
export async function createDocument(collectionPath: string, data: any, documentId?: string): Promise<any> {
    if (!collectionPath || !data) {
        console.error('createDocument called with invalid parameters:', { collectionPath, data });
        throw new Error('Invalid parameters for createDocument');
    }

    console.log(`Creating document in ${collectionPath}`);

    try {
        const docId = documentId || uuid();
        const collection = collectionPath.split('/')[0];
        
        switch (collection) {
            case COLLECTIONS.USERS:
            case 'users':
                const user = await prisma.user.create({
                    data: {
                        id: docId,
                        email: data.email,
                        name: data.name,
                        image: data.image || data.profilePicture,
                        provider: data.provider,
                        preferences: data.preferences || data.settings,
                        lastLoginAt: data.lastLoginAt ? new Date(data.lastLoginAt) : null
                    }
                });
                return { id: user.id, ...user, createdAt: user.createdAt.toISOString(), updatedAt: user.updatedAt.toISOString() };
                
            case COLLECTIONS.DEBATES:
            case 'debates':
                // Map expertType string to enum
                const expertTypeEnum = data.expertType?.toUpperCase() === 'HISTORICAL' ? 'HISTORICAL' : 'AI';
                
                const debate = await prisma.debate.create({
                    data: {
                        id: docId,
                        userId: data.userId,
                        topic: data.topic,
                        status: 'ACTIVE',
                        expertType: expertTypeEnum as any,
                        context: data.context,
                        isFavorite: data.isFavorite || false,
                        tags: data.tags || [],
                        summary: data.summary
                    }
                });
                
                // Create experts if provided
                if (data.experts && Array.isArray(data.experts)) {
                    await Promise.all(data.experts.map((expert: any, index: number) => 
                        prisma.expert.create({
                            data: {
                                id: expert.id || uuid(),
                                debateId: docId,
                                name: expert.name,
                                background: expert.background || '',
                                stance: (expert.stance?.toUpperCase() || (index === 0 ? 'PRO' : 'CON')) as any,
                                perspective: expert.perspective || '',
                                expertise: expert.expertise || [],
                                type: expertTypeEnum as any,
                                identifier: expert.identifier,
                                voiceId: expert.voiceId,
                                sourceReferences: expert.sourceReferences
                            }
                        })
                    ));
                }
                
                // Create messages if provided
                if (data.messages && Array.isArray(data.messages)) {
                    await Promise.all(data.messages.map((msg: any, index: number) =>
                        prisma.message.create({
                            data: {
                                id: msg.id || uuid(),
                                debateId: docId,
                                role: (msg.role?.toUpperCase() || 'USER') as any,
                                content: msg.content,
                                speaker: msg.speaker,
                                sequence: index,
                                usage: msg.usage,
                                citations: msg.citations,
                                hasProcessedCitations: msg.hasProcessedCitations || false
                            }
                        })
                    ));
                }
                
                return { 
                    id: debate.id, 
                    ...data,
                    createdAt: debate.createdAt.toISOString(), 
                    updatedAt: debate.updatedAt.toISOString() 
                };
                
            default:
                console.warn(`Unknown collection: ${collection}, storing in generic format`);
                return { id: docId, ...data, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
        }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error creating document';
        console.error(`Error creating document in ${collectionPath}:`, errorMessage);
        throw error;
    }
}

/**
 * Update a document with given data
 */
export async function updateDocument(collectionPath: string, documentId: string, data: any): Promise<any> {
    if (!collectionPath || !documentId || !data) {
        console.error('updateDocument called with invalid parameters:', { collectionPath, documentId, data });
        throw new Error('Invalid parameters for updateDocument');
    }

    console.log(`Updating document ${collectionPath}/${documentId}`);

    try {
        const collection = collectionPath.split('/')[0];
        
        switch (collection) {
            case COLLECTIONS.USERS:
            case 'users':
                const user = await prisma.user.update({
                    where: { id: documentId },
                    data: {
                        ...(data.email && { email: data.email }),
                        ...(data.name && { name: data.name }),
                        ...(data.image && { image: data.image }),
                        ...(data.preferences && { preferences: data.preferences }),
                        ...(data.lastLoginAt && { lastLoginAt: new Date(data.lastLoginAt) })
                    }
                });
                return { id: user.id, ...user };
                
            case COLLECTIONS.DEBATES:
            case 'debates':
                // Handle messages update
                if (data.messages && Array.isArray(data.messages)) {
                    // Get current message count for sequence
                    const currentMessages = await prisma.message.count({
                        where: { debateId: documentId }
                    });
                    
                    // Only add new messages (ones not already in DB)
                    const existingIds = await prisma.message.findMany({
                        where: { debateId: documentId },
                        select: { id: true }
                    });
                    const existingIdSet = new Set(existingIds.map(m => m.id));
                    
                    const newMessages = data.messages.filter((m: any) => !existingIdSet.has(m.id));
                    
                    if (newMessages.length > 0) {
                        await Promise.all(newMessages.map((msg: any, index: number) =>
                            prisma.message.create({
                                data: {
                                    id: msg.id || uuid(),
                                    debateId: documentId,
                                    role: (msg.role?.toUpperCase() || 'USER') as any,
                                    content: msg.content,
                                    speaker: msg.speaker,
                                    sequence: currentMessages + index,
                                    usage: msg.usage,
                                    citations: msg.citations,
                                    hasProcessedCitations: msg.hasProcessedCitations || false
                                }
                            })
                        ));
                    }
                }
                
                // Handle experts update
                if (data.experts && Array.isArray(data.experts)) {
                    // Update existing experts
                    await Promise.all(data.experts.map((expert: any) =>
                        prisma.expert.upsert({
                            where: { id: expert.id },
                            update: {
                                name: expert.name,
                                background: expert.background,
                                perspective: expert.perspective,
                                expertise: expert.expertise,
                                sourceReferences: expert.sourceReferences
                            },
                            create: {
                                id: expert.id || uuid(),
                                debateId: documentId,
                                name: expert.name,
                                background: expert.background || '',
                                stance: (expert.stance?.toUpperCase() || 'PRO') as any,
                                perspective: expert.perspective || '',
                                expertise: expert.expertise || [],
                                type: (expert.type?.toUpperCase() || 'HISTORICAL') as any,
                                identifier: expert.identifier,
                                voiceId: expert.voiceId,
                                sourceReferences: expert.sourceReferences
                            }
                        })
                    ));
                }
                
                // Update debate fields
                const updateData: any = {};
                if (data.topic !== undefined) updateData.topic = data.topic;
                if (data.status !== undefined) updateData.status = data.status.toUpperCase();
                if (data.context !== undefined) updateData.context = data.context;
                if (data.isFavorite !== undefined) updateData.isFavorite = data.isFavorite;
                if (data.tags !== undefined) updateData.tags = data.tags;
                if (data.summary !== undefined) updateData.summary = data.summary;
                
                const debate = await prisma.debate.update({
                    where: { id: documentId },
                    data: updateData,
                    include: {
                        messages: { orderBy: { sequence: 'asc' } },
                        experts: true
                    }
                });
                
                return {
                    id: debate.id,
                    userId: debate.userId,
                    topic: debate.topic,
                    status: debate.status,
                    expertType: debate.expertType.toLowerCase(),
                    context: debate.context,
                    isFavorite: debate.isFavorite,
                    tags: debate.tags,
                    summary: debate.summary,
                    createdAt: debate.createdAt.toISOString(),
                    updatedAt: debate.updatedAt.toISOString(),
                    messages: debate.messages.map(m => ({
                        id: m.id,
                        role: m.role.toLowerCase(),
                        content: m.content,
                        speaker: m.speaker,
                        timestamp: m.createdAt.toISOString()
                    })),
                    experts: debate.experts.map(e => ({
                        id: e.id,
                        name: e.name,
                        background: e.background,
                        stance: e.stance.toLowerCase(),
                        perspective: e.perspective,
                        expertise: e.expertise,
                        type: e.type.toLowerCase()
                    }))
                };
                
            default:
                console.warn(`Unknown collection: ${collection}`);
                return { id: documentId, ...data, updatedAt: new Date().toISOString() };
        }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error updating document';
        console.error(`Error updating document ${collectionPath}/${documentId}:`, errorMessage);
        throw error;
    }
}

/**
 * Delete a document
 */
export async function deleteDocument(collectionPath: string, documentId: string): Promise<boolean> {
    if (!collectionPath || !documentId) {
        console.error('deleteDocument called with invalid parameters:', { collectionPath, documentId });
        throw new Error('Invalid parameters for deleteDocument');
    }

    console.log(`Deleting document ${collectionPath}/${documentId}`);

    try {
        const collection = collectionPath.split('/')[0];
        
        switch (collection) {
            case COLLECTIONS.USERS:
            case 'users':
                await prisma.user.delete({
                    where: { id: documentId }
                });
                return true;
                
            case COLLECTIONS.DEBATES:
            case 'debates':
                // Cascade delete handles messages and experts
                await prisma.debate.delete({
                    where: { id: documentId }
                });
                return true;
                
            default:
                console.warn(`Unknown collection: ${collection}`);
                return true;
        }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error deleting document';
        console.error(`Error deleting document ${collectionPath}/${documentId}:`, errorMessage);
        throw error;
    }
}

/**
 * Query documents with filters
 */
export async function queryDocuments(collectionPath: string, filters: Array<{ field: string, op?: string, operator?: string, value: any }>): Promise<any[]> {
    if (!collectionPath) {
        console.error('queryDocuments called with invalid parameters:', { collectionPath, filters });
        throw new Error('Invalid parameters for queryDocuments');
    }

    console.log(`Querying documents in ${collectionPath} with ${filters ? filters.length : 0} filters`);

    try {
        const collection = collectionPath.split('/')[0];
        
        // Build where clause from filters
        const where: any = {};
        if (filters && filters.length > 0) {
            for (const filter of filters) {
                const op = filter.op || filter.operator || '==';
                switch (op) {
                    case '==':
                        where[filter.field] = filter.value;
                        break;
                    case '!=':
                        where[filter.field] = { not: filter.value };
                        break;
                    case '>':
                        where[filter.field] = { gt: filter.value };
                        break;
                    case '>=':
                        where[filter.field] = { gte: filter.value };
                        break;
                    case '<':
                        where[filter.field] = { lt: filter.value };
                        break;
                    case '<=':
                        where[filter.field] = { lte: filter.value };
                        break;
                    case 'in':
                        where[filter.field] = { in: filter.value };
                        break;
                    case 'array-contains':
                        where[filter.field] = { has: filter.value };
                        break;
                    default:
                        where[filter.field] = filter.value;
                }
            }
        }
        
        switch (collection) {
            case COLLECTIONS.USERS:
            case 'users':
                const users = await prisma.user.findMany({ where });
                return users.map(u => ({
                    id: u.id,
                    email: u.email,
                    name: u.name,
                    image: u.image,
                    createdAt: u.createdAt.toISOString(),
                    updatedAt: u.updatedAt.toISOString()
                }));
                
            case COLLECTIONS.DEBATES:
            case 'debates':
                const debates = await prisma.debate.findMany({
                    where,
                    include: {
                        messages: { orderBy: { sequence: 'asc' } },
                        experts: true
                    },
                    orderBy: { createdAt: 'desc' }
                });
                
                return debates.map(debate => ({
                    id: debate.id,
                    userId: debate.userId,
                    topic: debate.topic,
                    status: debate.status,
                    expertType: debate.expertType.toLowerCase(),
                    context: debate.context,
                    isFavorite: debate.isFavorite,
                    tags: debate.tags,
                    summary: debate.summary,
                    createdAt: debate.createdAt.toISOString(),
                    updatedAt: debate.updatedAt.toISOString(),
                    messages: debate.messages.map(m => ({
                        id: m.id,
                        role: m.role.toLowerCase(),
                        content: m.content,
                        speaker: m.speaker,
                        timestamp: m.createdAt.toISOString()
                    })),
                    experts: debate.experts.map(e => ({
                        id: e.id,
                        name: e.name,
                        background: e.background,
                        stance: e.stance.toLowerCase(),
                        perspective: e.perspective,
                        type: e.type.toLowerCase()
                    }))
                }));
                
            default:
                console.warn(`Unknown collection: ${collection}`);
                return [];
        }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error querying documents';
        console.error(`Error querying documents in ${collectionPath}:`, errorMessage);
        throw error;
    }
}
