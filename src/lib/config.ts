/**
 * Application configuration for MVP mode and API settings
 */

// Get real API flag from environment
const useRealApi = typeof process !== 'undefined' &&
    process.env.NEXT_PUBLIC_USE_REAL_API === 'true';

// Flag to disable debug logs in MVP mode
export const DISABLE_DEBUG_LOGS = false;

// Check if we're in a browser environment
const isBrowser = typeof window !== 'undefined';

// Get API server availability
// Simplified: Assume API server is not available
let apiServerAvailable = false;

// Add a flag to indicate if the backend API server is running
export const API_SERVER_AVAILABLE = apiServerAvailable; // Always false now

// Configuration interface
export interface MVPConfig {
    apiUrl: string;
    disableDebugLogs: boolean;
    throttleWindow: number;
    apiServerAvailable: boolean;
}

// MVP mode configuration
export const MVP_CONFIG: MVPConfig = {
    // API URL - will not be used when server is unavailable
    apiUrl: typeof process !== 'undefined' && process.env.NEXT_PUBLIC_API_BASE_URL
        ? process.env.NEXT_PUBLIC_API_BASE_URL
        : 'http://localhost:3030',

    // Silence console logs in MVP
    disableDebugLogs: DISABLE_DEBUG_LOGS,

    // Throttle window in milliseconds
    throttleWindow: 5000,

    // Indicate if API server is available (default to false for safety)
    apiServerAvailable: API_SERVER_AVAILABLE // Will be false
}; 