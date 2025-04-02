'use client';

import { useState, useEffect } from 'react';
import { vercelAPI } from '@/lib/vercel/api';
import { Loader2, AlertCircle, ArrowUpDown, Clock, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ApiMetric {
    path: string;
    count: number;
    p50: number;
    p90: number;
    p99: number;
    avgDuration: number;
    errors: number;
    timestamp: string;
}

/**
 * Component to display API route performance metrics
 */
export function ApiPerformance({
    limit = 10,
    autoRefresh = false
}: {
    limit?: number;
    autoRefresh?: boolean;
}) {
    const [metrics, setMetrics] = useState<ApiMetric[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [refreshInterval, setRefreshInterval] = useState<number | null>(autoRefresh ? 30000 : null);
    const [sortConfig, setSortConfig] = useState<{ key: keyof ApiMetric, direction: 'asc' | 'desc' }>({
        key: 'count',
        direction: 'desc'
    });

    // Function to fetch API metrics
    const fetchMetrics = async () => {
        try {
            setLoading(true);
            const data = await vercelAPI.getApiRouteMetrics();

            // Limit to the most recently called APIs
            const sortedData = data
                .sort((a: ApiMetric, b: ApiMetric) => b.count - a.count)
                .slice(0, limit);

            setMetrics(sortedData);
            setError(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch API metrics');
            console.error('Error fetching API metrics:', err);
        } finally {
            setLoading(false);
        }
    };

    // Set up auto-refresh
    useEffect(() => {
        fetchMetrics();

        let intervalId: NodeJS.Timeout | null = null;

        if (refreshInterval !== null) {
            intervalId = setInterval(() => {
                fetchMetrics();
            }, refreshInterval);
        }

        return () => {
            if (intervalId) clearInterval(intervalId);
        };
    }, [refreshInterval, limit]);

    // Toggle auto-refresh
    const toggleAutoRefresh = () => {
        if (refreshInterval) {
            setRefreshInterval(null);
        } else {
            setRefreshInterval(30000); // Refresh every 30 seconds
        }
    };

    // Handle manual refresh
    const handleRefresh = () => {
        fetchMetrics();
    };

    // Handle sort
    const requestSort = (key: keyof ApiMetric) => {
        let direction: 'asc' | 'desc' = 'asc';

        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }

        setSortConfig({ key, direction });
    };

    // Sort metrics based on current config
    const sortedMetrics = [...metrics].sort((a, b) => {
        if (a[sortConfig.key] < b[sortConfig.key]) {
            return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (a[sortConfig.key] > b[sortConfig.key]) {
            return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
    });

    // Format duration in ms
    const formatDuration = (ms: number) => {
        return `${ms.toFixed(2)}ms`;
    };

    if (loading && metrics.length === 0) {
        return (
            <div className="flex items-center justify-center p-6 border rounded-lg bg-gray-50 dark:bg-gray-800">
                <Loader2 className="h-6 w-6 animate-spin mr-2 text-primary" />
                <span>Loading API metrics...</span>
            </div>
        );
    }

    if (error && metrics.length === 0) {
        return (
            <div className="p-6 border rounded-lg bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-300">
                <div className="flex items-center mb-2">
                    <AlertCircle className="h-5 w-5 mr-2" />
                    <h3 className="font-medium">Error fetching API metrics</h3>
                </div>
                <p className="text-sm">{error}</p>
            </div>
        );
    }

    if (metrics.length === 0) {
        return (
            <div className="p-6 border rounded-lg bg-yellow-50 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-300">
                <div className="flex items-center">
                    <AlertCircle className="h-5 w-5 mr-2" />
                    <span>No API metrics found</span>
                </div>
            </div>
        );
    }

    return (
        <div className="border rounded-lg overflow-hidden">
            <div className="bg-gray-50 dark:bg-gray-800 p-4 border-b flex justify-between items-center">
                <h3 className="font-medium">API Route Performance</h3>
                <div className="flex gap-2">
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={toggleAutoRefresh}
                    >
                        {refreshInterval ? 'Disable Auto-refresh' : 'Enable Auto-refresh'}
                    </Button>
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={handleRefresh}
                        data-testid="api-performance-refresh"
                    >
                        <RefreshCw className="h-4 w-4 mr-1" />
                        Refresh
                    </Button>
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead>
                        <tr className="bg-gray-50 dark:bg-gray-800 border-b">
                            <th
                                className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer"
                                onClick={() => requestSort('path')}
                            >
                                <div className="flex items-center">
                                    <span>API Route</span>
                                    {sortConfig.key === 'path' && (
                                        <ArrowUpDown className="h-4 w-4 ml-1" />
                                    )}
                                </div>
                            </th>
                            <th
                                className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer"
                                onClick={() => requestSort('count')}
                            >
                                <div className="flex items-center">
                                    <span>Invocations</span>
                                    {sortConfig.key === 'count' && (
                                        <ArrowUpDown className="h-4 w-4 ml-1" />
                                    )}
                                </div>
                            </th>
                            <th
                                className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer"
                                onClick={() => requestSort('avgDuration')}
                            >
                                <div className="flex items-center">
                                    <span>Avg Duration</span>
                                    {sortConfig.key === 'avgDuration' && (
                                        <ArrowUpDown className="h-4 w-4 ml-1" />
                                    )}
                                </div>
                            </th>
                            <th
                                className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer"
                                onClick={() => requestSort('p90')}
                            >
                                <div className="flex items-center">
                                    <span>p90</span>
                                    {sortConfig.key === 'p90' && (
                                        <ArrowUpDown className="h-4 w-4 ml-1" />
                                    )}
                                </div>
                            </th>
                            <th
                                className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer"
                                onClick={() => requestSort('errors')}
                            >
                                <div className="flex items-center">
                                    <span>Errors</span>
                                    {sortConfig.key === 'errors' && (
                                        <ArrowUpDown className="h-4 w-4 ml-1" />
                                    )}
                                </div>
                            </th>
                        </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-800">
                        {sortedMetrics.map((metric, index) => (
                            <tr key={`${metric.path}-${index}`} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                                <td className="px-4 py-3 whitespace-nowrap">
                                    <div className="text-sm font-medium">{metric.path}</div>
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap">
                                    <div className="text-sm">{metric.count.toLocaleString()}</div>
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap">
                                    <div className="text-sm">
                                        <div className="flex items-center">
                                            <Clock className="h-4 w-4 mr-1 text-gray-400" />
                                            {formatDuration(metric.avgDuration)}
                                        </div>
                                    </div>
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap">
                                    <div className="text-sm">{formatDuration(metric.p90)}</div>
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap">
                                    <div className={`text-sm ${metric.errors > 0 ? 'text-red-600 dark:text-red-400 font-medium' : ''}`}>
                                        {metric.errors}
                                        {metric.errors > 0 && (
                                            <span className="ml-1">({((metric.errors / metric.count) * 100).toFixed(2)}%)</span>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="p-3 border-t text-xs text-gray-500 dark:text-gray-400">
                <div className="flex items-center">
                    <Clock className="h-4 w-4 mr-1" />
                    <span>Last updated: {new Date().toLocaleTimeString()}</span>
                </div>
            </div>
        </div>
    );
} 