'use client';

import { useState } from 'react';
import { useDeployments } from '@/lib/vercel/hooks';
import { formatDistanceToNow } from 'date-fns';
import { Loader2, CheckCircle, AlertCircle, Clock, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Component to display a list of recent deployments
 */
export function DeploymentList({
    limit = 5,
    onSelectDeployment
}: {
    limit?: number;
    onSelectDeployment?: (deploymentId: string) => void;
}) {
    const [selectedDeploymentId, setSelectedDeploymentId] = useState<string | null>(null);
    const { data: deployments, error, loading } = useDeployments(limit);

    // Function to handle deployment selection
    const handleSelectDeployment = (deploymentId: string) => {
        setSelectedDeploymentId(deploymentId);
        if (onSelectDeployment) {
            onSelectDeployment(deploymentId);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center p-6 border rounded-lg bg-gray-50 dark:bg-gray-800">
                <Loader2 className="h-6 w-6 animate-spin mr-2 text-primary" />
                <span>Loading deployments...</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-6 border rounded-lg bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-300">
                <div className="flex items-center mb-2">
                    <AlertCircle className="h-5 w-5 mr-2" />
                    <h3 className="font-medium">Error fetching deployments</h3>
                </div>
                <p className="text-sm">{error}</p>
            </div>
        );
    }

    if (!deployments || deployments.length === 0) {
        return (
            <div className="p-6 border rounded-lg bg-yellow-50 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-300">
                <div className="flex items-center">
                    <AlertCircle className="h-5 w-5 mr-2" />
                    <span>No deployments found</span>
                </div>
            </div>
        );
    }

    // Function to get status icon
    const getStatusIcon = (status: string) => {
        switch (status.toUpperCase()) {
            case 'READY':
                return <CheckCircle className="h-5 w-5 text-green-500" />;
            case 'BUILDING':
                return <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />;
            case 'QUEUED':
                return <Clock className="h-5 w-5 text-yellow-500" />;
            case 'ERROR':
                return <AlertCircle className="h-5 w-5 text-red-500" />;
            default:
                return <AlertCircle className="h-5 w-5 text-gray-500" />;
        }
    };

    return (
        <div className="border rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead>
                        <tr className="bg-gray-50 dark:bg-gray-800 border-b">
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                Status
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                Deployment
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                Branch
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                Time
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                Actions
                            </th>
                        </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-800">
                        {deployments.map((deployment) => {
                            const timeAgo = deployment.created
                                ? formatDistanceToNow(new Date(deployment.created), { addSuffix: true })
                                : 'Unknown';

                            return (
                                <tr
                                    key={deployment.uid}
                                    className={selectedDeploymentId === deployment.uid
                                        ? 'bg-primary/10 hover:bg-primary/20'
                                        : 'hover:bg-gray-50 dark:hover:bg-gray-800'}
                                    onClick={() => handleSelectDeployment(deployment.uid)}
                                >
                                    <td className="px-4 py-3 whitespace-nowrap">
                                        <div className="flex items-center">
                                            {getStatusIcon(deployment.state || 'unknown')}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap">
                                        <div className="text-sm font-medium">
                                            {deployment.name || 'Unnamed'}
                                        </div>
                                        <div className="text-xs text-gray-500 dark:text-gray-400">
                                            {deployment.url && (
                                                <a
                                                    href={`https://${deployment.url}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="hover:underline"
                                                >
                                                    {deployment.url}
                                                </a>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap">
                                        <div className="text-sm">{deployment.target || 'Unknown'}</div>
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap">
                                        <div className="text-sm">{timeAgo}</div>
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium">
                                        <div className="flex space-x-2">
                                            {deployment.url && (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        window.open(`https://${deployment.url}`, '_blank');
                                                    }}
                                                >
                                                    <ExternalLink className="h-4 w-4" />
                                                    <span className="sr-only">Visit</span>
                                                </Button>
                                            )}
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleSelectDeployment(deployment.uid);
                                                }}
                                            >
                                                View Logs
                                            </Button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {selectedDeploymentId && !onSelectDeployment && (
                <div className="p-4 border-t">
                    <h3 className="text-sm font-medium mb-2">Selected Deployment: {selectedDeploymentId}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        To view detailed logs, implement the DeploymentLogs component and pass the selected ID.
                    </p>
                </div>
            )}
        </div>
    );
} 