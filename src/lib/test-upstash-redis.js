const { Redis } = require('@upstash/redis');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

// Check if Upstash Redis is configured
if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    console.error('Upstash Redis configuration missing. Please set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN in .env.local');
    process.exit(1);
}

console.log(`Testing Upstash Redis connection to: ${process.env.UPSTASH_REDIS_REST_URL}`);

// Create Redis client
const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

// Test Redis connection
async function testRedis() {
    try {
        // Test set operation
        console.log('Setting test key...');
        await redis.set('test-key', 'Hello from Upstash Redis test script');

        // Test get operation
        console.log('Getting test key...');
        const value = await redis.get('test-key');
        console.log('Retrieved value:', value);

        // Test delete operation
        console.log('Deleting test key...');
        await redis.del('test-key');

        console.log('Upstash Redis connection test successful!');
    } catch (error) {
        console.error('Upstash Redis connection test failed:', error);
    }
}

// Run the test
testRedis(); 