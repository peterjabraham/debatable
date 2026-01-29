import { Message } from '@/types/message';
import { Expert } from '@/types/expert';
import { prisma } from '../db/prisma';
import { v4 as uuid } from 'uuid';

interface TaskData {
    debateId: string;
    [key: string]: any;
}

type TaskType =
    | 'initialize_debate_storage'
    | 'store_message'
    | 'update_context'
    | 'process_citations';

class BackgroundTasks {
    private static instance: BackgroundTasks;
    private taskQueue: Map<string, Promise<void>>;

    private constructor() {
        this.taskQueue = new Map();
    }

    static getInstance(): BackgroundTasks {
        if (!BackgroundTasks.instance) {
            BackgroundTasks.instance = new BackgroundTasks();
        }
        return BackgroundTasks.instance;
    }

    async queue(taskType: TaskType, data: TaskData): Promise<void> {
        const taskId = `${taskType}_${data.debateId}_${Date.now()}`;

        const taskPromise = this.executeTask(taskType, data)
            .catch(error => {
                console.error(`Task ${taskId} failed:`, error);
            })
            .finally(() => {
                this.taskQueue.delete(taskId);
            });

        this.taskQueue.set(taskId, taskPromise);
        return taskPromise;
    }

    private async executeTask(taskType: TaskType, data: TaskData): Promise<void> {
        switch (taskType) {
            case 'initialize_debate_storage':
                await this.initializeDebateStorage(data);
                break;
            case 'store_message':
                await this.storeMessage(data);
                break;
            case 'update_context':
                await this.updateContext(data);
                break;
            case 'process_citations':
                await this.processCitations(data);
                break;
        }
    }

    private async initializeDebateStorage(data: TaskData & { experts: Expert[] }): Promise<void> {
        const { debateId, experts } = data;

        // Create experts using Prisma transaction
        await prisma.$transaction(
            experts.map((expert, index) =>
                prisma.expert.create({
                    data: {
                        id: expert.id || uuid(),
                        debateId,
                        name: expert.name,
                        background: expert.background || '',
                        stance: index === 0 ? 'PRO' : 'CON',
                        perspective: expert.perspective || '',
                        expertise: expert.expertise || [],
                        type: 'HISTORICAL'
                    }
                })
            )
        );
    }

    private async storeMessage(data: TaskData & { message: Message }): Promise<void> {
        const { debateId, message } = data;

        // Get current message count for sequence
        const messageCount = await prisma.message.count({
            where: { debateId }
        });

        await prisma.message.create({
            data: {
                id: message.id || uuid(),
                debateId,
                role: (message.role?.toUpperCase() || 'USER') as any,
                content: message.content,
                speaker: message.speaker,
                sequence: messageCount,
                usage: message.usage as any,
                citations: message.citations as any,
                hasProcessedCitations: false
            }
        });
    }

    private async updateContext(data: TaskData & { message: Message }): Promise<void> {
        const { debateId, message } = data;

        // Update debate context based on new message
        // Get current debate context
        const debate = await prisma.debate.findUnique({
            where: { id: debateId },
            select: { context: true }
        });

        if (debate) {
            const currentContext = (debate.context as any) || {};
            const updatedContext = {
                ...currentContext,
                lastMessageAt: new Date().toISOString(),
                messageCount: ((currentContext.messageCount || 0) + 1)
            };

            await prisma.debate.update({
                where: { id: debateId },
                data: { context: updatedContext }
            });
        }
    }

    private async processCitations(data: TaskData & { message: Message }): Promise<void> {
        const { debateId, message } = data;

        // Mark message as having processed citations
        if (message.id) {
            await prisma.message.update({
                where: { id: message.id },
                data: { hasProcessedCitations: true }
            });
        }
    }
}

export const backgroundTasks = BackgroundTasks.getInstance();
