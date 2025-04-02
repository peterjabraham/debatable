import { Redis } from '@upstash/redis';

// Interface for Redis operations
export interface RedisClient {
    get(key: string): Promise<string | null>;
    set(key: string, value: string, options?: { ex?: number }): Promise<string | null>;
    del(key: string): Promise<number>;
}

// Mock Redis for development/testing
class MockRedis implements RedisClient {
    private storage: Map<string, { value: string; expiry?: number }> = new Map();

    async get(key: string): Promise<string | null> {
        const item = this.storage.get(key);
        if (!item) return null;

        if (item.expiry && item.expiry < Date.now()) {
            this.storage.delete(key);
            return null;
        }

        return item.value;
    }

    async set(key: string, value: string, options?: { ex?: number }): Promise<string> {
        this.storage.set(key, {
            value,
            expiry: options?.ex ? Date.now() + (options.ex * 1000) : undefined
        });
        return 'OK';
    }

    async del(key: string): Promise<number> {
        return this.storage.delete(key) ? 1 : 0;
    }
}

// Initialize Redis client
let redisClient: RedisClient | null = null;

export const getRedisClient = (): RedisClient => {
    // Return existing client if already initialized
    if (redisClient) return redisClient;

    // Only initialize on server side
    if (typeof window !== 'undefined') {
        console.warn('Redis client accessed on client side, using mock implementation');
        redisClient = new MockRedis();
        return redisClient;
    }

    try {
        // Check for Upstash Redis configuration
        if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
            console.warn('Upstash Redis not configured, using mock implementation');
            redisClient = new MockRedis();
            return redisClient;
        }

        // Initialize Upstash Redis client
        redisClient = new Redis({
            url: process.env.UPSTASH_REDIS_REST_URL,
            token: process.env.UPSTASH_REDIS_REST_TOKEN,
        });

        console.log('Upstash Redis initialized successfully');
        return redisClient;
    } catch (error) {
        console.error('Error initializing Redis:', error);
        console.warn('Using mock Redis implementation');
        redisClient = new MockRedis();
        return redisClient;
    }
};

// Export a function to test the Redis connection
export const testRedisConnection = async (): Promise<boolean> => {
    try {
        const redis = getRedisClient();
        const testKey = `test:${Date.now()}`;
        const testValue = 'connection-test';

        // Try to set and get a test value
        await redis.set(testKey, testValue, { ex: 60 });
        const result = await redis.get(testKey);
        await redis.del(testKey);

        return result === testValue;
    } catch (error) {
        console.error('Redis connection test failed:', error);
        return false;
    }
}; 