/**
 * Vercel API client for interacting with Vercel API
 * This is a simplified version with mock data for development
 */

import axios from 'axios';

// Mock deployment data for development
const MOCK_DEPLOYMENTS = [
    {
        uid: 'dpl_mock1',
        name: 'Main Deployment',
        url: 'greatdebate.vercel.app',
        created: new Date().toISOString(),
        state: 'READY',
        target: 'production',
        meta: { githubCommitRef: 'main' }
    },
    {
        uid: 'dpl_mock2',
        name: 'Feature Branch',
        url: 'feature-branch-greatdebate.vercel.app',
        created: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
        state: 'READY',
        target: 'preview',
        meta: { githubCommitRef: 'feature/new-ui' }
    },
    {
        uid: 'dpl_mock3',
        name: 'Development Branch',
        url: 'dev-greatdebate.vercel.app',
        created: new Date(Date.now() - 172800000).toISOString(), // 2 days ago
        state: 'BUILDING',
        target: 'preview',
        meta: { githubCommitRef: 'develop' }
    }
];

// Mock logs for development
const MOCK_LOGS = [
    {
        id: 'log1',
        timestamp: new Date().toISOString(),
        level: 'info',
        message: 'Build started',
        source: 'system'
    },
    {
        id: 'log2',
        timestamp: new Date(Date.now() - 10000).toISOString(),
        level: 'info',
        message: 'Installing dependencies',
        source: 'system'
    },
    {
        id: 'log3',
        timestamp: new Date(Date.now() - 20000).toISOString(),
        level: 'info',
        message: 'Running build command: npm run build',
        source: 'system'
    },
    {
        id: 'log4',
        timestamp: new Date(Date.now() - 30000).toISOString(),
        level: 'warn',
        message: 'Package has missing peer dependencies',
        source: 'npm'
    },
    {
        id: 'log5',
        timestamp: new Date(Date.now() - 40000).toISOString(),
        level: 'error',
        message: 'Build failed: Cannot find module',
        source: 'build'
    }
];

// Mock API route metrics for development
const MOCK_API_METRICS = [
    {
        path: '/api/auth/session',
        count: 235,
        p50: 85.4,
        p90: 120.7,
        p99: 350.2,
        avgDuration: 98.3,
        errors: 0,
        timestamp: new Date().toISOString()
    },
    {
        path: '/api/user/profile',
        count: 187,
        p50: 152.1,
        p90: 320.5,
        p99: 750.8,
        avgDuration: 189.6,
        errors: 0,
        timestamp: new Date().toISOString()
    },
    {
        path: '/api/content/document',
        count: 75,
        p50: 350.8,
        p90: 756.2,
        p99: 1200.5,
        avgDuration: 402.3,
        errors: 2,
        timestamp: new Date().toISOString()
    },
    {
        path: '/api/debate',
        count: 42,
        p50: 1253.4,
        p90: 2100.8,
        p99: 3500.2,
        avgDuration: 1352.7,
        errors: 0,
        timestamp: new Date().toISOString()
    },
    {
        path: '/api/content/link',
        count: 38,
        p50: 240.5,
        p90: 380.2,
        p99: 620.8,
        avgDuration: 285.1,
        errors: 1,
        timestamp: new Date().toISOString()
    },
    {
        path: '/api/voice',
        count: 28,
        p50: 1800.2,
        p90: 2500.7,
        p99: 3800.1,
        avgDuration: 1950.3,
        errors: 3,
        timestamp: new Date().toISOString()
    },
    {
        path: '/api/user/preferences',
        count: 25,
        p50: 120.8,
        p90: 180.2,
        p99: 345.6,
        avgDuration: 142.1,
        errors: 0,
        timestamp: new Date().toISOString()
    }
];

/**
 * Vercel API client
 */
class VercelAPI {
    private token: string;
    private teamId?: string;
    private projectId: string;
    private useMock: boolean;
    private apiUrl: string;
    private monitoringApiKey: string;

