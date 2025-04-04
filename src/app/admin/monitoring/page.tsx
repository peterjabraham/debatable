'use client';

import { useState } from 'react';
import {
    DeploymentLogs,
    DeploymentList,
    DeploymentStatus,
    ApiPerformance
} from '@/components/monitoring';
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
    Button
} from '@/components/ui';
import { BarChart, RefreshCw, Loader2 } from 'lucide-react';

export default function MonitoringPage() {
    const [selectedTab, setSelectedTab] = useState('overview');
    const [selectedDeploymentId, setSelectedDeploymentId] = useState<string | null>(null);
    const [isGeneratingTraffic, setIsGeneratingTraffic] = useState(false);
    const [trafficResult, setTrafficResult] = useState<string | null>(null);

    const handleSelectDeployment = (deploymentId: string) => {
        setSelectedDeploymentId(deploymentId);
        setSelectedTab('logs');
    };

    const generateTestTraffic = async (count: number = 20) => {
        try {
            setIsGeneratingTraffic(true);
            setTrafficResult(null);

            const apiKey = process.env.NEXT_PUBLIC_MONITORING_API_KEY || 'test-monitoring-key';

            const response = await fetch(`/api/monitoring/generate-traffic?count=${count}`, {
                headers: {
                    'x-api-key': apiKey
                }
            });

            const result = await response.json();

            setTrafficResult(
                `Generated ${result.details.requests.length} test requests successfully.`
            );

            // Auto-refresh the API metrics after generating traffic
            setTimeout(() => {
                const apiPerformanceRefreshButton = document.querySelector(
                    '[data-testid="api-performance-refresh"]'
                ) as HTMLButtonElement;

                if (apiPerformanceRefreshButton) {
                    apiPerformanceRefreshButton.click();
                }
            }, 500);
        } catch (error) {
            console.error('Error generating test traffic:', error);
            setTrafficResult('Error generating test traffic. Check console for details.');
        } finally {
            setIsGeneratingTraffic(false);
        }
    };

    return (
        <div className="container mx-auto py-6 space-y-6">
            <h1 className="text-3xl font-bold">Vercel Monitoring Dashboard</h1>

            <p className="text-muted-foreground">
                Monitor your application deployments, performance, and logs in one place.
            </p>

            <DeploymentStatus />

            <Tabs value={selectedTab} onValueChange={setSelectedTab}>
                <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="deployments">Recent Deployments</TabsTrigger>
                    <TabsTrigger value="api">API Performance</TabsTrigger>
                    <TabsTrigger value="logs" disabled={!selectedDeploymentId}>
                        Deployment Logs
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <h2 className="text-xl font-semibold mb-4">Recent Deployments</h2>
                            <DeploymentList limit={3} onSelectDeployment={handleSelectDeployment} />
                        </div>
                        <div>
                            <h2 className="text-xl font-semibold mb-4">API Performance Summary</h2>
                            <ApiPerformance limit={5} />
                        </div>
                    </div>
                </TabsContent>

                <TabsContent value="deployments">
                    <h2 className="text-xl font-semibold mb-4">All Deployments</h2>
                    <DeploymentList limit={10} onSelectDeployment={handleSelectDeployment} />
                </TabsContent>

                <TabsContent value="api">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4">
                        <h2 className="text-xl font-semibold">API Route Performance</h2>
                        <div className="flex space-x-2 mt-2 sm:mt-0">
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => generateTestTraffic(20)}
                                disabled={isGeneratingTraffic}
                            >
                                {isGeneratingTraffic ? (
                                    <>
                                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                        Generating...
                                    </>
                                ) : (
                                    <>
                                        <BarChart className="h-4 w-4 mr-1" />
                                        Generate Test Traffic
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>

                    {trafficResult && (
                        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md text-green-800 dark:bg-green-900/20 dark:text-green-300 dark:border-green-800">
                            {trafficResult}
                        </div>
                    )}

                    <ApiPerformance limit={20} autoRefresh={true} />
                </TabsContent>

                <TabsContent value="logs">
                    {selectedDeploymentId ? (
                        <>
                            <h2 className="text-xl font-semibold mb-4">Deployment Logs</h2>
                            <DeploymentLogs deploymentId={selectedDeploymentId} />
                        </>
                    ) : (
                        <div className="p-6 border rounded-lg bg-yellow-50 dark:bg-yellow-900/20">
                            <p>Select a deployment to view logs.</p>
                        </div>
                    )}
                </TabsContent>
            </Tabs>
        </div>
    );
} 