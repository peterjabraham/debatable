'use client';

import { useState, useEffect, useCallback } from 'react';
import { vercelAPI } from './api';

// Types
export interface MonitoringResponse<T> {
    data?: T;
    error?: string;
    loading: boolean;
}

/**
 * Hook to fetch the latest deployment status
 * @returns Object with deployment data, loading state, and error message
 */
export function useLatestDeployment() {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            const response = await vercelAPI.getLatestDeployment();
            setData(response);
            setError(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch deployment');
            console.error('Error fetching latest deployment:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();

        // Set up interval for auto-refresh
        const intervalId = setInterval(() => {
            fetchData();
        }, 60000); // Refresh every minute

        return () => clearInterval(intervalId);
    }, [fetchData]);

    return { data, loading, error, refresh: fetchData };
}

/**
 * Hook to fetch a list of deployments
 * @param {number} limit - Maximum number of deployments to fetch
 * @returns Object with deployments data, loading state, and error message
 */
export function useDeployments(limit: number = 10) {
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            const response = await vercelAPI.getDeployments(limit);
            setData(response);
            setError(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch deployments');
            console.error('Error fetching deployments:', err);
        } finally {
            setLoading(false);
        }
    }, [limit]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    return { data, loading, error, refresh: fetchData };
}

/**
 * Hook to fetch logs for a specific deployment
 * @param {string} deploymentId - ID of the deployment to fetch logs for
 * @param {number | null} refreshInterval - Interval in ms to refresh logs, or null for no auto-refresh
 * @returns Object with logs data, loading state, and error message
 */
export function useDeploymentLogs(deploymentId: string, refreshInterval: number | null = null) {
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    const fetchData = useCallback(async () => {
        if (!deploymentId) return;

        try {
            setLoading(true);
            const response = await vercelAPI.getDeploymentLogs(deploymentId);
            setData(response);
            setError(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch deployment logs');
            console.error('Error fetching deployment logs:', err);
        } finally {
            setLoading(false);
        }
    }, [deploymentId]);

    useEffect(() => {
        fetchData();

        // Set up interval for auto-refresh if provided
        let intervalId: NodeJS.Timeout | null = null;

        if (refreshInterval !== null) {
            intervalId = setInterval(() => {
                fetchData();
            }, refreshInterval);
        }

        return () => {
            if (intervalId) clearInterval(intervalId);
        };
    }, [fetchData, refreshInterval]);

    return { data, loading, error, refresh: fetchData };
}

/**
 * Hook to fetch Vercel system status
 * @returns Object with status data, loading state, and error message
 */
export function useVercelStatus() {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            const response = await vercelAPI.getSystemStatus();
            setData(response);
            setError(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch Vercel system status');
            console.error('Error fetching Vercel system status:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();

        // Refresh status every 5 minutes
        const intervalId = setInterval(() => {
            fetchData();
        }, 300000);

        return () => clearInterval(intervalId);
    }, [fetchData]);

    return { data, loading, error, refresh: fetchData };
}

/**
 * Hook to fetch project details
 */
export function useProjectDetails(): MonitoringResponse<any> {
    const [state, setState] = useState<MonitoringResponse<any>>({
        loading: true
    });

    useEffect(() => {
        const fetchData = async () => {
            try {
                const response = await vercelAPI.getProjectDetails();
                setState({
                    data: response.project,
                    loading: false
                });
            } catch (error) {
                console.error('Error fetching project details:', error);
                setState({
                    error: error instanceof Error ? error.message : 'Failed to fetch project details',
                    loading: false
                });
            }
        };

        fetchData();
    }, []);

    return state;
}

/**
 * Hook to fetch function metrics
 */
export function useFunctionMetrics(): MonitoringResponse<any> {
    const [state, setState] = useState<MonitoringResponse<any>>({
        loading: true
    });

    useEffect(() => {
        const fetchData = async () => {
            try {
                const response = await vercelAPI.getFunctionMetrics();
                setState({
                    data: response.metrics,
                    loading: false
                });
            } catch (error) {
                console.error('Error fetching function metrics:', error);
                setState({
                    error: error instanceof Error ? error.message : 'Failed to fetch function metrics',
                    loading: false
                });
            }
        };

        fetchData();
    }, []);

    return state;
}

/**
 * Hook to fetch domains
 */
export function useDomains(): MonitoringResponse<any[]> {
    const [state, setState] = useState<MonitoringResponse<any[]>>({
        loading: true
    });

    useEffect(() => {
        const fetchData = async () => {
            try {
                const response = await vercelAPI.getDomains();
                setState({
                    data: response.domains,
                    loading: false
                });
            } catch (error) {
                console.error('Error fetching domains:', error);
                setState({
                    error: error instanceof Error ? error.message : 'Failed to fetch domains',
                    loading: false
                });
            }
        };

        fetchData();
    }, []);

    return state;
} 