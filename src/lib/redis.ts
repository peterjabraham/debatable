import { Redis } from '@upstash/redis'

if (!process.env.UPSTASH_REDIS_REST_URL) {
    throw new Error('UPSTASH_REDIS_REST_URL is not defined')
}

if (!process.env.UPSTASH_REDIS_REST_TOKEN) {
    throw new Error('UPSTASH_REDIS_REST_TOKEN is not defined')
}

// Create Redis client
export const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
})

// Test function to verify connection
export async function testRedisConnection() {
    try {
        // Test write
        await redis.set('test_key', 'Connection successful!')
        // Test read
        const result = await redis.get('test_key')
        // Test delete
        await redis.del('test_key')
        return { success: true, message: result }
    } catch (error) {
        console.error('Redis connection test failed:', error)
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
}

// Helper function to generate Redis keys for debates
export function getDebateKey(debateId: string, type: 'metadata' | 'messages' | 'context' = 'metadata') {
    return `debate:${type}:${debateId}`
}

// Helper function to set data with expiration
export async function setWithExpiry(key: string, data: any, expiryHours = 24) {
    const expirySeconds = expiryHours * 60 * 60
    return redis.set(key, JSON.stringify(data), { ex: expirySeconds })
} 