/**
 * API Request Manager
 * 
 * This module handles all API requests with:
 * - Deduplication: Prevents duplicate requests
 * - Caching: Caches responses for performance
 * - Request throttling: Limits request frequency
 * - Debug logging: Conditional logging
 */

// Constants for configuration
const API_CONFIG = {
    // Use environment variable or fallback to localhost
    baseUrl: process.env.NEXT_PUBLIC_API_BASE_URL || '',

    // Request throttling window
    throttleWindow: 5000, // 5 seconds

    // Cache TTL
    cacheTTL: 60000, // 1 minute

    // Enable or disable request tracking
    enableTracking: true,

    // Debug mode
    debug: process.env.DEBUG_MODE === 'true' || false
};

// Interface for request options
interface RequestOptions {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
    body?: any;
    headers?: Record<string, string>;
    cache?: boolean;
    throttle?: boolean;
    throttleKey?: string;
    retry?: boolean;
    retryCount?: number;
    signal?: AbortSignal;
}

// Response type
interface ApiResponse<T = any> {
    data: T;
    status: number;
    headers: Headers;
    cached?: boolean;
    requestId?: string;
}

// Request memory tracking in-memory
const inFlightRequests = new Map<string, Promise<ApiResponse>>();
const requestCache = new Map<string, { response: ApiResponse; timestamp: number }>();
const requestHistory = new Map<string, number>();

/**
 * Generate a unique key for the request
 */
function generateRequestKey(endpoint: string, options: RequestOptions): string {
    const method = options.method || 'GET';
    const url = endpoint.startsWith('http') ? endpoint : `${API_CONFIG.baseUrl}${endpoint}`;
    const body = options.body ? JSON.stringify(options.body) : '';

    // For GET requests, include query params in the key
    if (method === 'GET' && url.includes('?')) {
        return `${method}:${url}`;
    }

    // For other methods, include the body in the key
    return `${method}:${url}:${body}`;
}

/**
 * Conditionally log messages based on debug setting
 */
function debugLog(...args: any[]): void {
    if (API_CONFIG.debug) {
        console.log('[API]', ...args);
    }
}

/**
 * Check if a request should be throttled
 */
function shouldThrottle(key: string, options: RequestOptions): boolean {
    if (!options.throttle) return false;

    const now = Date.now();
    const lastRequest = requestHistory.get(key);

    // If we've made this request recently, throttle it
    if (lastRequest && now - lastRequest < API_CONFIG.throttleWindow) {
        debugLog(`Request throttled: ${key}`);
        return true;
    }

    return false;
}

/**
 * Get a response from cache if available and valid
 */
function getFromCache(key: string, options: RequestOptions): ApiResponse | null {
    if (!options.cache) return null;

    const cached = requestCache.get(key);
    if (!cached) return null;

    const now = Date.now();
    if (now - cached.timestamp > API_CONFIG.cacheTTL) {
        // Cache expired, remove it
        requestCache.delete(key);
        return null;
    }

    debugLog(`Cache hit: ${key}`);
    return { ...cached.response, cached: true };
}

/**
 * Store a response in the cache
 */
function cacheResponse(key: string, response: ApiResponse, options: RequestOptions): void {
    if (!options.cache) return;

    requestCache.set(key, {
        response,
        timestamp: Date.now()
    });

    debugLog(`Cached response: ${key}`);
}

/**
 * Track request timing
 */
function trackRequest(key: string): void {
    if (!API_CONFIG.enableTracking) return;

    requestHistory.set(key, Date.now());
}

/**
 * Make an API request with deduplication, caching, and throttling
 */
