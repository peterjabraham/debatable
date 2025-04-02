/**
 * API Metrics collection utility
 * This module provides functions to track API performance metrics
 */

// Define the structure of an API metric
interface ApiMetricData {
    path: string;
    duration: number;
    timestamp: number;
    statusCode: number;
    isError: boolean;
}

// In-memory store for metrics
// In a production app, you'd use a more persistent storage solution
class MetricsStore {
    private metrics: ApiMetricData[] = [];
    private readonly maxEntries: number = 1000; // Limit the number of entries to avoid memory issues

    // Add a new metric
    addMetric(metric: ApiMetricData): void {
        this.metrics.push(metric);

        // Remove oldest entries if we exceed the maximum
        if (this.metrics.length > this.maxEntries) {
            this.metrics = this.metrics.slice(this.metrics.length - this.maxEntries);
        }
    }

    // Get all metrics
    getAllMetrics(): ApiMetricData[] {
        return [...this.metrics];
    }

    // Get metrics for a specific path
    getMetricsForPath(path: string): ApiMetricData[] {
        return this.metrics.filter(metric => metric.path === path);
    }

    // Get metrics within a time range
    getMetricsInTimeRange(startTime: number, endTime: number): ApiMetricData[] {
        return this.metrics.filter(
            metric => metric.timestamp >= startTime && metric.timestamp <= endTime
        );
    }

    // Clear all metrics
    clearMetrics(): void {
        this.metrics = [];
    }

    // Get aggregated metrics for all paths
    getAggregatedMetrics(): Record<string, {
        path: string;
        count: number;
        avgDuration: number;
        p50: number;
        p90: number;
        p99: number;
        errors: number;
        timestamp: string;
    }> {
        const pathMetrics: Record<string, ApiMetricData[]> = {};

        // Group metrics by path
        this.metrics.forEach(metric => {
            if (!pathMetrics[metric.path]) {
                pathMetrics[metric.path] = [];
            }
            pathMetrics[metric.path].push(metric);
        });

        // Calculate aggregated metrics for each path
        const result: Record<string, any> = {};

        Object.entries(pathMetrics).forEach(([path, metrics]) => {
            // Sort durations for percentile calculations
            const durations = metrics.map(m => m.duration).sort((a, b) => a - b);
            const errorCount = metrics.filter(m => m.isError).length;

            result[path] = {
                path,
                count: metrics.length,
                avgDuration: durations.reduce((sum, val) => sum + val, 0) / durations.length,
                p50: this.calculatePercentile(durations, 50),
                p90: this.calculatePercentile(durations, 90),
                p99: this.calculatePercentile(durations, 99),
                errors: errorCount,
                timestamp: new Date().toISOString()
            };
        });

        return result;
    }

    // Helper to calculate percentiles
    private calculatePercentile(sortedValues: number[], percentile: number): number {
        if (sortedValues.length === 0) return 0;

        const index = Math.ceil((percentile / 100) * sortedValues.length) - 1;
        return sortedValues[Math.max(0, Math.min(sortedValues.length - 1, index))];
    }
}

// Create a singleton store
export const metricsStore = new MetricsStore();

/**
 * Middleware function to track API metrics
 * Usage: Add this to your API route handlers or middleware
 */
export async function trackApiMetrics(
    req: Request,
    path: string,
    handler: () => Promise<Response>
): Promise<Response> {
    console.log(`[API Metrics] Starting tracking for ${path}`);
    const startTime = performance.now();
    let response: Response;

    try {
        // Execute the API handler
        response = await handler();

        const endTime = performance.now();
        const duration = endTime - startTime;

        console.log(`[API Metrics] Completed ${path} in ${duration.toFixed(2)}ms with status ${response.status}`);

        // Record the metric
        metricsStore.addMetric({
            path,
            duration,
            timestamp: Date.now(),
            statusCode: response.status,
            isError: !response.ok
        });

        // Log the current metrics count
        const allMetrics = metricsStore.getAllMetrics();
        console.log(`[API Metrics] Total metrics collected: ${allMetrics.length}`);

        return response;
    } catch (error) {
        const endTime = performance.now();
        const duration = endTime - startTime;

        console.log(`[API Metrics] Error in ${path} after ${duration.toFixed(2)}ms: ${error}`);

        // Record error metric
        metricsStore.addMetric({
            path,
            duration,
            timestamp: Date.now(),
            statusCode: 500,
            isError: true
        });

        // Re-throw the error to be handled by the API route
        throw error;
    }
}

/**
 * Get aggregated metrics for all API routes
 * This can be exposed through an API endpoint for the dashboard
 */
export function getAggregatedMetrics() {
    const aggregated = metricsStore.getAggregatedMetrics();
    const metrics = Object.values(aggregated);
    console.log(`[API Metrics] Returning ${metrics.length} aggregated metrics`);
    return metrics;
} 