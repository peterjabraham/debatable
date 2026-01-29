import { prisma } from '../db/prisma';
import { DebateMetadata, FastAccessData, StorageOperationResult } from '@/types/storage';
import { getRedisClient, RedisClient } from './redis-client';
import { v4 as uuid } from 'uuid';

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
            // Store in Redis for fast access
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

            // Determine expert type
            const expertType = experts[0]?.type?.toUpperCase() === 'AI' ? 'AI' : 'HISTORICAL';

            // Store in PostgreSQL via Prisma
            await prisma.debate.create({
                data: {
                    id: debateId,
                    topic,
                    expertType: expertType as any,
                    userId,
                    status: 'ACTIVE'
                }
            });

            // Store experts in PostgreSQL
            if (experts.length > 0) {
                await Promise.all(experts.map((expert, index) =>
                    prisma.expert.create({
                        data: {
                            id: expert.id || uuid(),
                            debateId,
                            name: expert.name,
                            background: expert.background || '',
                            stance: index === 0 ? 'PRO' : 'CON',
                            perspective: expert.perspective || '',
                            expertise: expert.expertise || [],
                            type: expertType as any,
                            identifier: expert.identifier,
                            voiceId: expert.voiceId
                        }
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

            // Get current message count for sequence
            const messageCount = await prisma.message.count({
                where: { debateId }
            });

            // Store in PostgreSQL
            await prisma.message.create({
                data: {
                    id: message.id || uuid(),
                    debateId,
                    role: (message.role?.toUpperCase() || 'USER') as any,
                    content: message.content,
                    speaker: message.speaker,
                    sequence: messageCount,
                    usage: message.usage,
                    citations: message.citations,
                    hasProcessedCitations: message.hasProcessedCitations || false
                }
            });

            // Update debate timestamp
            await prisma.debate.update({
                where: { id: debateId },
                data: { updatedAt: new Date() }
            });

            return { success: true };
        } catch (error) {
            console.error('Error adding message:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error adding message'
            };
        }
    }

    // Get debate data (first from Redis, then PostgreSQL)
    public async getDebate(debateId: string): Promise<FastAccessData | null> {
        try {
            // Try Redis first
            const debateDataStr = await this.redis.get(`debate:${debateId}`);
            if (debateDataStr) {
                return JSON.parse(debateDataStr);
            }

            // If not in Redis, try PostgreSQL
            const debate = await prisma.debate.findUnique({
                where: { id: debateId },
                include: {
                    messages: { orderBy: { sequence: 'asc' } },
                    experts: true
                }
            });

            if (debate) {
                const messages = debate.messages.map(m => ({
                    id: m.id,
                    role: m.role.toLowerCase(),
                    content: m.content,
                    speaker: m.speaker,
                    timestamp: m.createdAt.toISOString()
                }));

                const experts = debate.experts.map(e => ({
                    id: e.id,
                    name: e.name,
                    background: e.background,
                    stance: e.stance.toLowerCase(),
                    perspective: e.perspective,
                    expertise: e.expertise,
                    type: e.type.toLowerCase()
                }));

                const result: FastAccessData = {
                    topic: debate.topic,
                    experts,
                    messages,
                    lastUpdated: debate.updatedAt.toISOString()
                };

                // Cache in Redis for future access
                await this.redis.set(
                    `debate:${debateId}`,
                    JSON.stringify(result),
                    { ex: 60 * 60 * 24 } // 24 hours expiry
                );

                return result;
            }

            return null;
        } catch (error) {
            console.error('Error getting debate data:', error);
            return null;
        }
    }

    // Get debate metadata from PostgreSQL
    public async getDebateMetadata(debateId: string): Promise<DebateMetadata | null> {
        try {
            if (typeof window === 'undefined') {
                const debate = await prisma.debate.findUnique({
                    where: { id: debateId }
                });

                if (debate) {
                    return {
                        id: debate.id,
                        topic: debate.topic,
                        expertType: debate.expertType.toLowerCase(),
                        userId: debate.userId,
                        status: debate.status.toLowerCase(),
                        createdAt: debate.createdAt.toISOString(),
                        updatedAt: debate.updatedAt.toISOString()
                    } as DebateMetadata;
                }
            }
            return null;
        } catch (error) {
            console.error('Error getting debate metadata:', error);
            return null;
        }
    }
}