    constructor() {
        // Get configuration from environment variables
        this.token = process.env.NEXT_PUBLIC_VERCEL_TOKEN || '';
        this.teamId = process.env.NEXT_PUBLIC_VERCEL_TEAM_ID;
        this.projectId = process.env.NEXT_PUBLIC_VERCEL_PROJECT_ID || '';
        this.apiUrl = 'https://api.vercel.com';

        // Use explicit environment variable if available
        this.monitoringApiKey = process.env.NEXT_PUBLIC_MONITORING_API_KEY || 'test-monitoring-key';

        console.log('Initialized VercelAPI with monitoring key:',
            this.monitoringApiKey ?
                `${this.monitoringApiKey.substring(0, 4)}...${this.monitoringApiKey.substring(this.monitoringApiKey.length - 4)}` :
                'none');

        // Use mock data in development or if token is not provided
        this.useMock = process.env.NODE_ENV === 'development' || !this.token;

        if (this.useMock) {
            console.warn('Using mock Vercel API data. Set NEXT_PUBLIC_VERCEL_TOKEN to use real API.');
        }
    }

    /**
     * Get the latest deployment
     */
    async getLatestDeployment() {
        if (this.useMock) {
            return MOCK_DEPLOYMENTS[0];
        }

        try {
            const params = new URLSearchParams({
                limit: '1',
                projectId: this.projectId
            });

            if (this.teamId) {
                params.append('teamId', this.teamId);
            }

            const response = await axios.get(`${this.apiUrl}/v6/deployments?${params.toString()}`, {
                headers: {
                    Authorization: `Bearer ${this.token}`
                }
            });

            return response.data.deployments[0] || null;
        } catch (error) {
            console.error('Error fetching latest deployment:', error);
            throw error;
        }
    }

    /**
     * Get a list of deployments
     * @param {number} limit - Maximum number of deployments to return
     */
    async getDeployments(limit: number = 10) {
        if (this.useMock) {
            // Return a copy to avoid mutations
            return [...MOCK_DEPLOYMENTS].slice(0, limit);
        }

        try {
            const params = new URLSearchParams({
                limit: limit.toString(),
                projectId: this.projectId
            });

            if (this.teamId) {
                params.append('teamId', this.teamId);
            }

            const response = await axios.get(`${this.apiUrl}/v6/deployments?${params.toString()}`, {
                headers: {
                    Authorization: `Bearer ${this.token}`
                }
            });

            return response.data.deployments || [];
        } catch (error) {
            console.error('Error fetching deployments:', error);
            throw error;
        }
    }

    /**
     * Get logs for a specific deployment
     * @param {string} deploymentId - ID of the deployment
     */
    async getDeploymentLogs(deploymentId: string) {
        if (this.useMock) {
            // Return a copy to avoid mutations
            return [...MOCK_LOGS];
        }

        try {
            const params = new URLSearchParams();

            if (this.teamId) {
                params.append('teamId', this.teamId);
            }

            const response = await axios.get(
                `${this.apiUrl}/v6/deployments/${deploymentId}/events?${params.toString()}`,
                {
                    headers: {
                        Authorization: `Bearer ${this.token}`
                    }
                }
            );

            // Transform the logs into a consistent format
            return response.data.events.map((event: any) => ({
                id: event.id || `event_${Date.now()}`,
                timestamp: new Date(event.created).toISOString(),
                level: event.type === 'error' ? 'error' : 'info',
                message: event.payload?.text || event.payload?.message || JSON.stringify(event.payload),
                source: event.type
            }));
        } catch (error) {
            console.error('Error fetching deployment logs:', error);
            throw error;
        }
    }

