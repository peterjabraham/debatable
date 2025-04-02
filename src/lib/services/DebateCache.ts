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
    // In-memory cache to reduce Redis calls
    private static memoryCache: Map<string, { data: DebateCacheData, expiry: number }> = new Map()

    /**
     * Store debate data in cache
     */
    static async setDebate(debateData: DebateCacheData): Promise<CacheOperationResult<void>> {
        try {
            const key = getDebateKey(debateData.id)
            // Set in Redis
            await setWithExpiry(key, debateData, this.CACHE_DURATION)

            // Set in memory cache with expiry
            const expiryTime = Date.now() + (this.CACHE_DURATION * 60 * 60 * 1000)
            this.memoryCache.set(key, { data: { ...debateData }, expiry: expiryTime })

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
     * Clean expired items from memory cache
     */
    private static cleanMemoryCache() {
        const now = Date.now()
        for (const [key, value] of this.memoryCache.entries()) {
            if (value.expiry < now) {
                this.memoryCache.delete(key)
            }
        }
    }

    /**
     * Retrieve debate data from cache
     */
    static async getDebate(debateId: string): Promise<CacheOperationResult<DebateCacheData>> {
        try {
            const key = getDebateKey(debateId)

            // Clean expired cache entries periodically
            this.cleanMemoryCache()

            // Check memory cache first
            const cachedValue = this.memoryCache.get(key)
            if (cachedValue && cachedValue.expiry > Date.now()) {
                return {
                    success: true,
                    data: cachedValue.data
                }
            }

            // If not in memory, check Redis
            const data = await redis.get<string>(key)

            if (!data) {
                return {
                    success: false,
                    error: 'Debate not found in cache'
                }
            }

            const debateData = JSON.parse(data) as DebateCacheData

            // Store in memory cache for future use
            const expiryTime = Date.now() + (this.CACHE_DURATION * 60 * 60 * 1000)
            this.memoryCache.set(key, { data: debateData, expiry: expiryTime })

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
            // Clear from Redis
            await redis.del(key)
            // Clear from memory cache
            this.memoryCache.delete(key)
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

            // Check memory cache first before hitting Redis
            const pendingFetches: { key: string; promise: Promise<string | null> }[] = []

            for (const key of keys) {
                const cachedValue = this.memoryCache.get(key)
                if (cachedValue && cachedValue.expiry > Date.now() && cachedValue.data.userId === userId) {
                    debates.push(cachedValue.data)
                } else {
                    pendingFetches.push({ key, promise: redis.get<string>(key) })
                }
            }

            // Fetch remaining debates from Redis in parallel
            const debateResults = await Promise.all(pendingFetches.map(item => item.promise))

            // Process Redis results
            for (let i = 0; i < debateResults.length; i++) {
                const result = debateResults[i]
                const key = pendingFetches[i].key

                if (result) {
                    const debate = JSON.parse(result) as DebateCacheData
                    if (debate.userId === userId) {
                        debates.push(debate)

                        // Update memory cache
                        const expiryTime = Date.now() + (this.CACHE_DURATION * 60 * 60 * 1000)
                        this.memoryCache.set(key, { data: debate, expiry: expiryTime })
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