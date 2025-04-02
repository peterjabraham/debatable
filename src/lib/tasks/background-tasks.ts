import { Message } from '@/types/message';
import { Expert } from '@/types/expert';
import { firestore, COLLECTIONS } from '../db/firestore';

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

        // Create experts subcollection
        const batch = firestore.batch();
        const expertsRef = firestore
            .collection(COLLECTIONS.DEBATES)
            .doc(debateId)
            .collection('experts');

        experts.forEach(expert => {
            batch.set(expertsRef.doc(expert.id), expert);
        });

        await batch.commit();
    }

    private async storeMessage(data: TaskData & { message: Message }): Promise<void> {
        const { debateId, message } = data;

        await firestore
            .collection(COLLECTIONS.DEBATES)
            .doc(debateId)
            .collection('messages')
            .doc(message.id || crypto.randomUUID())
            .set(message);
    }

    private async updateContext(data: TaskData & { message: Message }): Promise<void> {
        const { debateId, message } = data;

        // Update debate context based on new message
        // This could include updating key points, sentiment analysis, etc.
        // Implementation depends on your specific needs
    }

    private async processCitations(data: TaskData & { message: Message }): Promise<void> {
        const { debateId, message } = data;

        // Process and store citations from the message
        // Implementation depends on your citation handling needs
    }
}

export const backgroundTasks = BackgroundTasks.getInstance(); 