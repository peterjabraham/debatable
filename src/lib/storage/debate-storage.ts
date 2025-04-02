import { firestore } from '../db/firestore';
import { DebateMetadata, FastAccessData, StorageOperationResult } from '@/types/storage';
import { getRedisClient, RedisClient } from './redis-client';

export class DebateStorage {
    private static instance: DebateStorage;
    private redis: RedisClient;

    private constructor() {
        this.redis = getRedisClient();
    }

    public static getInstance(): DebateStorage {
        if (!DebateStorage.instance) {
            DebateStorage.instance = new DebateStorage();
        }
        return DebateStorage.instance;
    }

    // Initialize a new debate
    public async initializeDebate(
        debateId: string,
        topic: string,
        experts: any[],
        userId: string
    ): Promise<StorageOperationResult> {
        try {
            // Store in Redis
            const debateData: FastAccessData = {
                topic,
                experts,
                messages: [],
                lastUpdated: new Date().toISOString()
            };

            await this.redis.set(
                `debate:${debateId}`,
                JSON.stringify(debateData),
                { ex: 60 * 60 * 24 } // 24 hours expiry
            );

            // Store in Firestore
            await firestore?.collection('debates').doc(debateId).set({
                id: debateId,
                topic,
                expertType: experts[0]?.type || 'unknown',
                userId,
                status: 'active',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });

            // Store experts in Firestore
            if (firestore) {
                const expertsCollection = firestore.collection('debates').doc(debateId).collection('experts');
                await Promise.all(experts.map(expert =>
                    expertsCollection.doc(expert.id).set({
                        ...expert,
                        addedAt: new Date().toISOString()
                    })
                ));
            }

            return { success: true };
        } catch (error) {
            console.error('Error initializing debate:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error initializing debate'
            };
        }
    }

    // Add a message to the debate
    public async addMessage(debateId: string, message: any): Promise<StorageOperationResult> {
        try {
            // Update Redis
            const debateDataStr = await this.redis.get(`debate:${debateId}`);
            if (debateDataStr) {
                const debateData: FastAccessData = JSON.parse(debateDataStr);
                debateData.messages.push(message);
                debateData.lastUpdated = new Date().toISOString();

                await this.redis.set(
                    `debate:${debateId}`,
                    JSON.stringify(debateData),
                    { ex: 60 * 60 * 24 } // 24 hours expiry
                );
            }

            // Store in Firestore
            if (firestore) {
                await firestore.collection('debates').doc(debateId)
                    .collection('messages').doc(message.id).set({
                        ...message,
                        timestamp: new Date().toISOString()
                    });

                await firestore.collection('debates').doc(debateId).update({
                    updatedAt: new Date().toISOString()
                });
            }

            return { success: true };
        } catch (error) {
            console.error('Error adding message:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error adding message'
            };
        }
    }

    // Get debate data (first from Redis, then Firestore)
    public async getDebate(debateId: string): Promise<FastAccessData | null> {
        try {
            // Try Redis first
            const debateDataStr = await this.redis.get(`debate:${debateId}`);
            if (debateDataStr) {
                return JSON.parse(debateDataStr);
            }

            // If not in Redis, try Firestore
            if (firestore) {
                const debateDoc = await firestore.collection('debates').doc(debateId).get();
                if (debateDoc.exists) {
                    const [messagesSnapshot, expertsSnapshot] = await Promise.all([
                        firestore.collection('debates').doc(debateId)
                            .collection('messages')
                            .orderBy('timestamp')
                            .get(),
                        firestore.collection('debates').doc(debateId)
                            .collection('experts')
                            .get()
                    ]);

                    const messages = messagesSnapshot.docs.map(doc => doc.data());
                    const experts = expertsSnapshot.docs.map(doc => doc.data());
                    const debateData = debateDoc.data();

                    const result: FastAccessData = {
                        topic: debateData?.topic || '',
                        experts,
                        messages,
                        lastUpdated: debateData?.updatedAt || new Date().toISOString()
                    };

                    // Cache in Redis for future access
                    await this.redis.set(
                        `debate:${debateId}`,
                        JSON.stringify(result),
                        { ex: 60 * 60 * 24 } // 24 hours expiry
                    );

                    return result;
                }
            }

            return null;
        } catch (error) {
            console.error('Error getting debate data:', error);
            return null;
        }
    }

    // Get debate metadata from Firestore
    public async getDebateMetadata(debateId: string): Promise<DebateMetadata | null> {
        try {
            if (typeof window === 'undefined' && firestore) {
                const debateDoc = await firestore.collection('debates').doc(debateId).get();

                if (debateDoc.exists) {
                    return debateDoc.data() as DebateMetadata;
                }
            }
            return null;
        } catch (error) {
            console.error('Error getting debate metadata:', error);
            return null;
        }
    }
} 