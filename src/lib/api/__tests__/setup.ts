import { vi } from 'vitest';

// Keep console output for debugging
console.error = console.error;
console.warn = console.warn;
console.log = console.log;

// Force real API usage for live tests
process.env.NEXT_PUBLIC_USE_REAL_API = 'true';
process.env.API_SERVER_AVAILABLE = 'true';

// For live tests, we want to see console output and use real fetch
if (!process.env.OPENAI_API_KEY?.includes('test-key')) {
    // Using real API, keep console methods and fetch unmocked
} else {
    // In mock mode, silence console and mock fetch
    console.error = vi.fn();
    console.warn = vi.fn();
    console.log = vi.fn();
    global.fetch = vi.fn();
} 