export async function makeRequest<T = any>(
    endpoint: string,
    options: RequestOptions = {}
): Promise<ApiResponse<T>> {
    // Set default options
    const requestOptions: RequestOptions = {
        method: 'GET',
        cache: true,
        throttle: true,
        retry: false,
        retryCount: 3,
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...options.headers
        }
    };

    // Generate a unique key for this request
    const requestKey = options.throttleKey || generateRequestKey(endpoint, requestOptions);

    // Check if this is a duplicate in-flight request
    if (inFlightRequests.has(requestKey)) {
        debugLog(`Duplicate request detected: ${requestKey}`);
        return inFlightRequests.get(requestKey) as Promise<ApiResponse<T>>;
    }

    // Check if we should throttle this request
    if (shouldThrottle(requestKey, requestOptions)) {
        // Try to get from cache if throttled
        const cachedResponse = getFromCache(requestKey, requestOptions);
        if (cachedResponse) {
            return cachedResponse as ApiResponse<T>;
        }
    }

    // Check cache before making a new request
    const cachedResponse = getFromCache(requestKey, requestOptions);
    if (cachedResponse) {
        return cachedResponse as ApiResponse<T>;
    }

    // Create the request promise
    const requestPromise = (async () => {
        try {
            // Track this request
            trackRequest(requestKey);

            // Ensure full URL
            const url = endpoint.startsWith('http') ? endpoint : `${API_CONFIG.baseUrl}${endpoint}`;

            // Prepare fetch options
            const fetchOptions: RequestInit = {
                method: requestOptions.method,
                headers: requestOptions.headers,
                signal: requestOptions.signal
            };

            // Add body if it exists and method is not GET
            if (requestOptions.body && requestOptions.method !== 'GET') {
                fetchOptions.body = JSON.stringify(requestOptions.body);
            }

            // Make the request
            debugLog(`Making ${requestOptions.method} request to ${url}`);
            const response = await fetch(url, fetchOptions);

            // Parse the response
            const data = await response.json();

            // Create the API response
            const apiResponse: ApiResponse<T> = {
                data,
                status: response.status,
                headers: response.headers,
                requestId: data.requestId || `req_${Date.now()}`
            };

            // Cache the response if needed
            cacheResponse(requestKey, apiResponse, requestOptions);

            return apiResponse;
        } catch (error) {
            debugLog(`Request failed: ${requestKey}`, error);

            // Handle retries if enabled
            if (requestOptions.retry && requestOptions.retryCount && requestOptions.retryCount > 0) {
                debugLog(`Retrying request (${requestOptions.retryCount} attempts left): ${requestKey}`);

                // Wait a bit before retrying
                await new Promise(resolve => setTimeout(resolve, 1000));

                // Retry with one less retry count
                return makeRequest<T>(endpoint, {
                    ...requestOptions,
                    retryCount: requestOptions.retryCount - 1
                });
            }

            // Rethrow the error
            throw error;
        } finally {
            // Remove the request from the in-flight requests
            inFlightRequests.delete(requestKey);
        }
    })();

    // Store the promise in the in-flight requests
    inFlightRequests.set(requestKey, requestPromise as Promise<ApiResponse>);

    // Return the promise
    return requestPromise;
}

/**
 * Convenience method for GET requests
 */
export function get<T = any>(endpoint: string, queryParams?: Record<string, string>, options: RequestOptions = {}): Promise<ApiResponse<T>> {
    // Convert query params to URL parameters
    let url = endpoint;
    if (queryParams) {
        const queryString = new URLSearchParams(queryParams).toString();
        url = `${endpoint}${url.includes('?') ? '&' : '?'}${queryString}`;
    }

    return makeRequest<T>(url, { ...options, method: 'GET' });
}

/**
 * Convenience method for POST requests
 */
export function post<T = any>(endpoint: string, body?: any, options: RequestOptions = {}): Promise<ApiResponse<T>> {
    return makeRequest<T>(endpoint, { ...options, method: 'POST', body });
}

/**
 * Clear the request cache
 */
export function clearCache(): void {
    requestCache.clear();
    debugLog('Request cache cleared');
}

/**
 * Initialize the request manager
 */
export function initRequestManager(config?: Partial<typeof API_CONFIG>): void {
    // Update configuration if provided
    if (config) {
        Object.assign(API_CONFIG, config);
    }

    debugLog('Request manager initialized', API_CONFIG);
}

// Export the API configuration
export { API_CONFIG }; 