    /**
     * Get API route performance metrics
     * @returns Array of API route metrics
     */
    async getApiRouteMetrics() {
        // First, try to get metrics from our local API
        try {
            console.log('Fetching metrics with API key:', this.monitoringApiKey);
            const response = await axios.get(`/api/monitoring/metrics`, {
                headers: {
                    'x-api-key': this.monitoringApiKey
                }
            });

            // If we got metrics from our local API, use them
            if (response.data && response.data.metrics && response.data.metrics.length > 0) {
                return response.data.metrics;
            }
        } catch (error: any) {
            console.warn('Error fetching metrics from local API:', error.message);
            // If the error is a 401, it's probably because the API key is wrong
            if (error.response && error.response.status === 401) {
                console.error('API key authentication failed. Check your MONITORING_API_KEY environment variable.');
                console.log('Current API key in use:', this.monitoringApiKey);
            }
            // Continue to fallback mechanisms
        }

        // If local API failed or returned no metrics, try Vercel API if not in mock mode
        if (!this.useMock) {
            try {
                const params = new URLSearchParams({
                    projectId: this.projectId,
                    // Last 24 hours
                    from: new Date(Date.now() - 86400000).toISOString(),
                    to: new Date().toISOString()
                });

                if (this.teamId) {
                    params.append('teamId', this.teamId);
                }

                // Note: This is a theoretical endpoint - Vercel doesn't currently expose a public API for serverless function metrics
                const response = await axios.get(
                    `${this.apiUrl}/v1/projects/${this.projectId}/analytics/serverless-functions?${params.toString()}`,
                    {
                        headers: {
                            Authorization: `Bearer ${this.token}`
                        }
                    }
                );

                // Transform to our expected format
                return response.data.metrics.map((metric: any) => ({
                    path: metric.path,
                    count: metric.invocations,
                    p50: metric.p50ms,
                    p90: metric.p90ms,
                    p99: metric.p99ms,
                    avgDuration: metric.avgDuration,
                    errors: metric.errors,
                    timestamp: new Date().toISOString()
                }));
            } catch (error) {
                console.warn('Error fetching API route metrics from Vercel, falling back to mock data', error);
                // Continue to fallback
            }
        }

        // If all else fails, return mock data
        console.info('Using mock API metrics data');
        return [...MOCK_API_METRICS];
    }

    /**
     * Get system status
     */
    async getSystemStatus() {
        if (this.useMock) {
            return {
                status: 'operational',
                incidents: []
            };
        }

        try {
            // Vercel doesn't have a public status API, so we'll use a 3rd party status page
            // This is just for demonstration purposes
            const response = await axios.get('https://www.vercel-status.com/api/v2/status.json');
            return response.data;
        } catch (error) {
            console.error('Error fetching Vercel system status:', error);
            throw error;
        }
    }

    /**
     * Get project details
     */
    async getProjectDetails() {
        if (this.useMock) {
            return {
                name: 'greatdebate',
                id: this.projectId || 'prj_mock',
                framework: 'nextjs',
                latestDeployments: MOCK_DEPLOYMENTS.slice(0, 3)
            };
        }

        try {
            const params = new URLSearchParams();

            if (this.teamId) {
                params.append('teamId', this.teamId);
            }

            const response = await axios.get(
                `${this.apiUrl}/v9/projects/${this.projectId}?${params.toString()}`,
                {
                    headers: {
                        Authorization: `Bearer ${this.token}`
                    }
                }
            );

            return response.data;
        } catch (error) {
            console.error('Error fetching project details:', error);
            throw error;
        }
    }

    /**
     * Get function metrics
     */
    async getFunctionMetrics() {
        if (this.useMock) {
            return {
                functions: [
                    {
                        name: 'api/auth/[...nextauth]',
                        invocations: 250,
                        executionTime: 120
                    },
                    {
                        name: 'api/content/document',
                        invocations: 180,
                        executionTime: 200
                    }
                ]
            };
        }

        try {
            // Vercel doesn't have a public metrics API for functions
            // This is a placeholder for when/if they add one
            throw new Error('Function metrics API not available');
        } catch (error) {
            console.error('Error fetching function metrics:', error);
            throw error;
        }
    }

    /**
     * Get domains for the project
     */
    async getDomains() {
        if (this.useMock) {
            return [
                {
                    name: 'greatdebate.app',
                    verified: true,
                    type: 'primary'
                },
                {
                    name: 'www.greatdebate.app',
                    verified: true,
                    type: 'redirect'
                }
            ];
        }

        try {
            const params = new URLSearchParams();

            if (this.teamId) {
                params.append('teamId', this.teamId);
            }

            const response = await axios.get(
                `${this.apiUrl}/v9/projects/${this.projectId}/domains?${params.toString()}`,
                {
                    headers: {
                        Authorization: `Bearer ${this.token}`
                    }
                }
            );

            return response.data.domains;
        } catch (error) {
            console.error('Error fetching domains:', error);
            throw error;
        }
    }
}

// Export a singleton instance
export const vercelAPI = new VercelAPI(); 