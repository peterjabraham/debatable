const Redis = require('ioredis');

// Get Redis URL from environment variable or use a default
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

console.log(`Testing Redis connection to: ${redisUrl}`);

// Create Redis client
const redis = new Redis(redisUrl);

// Test Redis connection
async function testRedis() {
    try {
        // Test set operation
        console.log('Setting test key...');
        await redis.set('test-key', 'Hello from Redis test script');

        // Test get operation
        console.log('Getting test key...');
        const value = await redis.get('test-key');
        console.log('Retrieved value:', value);

        // Test delete operation
        console.log('Deleting test key...');
        await redis.del('test-key');

        console.log('Redis connection test successful!');
    } catch (error) {
        console.error('Redis connection test failed:', error);
    } finally {
        // Close the Redis connection
        redis.quit();
    }
}

// Run the test
testRedis(); 