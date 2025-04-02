import axios from 'axios';

/**
 * VercelMonitoring class
 * Provides methods to interact with the Vercel API for monitoring deployments
 */
export class VercelMonitoring {
    private baseUrl: string = 'https://api.vercel.com';
    private token: string;
    private teamId?: string;
    private projectId?: string;

    constructor() {
        // Token will be loaded from environment variables
        this.token = process.env.VERCEL_TOKEN || '';
        this.teamId = process.env.VERCEL_TEAM_ID;
        this.projectId = process.env.VERCEL_PROJECT_ID;

        if (!this.token) {
            console.error('VERCEL_TOKEN is not defined in environment variables');
        }

        if (!this.projectId) {
            console.warn('VERCEL_PROJECT_ID is not defined in environment variables');
        }
    }

    /**
     * Get the latest deployment for the project
     */
    async getLatestDeployment(projectId?: string) {
        const pid = projectId || this.projectId;
        if (!pid) {
            throw new Error('Project ID is required');
        }

        try {
            const params = new URLSearchParams();
            params.append('limit', '1');

            if (this.teamId) {
                params.append('teamId', this.teamId);
            }

            const response = await axios.get(
                `${this.baseUrl}/v6/deployments`,
                {
                    params,
                    headers: {
                        Authorization: `Bearer ${this.token}`
                    }
                }
            );

            if (response.data && response.data.deployments && response.data.deployments.length > 0) {
                return response.data.deployments[0];
            }

            return null;
        } catch (error) {
            console.error('Failed to fetch latest deployment:', error);
            throw error;
        }
    }

    /**
     * Get logs for a specific deployment
     */
    async getDeploymentLogs(deploymentId: string) {
        try {
            const params = new URLSearchParams();

            if (this.teamId) {
                params.append('teamId', this.teamId);
            }

            const response = await axios.get(
                `${this.baseUrl}/v2/deployments/${deploymentId}/events`,
                {
                    params,
                    headers: {
                        Authorization: `Bearer ${this.token}`
                    }
                }
            );

            return response.data;
        } catch (error) {
            console.error(`Failed to fetch logs for deployment ${deploymentId}:`, error);
            throw error;
        }
    }

    /**
     * Get all deployments for the project
     */
    async getDeployments(limit = 10, projectId?: string) {
        const pid = projectId || this.projectId;
        if (!pid) {
            throw new Error('Project ID is required');
        }

        try {
            const params = new URLSearchParams();
            params.append('limit', limit.toString());

            if (this.teamId) {
                params.append('teamId', this.teamId);
            }

            const response = await axios.get(
                `${this.baseUrl}/v6/deployments`,
                {
                    params,
                    headers: {
                        Authorization: `Bearer ${this.token}`
                    }
                }
            );

            return response.data.deployments || [];
        } catch (error) {
            console.error('Failed to fetch deployments:', error);
            throw error;
        }
    }

    /**
     * Get project details
     */
    async getProjectDetails(projectId?: string) {
        const pid = projectId || this.projectId;
        if (!pid) {
            throw new Error('Project ID is required');
        }

        try {
            const params = new URLSearchParams();

            if (this.teamId) {
                params.append('teamId', this.teamId);
            }

            const response = await axios.get(
                `${this.baseUrl}/v9/projects/${pid}`,
                {
                    params,
                    headers: {
                        Authorization: `Bearer ${this.token}`
                    }
                }
            );

            return response.data;
        } catch (error) {
            console.error(`Failed to fetch project details for ${pid}:`, error);
            throw error;
        }
    }

    /**
     * Get functions metrics for a project
     */
    async getFunctionsMetrics(projectId?: string) {
        const pid = projectId || this.projectId;
        if (!pid) {
            throw new Error('Project ID is required');
        }

        try {
            const params = new URLSearchParams();

            if (this.teamId) {
                params.append('teamId', this.teamId);
            }

            const response = await axios.get(
                `${this.baseUrl}/v1/projects/${pid}/functions/metrics`,
                {
                    params,
                    headers: {
                        Authorization: `Bearer ${this.token}`
                    }
                }
            );

            return response.data;
        } catch (error) {
            console.error(`Failed to fetch functions metrics for ${pid}:`, error);
            throw error;
        }
    }

    /**
     * Get domains for a project
     */
    async getDomains(projectId?: string) {
        const pid = projectId || this.projectId;
        if (!pid) {
            throw new Error('Project ID is required');
        }

        try {
            const params = new URLSearchParams();

            if (this.teamId) {
                params.append('teamId', this.teamId);
            }

            const response = await axios.get(
                `${this.baseUrl}/v9/projects/${pid}/domains`,
                {
                    params,
                    headers: {
                        Authorization: `Bearer ${this.token}`
                    }
                }
            );

            return response.data.domains || [];
        } catch (error) {
            console.error(`Failed to fetch domains for ${pid}:`, error);
            throw error;
        }
    }
}

// Export singleton instance
export const vercelMonitoring = new VercelMonitoring();

// Export types for deployment data
export interface VercelDeployment {
    uid: string;
    name: string;
    url: string;
    created: number;
    state: 'BUILDING' | 'ERROR' | 'INITIALIZING' | 'QUEUED' | 'READY' | 'CANCELED';
    creator: {
        uid: string;
        email: string;
        username: string;
    };
    meta?: {
        [key: string]: string;
    };
    target?: string;
    readyState?: string;
}

export interface DeploymentLog {
    id: string;
    type: string;
    created: number;
    payload: any;
} 