import { redis, getDebateKey, setWithExpiry } from '@/lib/redis'
import { Expert } from '@/types/expert'
import { Message } from '@/types/message'

export interface DebateCacheData {
    id: string
    topic: string
    experts: Expert[]
    messages: Message[]
    status: 'active' | 'completed' | 'error'
    lastUpdated: string
    userId: string
}

export interface CacheOperationResult<T> {
    success: boolean
    data?: T
    error?: string
}

export class DebateCache {
    private static CACHE_DURATION = 24 // hours

    /**
     * Store debate data in cache
     */
    static async setDebate(debateData: DebateCacheData): Promise<CacheOperationResult<void>> {
        try {
            const key = getDebateKey(debateData.id)
            await setWithExpiry(key, debateData, this.CACHE_DURATION)
            return { success: true }
        } catch (error) {
            console.error('Error setting debate in cache:', error)
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to cache debate'
            }
        }
    }

    /**
     * Retrieve debate data from cache
     */
    static async getDebate(debateId: string): Promise<CacheOperationResult<DebateCacheData>> {
        try {
            const key = getDebateKey(debateId)
            const data = await redis.get<string>(key)

            if (!data) {
                return {
                    success: false,
                    error: 'Debate not found in cache'
                }
            }

            const debateData = JSON.parse(data) as DebateCacheData
            return {
                success: true,
                data: debateData
            }
        } catch (error) {
            console.error('Error getting debate from cache:', error)
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to retrieve debate'
            }
        }
    }

    /**
     * Add a message to a debate in cache
     */
    static async addMessage(debateId: string, message: Message): Promise<CacheOperationResult<void>> {
        try {
            const getResult = await this.getDebate(debateId)
            if (!getResult.success || !getResult.data) {
                return {
                    success: false,
                    error: getResult.error || 'Debate not found'
                }
            }

            const debate = getResult.data
            debate.messages.push(message)
            debate.lastUpdated = new Date().toISOString()

            return await this.setDebate(debate)
        } catch (error) {
            console.error('Error adding message to cached debate:', error)
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to add message'
            }
        }
    }

    /**
     * Update debate status
     */
    static async updateStatus(
        debateId: string,
        status: DebateCacheData['status']
    ): Promise<CacheOperationResult<void>> {
        try {
            const getResult = await this.getDebate(debateId)
            if (!getResult.success || !getResult.data) {
                return {
                    success: false,
                    error: getResult.error || 'Debate not found'
                }
            }

            const debate = getResult.data
            debate.status = status
            debate.lastUpdated = new Date().toISOString()

            return await this.setDebate(debate)
        } catch (error) {
            console.error('Error updating debate status in cache:', error)
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to update status'
            }
        }
    }

    /**
     * Remove debate from cache
     */
    static async removeDebate(debateId: string): Promise<CacheOperationResult<void>> {
        try {
            const key = getDebateKey(debateId)
            await redis.del(key)
            return { success: true }
        } catch (error) {
            console.error('Error removing debate from cache:', error)
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to remove debate'
            }
        }
    }

    /**
     * Get all active debates for a user
     */
    static async getUserDebates(userId: string): Promise<CacheOperationResult<DebateCacheData[]>> {
        try {
            // Get all debate keys
            const keys = await redis.keys('debate:metadata:*')
            const debates: DebateCacheData[] = []

            // Fetch all debates in parallel
            const debatePromises = keys.map(key => redis.get<string>(key))
            const debateResults = await Promise.all(debatePromises)

            // Filter debates for the user
            for (const result of debateResults) {
                if (result) {
                    const debate = JSON.parse(result) as DebateCacheData
                    if (debate.userId === userId) {
                        debates.push(debate)
                    }
                }
            }

            return {
                success: true,
                data: debates
            }
        } catch (error) {
            console.error('Error getting user debates from cache:', error)
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to get user debates'
            }
        }
    }
} 