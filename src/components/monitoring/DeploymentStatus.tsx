'use client';

import { useLatestDeployment } from '@/lib/vercel/hooks';
import { Loader2, CheckCircle, AlertCircle, Clock, ExternalLink, RefreshCw, GitBranch, GitCommit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow } from 'date-fns';

/**
 * Component to display the status of the latest deployment
 */
export function DeploymentStatus() {
    const { data: deployment, error, loading, refresh } = useLatestDeployment();

    // Refresh the data
    const handleRefresh = () => {
        refresh();
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center p-6 border rounded-lg bg-gray-50 dark:bg-gray-800">
                <Loader2 className="h-6 w-6 animate-spin mr-2 text-primary" />
                <span>Loading deployment status...</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-6 border rounded-lg bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-300">
                <div className="flex items-center mb-2">
                    <AlertCircle className="h-5 w-5 mr-2" />
                    <h3 className="font-medium">Error fetching deployment status</h3>
                </div>
                <p className="text-sm">{error}</p>
            </div>
        );
    }

    if (!deployment) {
        return (
            <div className="p-6 border rounded-lg bg-yellow-50 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-300">
                <div className="flex items-center">
                    <AlertCircle className="h-5 w-5 mr-2" />
                    <span>No deployment found</span>
                </div>
            </div>
        );
    }

    // Function to render status indicator
    const renderStatusIndicator = () => {
        const status = deployment.state?.toUpperCase() || 'UNKNOWN';

        switch (status) {
            case 'READY':
                return (
                    <div className="flex items-center text-green-600 dark:text-green-400">
                        <CheckCircle className="h-5 w-5 mr-2" />
                        <span className="font-medium">Live</span>
                    </div>
                );
            case 'BUILDING':
                return (
                    <div className="flex items-center text-blue-600 dark:text-blue-400">
                        <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                        <span className="font-medium">Building</span>
                    </div>
                );
            case 'QUEUED':
                return (
                    <div className="flex items-center text-yellow-600 dark:text-yellow-400">
                        <Clock className="h-5 w-5 mr-2" />
                        <span className="font-medium">Queued</span>
                    </div>
                );
            case 'ERROR':
                return (
                    <div className="flex items-center text-red-600 dark:text-red-400">
                        <AlertCircle className="h-5 w-5 mr-2" />
                        <span className="font-medium">Error</span>
                    </div>
                );
            default:
                return (
                    <div className="flex items-center text-gray-600 dark:text-gray-400">
                        <AlertCircle className="h-5 w-5 mr-2" />
                        <span className="font-medium">{status}</span>
                    </div>
                );
        }
    };

    // Format the deployment time
    const timeAgo = deployment.created
        ? formatDistanceToNow(new Date(deployment.created), { addSuffix: true })
        : 'Unknown';

    return (
        <div className="border rounded-lg overflow-hidden">
            <div className="bg-gray-50 dark:bg-gray-800 p-4 border-b flex justify-between items-center">
                <h3 className="font-medium">Latest Deployment</h3>
                <Button
                    size="sm"
                    variant="outline"
                    onClick={handleRefresh}
                >
                    <RefreshCw className="h-4 w-4 mr-1" />
                    Refresh
                </Button>
            </div>

            <div className="p-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between mb-4">
                    <div>
                        <h2 className="text-xl font-semibold mb-1">{deployment.name || 'Unnamed Deployment'}</h2>
                        <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                            {deployment.target && (
                                <div className="flex items-center mr-3">
                                    <GitBranch className="h-4 w-4 mr-1" />
                                    <span>{deployment.target}</span>
                                </div>
                            )}
                            {deployment.meta?.githubCommitRef && (
                                <div className="flex items-center">
                                    <GitCommit className="h-4 w-4 mr-1" />
                                    <span>{deployment.meta.githubCommitRef}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="mt-2 md:mt-0">
                        {renderStatusIndicator()}
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-4">
                    <div className="flex-1 p-4 border rounded-lg bg-gray-50 dark:bg-gray-800">
                        <div className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Deployment URL</div>
                        {deployment.url ? (
                            <div className="flex items-center">
                                <a
                                    href={`https://${deployment.url}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 dark:text-blue-400 hover:underline"
                                >
                                    {deployment.url}
                                    <ExternalLink className="inline-block h-4 w-4 ml-1" />
                                </a>
                            </div>
                        ) : (
                            <span className="text-gray-500 dark:text-gray-400">Not available</span>
                        )}
                    </div>

                    <div className="flex-1 p-4 border rounded-lg bg-gray-50 dark:bg-gray-800">
                        <div className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Deployed</div>
                        <div>{timeAgo}</div>
                    </div>

                    <div className="flex-1 p-4 border rounded-lg bg-gray-50 dark:bg-gray-800">
                        <div className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Deployment ID</div>
                        <div className="truncate" title={deployment.uid}>
                            {deployment.uid}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
} 