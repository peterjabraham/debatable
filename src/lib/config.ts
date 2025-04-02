/**
 * Application configuration for MVP mode and API settings
 */

// Get real API flag from environment
const useRealApi = typeof process !== 'undefined' &&
    process.env.NEXT_PUBLIC_USE_REAL_API === 'true';

// Flag to completely disable API testing in MVP mode
// Override if real API usage is explicitly requested
export const DISABLE_API_TESTING = useRealApi ? false :
    typeof process !== 'undefined' && process.env.DISABLE_API_TESTING === 'true';

// Flag to disable debug logs in MVP mode
export const DISABLE_DEBUG_LOGS = false;

// Check if we're in a browser environment
const isBrowser = typeof window !== 'undefined';

// Get API server availability
// First check if it was set by Next.js config
let apiServerAvailable = false;

// In Node.js environment, check the global variable set by next.config.js
if (!isBrowser && typeof global !== 'undefined') {
    apiServerAvailable = Boolean(global.API_SERVER_AVAILABLE);
}

// Allow override by environment variable in browser
if (isBrowser && typeof window !== 'undefined') {
    try {
        // Check if there's a window-level override
        if (window.__API_SERVER_AVAILABLE !== undefined) {
            apiServerAvailable = Boolean(window.__API_SERVER_AVAILABLE);
        }
    } catch (e) {
        // Ignore errors
    }
}

// Add a flag to indicate if the backend API server is running
export const API_SERVER_AVAILABLE = apiServerAvailable;

// Configuration interface
export interface MVPConfig {
    apiUrl: string;
    disableApiTesting: boolean;
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

    // Always disable API testing in MVP mode
    disableApiTesting: DISABLE_API_TESTING,

    // Silence console logs in MVP
    disableDebugLogs: DISABLE_DEBUG_LOGS,

    // Throttle window in milliseconds
    throttleWindow: 5000,

    // Indicate if API server is available (default to false for safety)
    apiServerAvailable: API_SERVER_AVAILABLE
}; 