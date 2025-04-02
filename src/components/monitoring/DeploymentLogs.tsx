'use client';

import { useState, useEffect } from 'react';
import { useDeploymentLogs } from '@/lib/vercel/hooks';
import { Loader2, AlertCircle, RefreshCw, ArrowDownToLine } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface LogEntry {
    id: string;
    timestamp: string;
    level: 'info' | 'error' | 'warn' | 'debug';
    message: string;
    source?: string;
}

/**
 * Component to display logs for a specific deployment
 */
export function DeploymentLogs({
    deploymentId,
    maxHeight = '600px',
    autoRefresh = false
}: {
    deploymentId: string;
    maxHeight?: string;
    autoRefresh?: boolean;
}) {
    const [refreshInterval, setRefreshInterval] = useState<number | null>(autoRefresh ? 10000 : null);
    const { data: logs, error, loading, refresh } = useDeploymentLogs(deploymentId, refreshInterval);

    // Function to handle manual refresh
    const handleRefresh = () => {
        refresh();
    };

    // Function to toggle auto-refresh
    const toggleAutoRefresh = () => {
        if (refreshInterval) {
            setRefreshInterval(null);
        } else {
            setRefreshInterval(10000); // Refresh every 10 seconds
        }
    };

    // Function to format timestamp
    const formatTimestamp = (timestamp: string) => {
        const date = new Date(timestamp);
        return date.toLocaleTimeString();
    };

    // Function to render log level badge
    const renderLogLevelBadge = (level: string) => {
        let bgColor = 'bg-gray-100 text-gray-800';

        switch (level.toLowerCase()) {
            case 'error':
                bgColor = 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
                break;
            case 'warn':
                bgColor = 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
                break;
            case 'info':
                bgColor = 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
                break;
            case 'debug':
                bgColor = 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
                break;
        }

        return (
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${bgColor}`}>
                {level}
            </span>
        );
    };

    // Function to download logs
    const downloadLogs = () => {
        if (!logs) return;

        const logText = logs.map((log: LogEntry) =>
            `[${new Date(log.timestamp).toISOString()}] [${log.level.toUpperCase()}] ${log.source ? `[${log.source}] ` : ''}${log.message}`
        ).join('\n');

        const blob = new Blob([logText], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `deployment-logs-${deploymentId}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center p-6 border rounded-lg bg-gray-50 dark:bg-gray-800">
                <Loader2 className="h-6 w-6 animate-spin mr-2 text-primary" />
                <span>Loading deployment logs...</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-6 border rounded-lg bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-300">
                <div className="flex items-center mb-2">
                    <AlertCircle className="h-5 w-5 mr-2" />
                    <h3 className="font-medium">Error fetching logs</h3>
                </div>
                <p className="text-sm">{error}</p>
            </div>
        );
    }

    if (!logs || logs.length === 0) {
        return (
            <div className="p-6 border rounded-lg bg-yellow-50 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-300">
                <div className="flex items-center">
                    <AlertCircle className="h-5 w-5 mr-2" />
                    <span>No logs found for this deployment</span>
                </div>
            </div>
        );
    }

    return (
        <div className="border rounded-lg overflow-hidden">
            <div className="bg-gray-50 dark:bg-gray-800 p-4 border-b flex justify-between items-center">
                <h3 className="font-medium">Logs for deployment: {deploymentId}</h3>
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
                    >
                        <RefreshCw className="h-4 w-4 mr-1" />
                        Refresh
                    </Button>
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={downloadLogs}
                    >
                        <ArrowDownToLine className="h-4 w-4 mr-1" />
                        Download
                    </Button>
                </div>
            </div>

            <div
                className="bg-gray-900 text-gray-100 p-4 font-mono text-sm overflow-auto"
                style={{ maxHeight }}
            >
                {logs.map((log: LogEntry) => (
                    <div key={log.id} className="mb-2 last:mb-0">
                        <div className="flex">
                            <span className="text-gray-400 mr-2">
                                {formatTimestamp(log.timestamp)}
                            </span>
                            {renderLogLevelBadge(log.level)}
                            {log.source && (
                                <span className="text-gray-400 mx-2">[{log.source}]</span>
                            )}
                        </div>
                        <div className="pl-2 border-l-2 border-gray-700 ml-2 mt-1 whitespace-pre-wrap">
                            {log.message}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
} 