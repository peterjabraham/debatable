"use client";

import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, CheckCircle2, XCircle } from "lucide-react";

export function PerplexityDebug() {
    const [diagnosticResults, setDiagnosticResults] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const runDiagnostics = async () => {
        setIsLoading(true);
        setError(null);

        try {
            const response = await fetch('/api/test-perplexity');

            if (!response.ok) {
                throw new Error(`Diagnostic API returned ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            setDiagnosticResults(data);
        } catch (err) {
            setError(err.message || 'Unknown error occurred');
        } finally {
            setIsLoading(false);
        }
    };

    // Auto-run diagnostics on mount
    useEffect(() => {
        runDiagnostics();
    }, []);

    const getStatusColor = (status: number | null | 'error') => {
        if (status === 200) return "text-green-500";
        if (status === 401) return "text-red-500";
        if (status === 'error') return "text-red-500";
        return "text-yellow-500";
    };

    const getStatusBadge = (status: number | null | 'error') => {
        if (status === 200) return "success";
        if (status === 401) return "destructive";
        if (status === 'error') return "destructive";
        return "warning";
    };

    // Add a function to render a summary status at the top
    const getApiSummaryStatus = (diagnosticResults) => {
        if (!diagnosticResults) return null;

        // Determine overall API status
        let status = 'unknown';
        let message = '';
        let icon = null;

        if (diagnosticResults.apiTest.status === 200 && !diagnosticResults.mockDataForced) {
            status = 'success';
            message = 'Perplexity API is operational and available';
            icon = <CheckCircle2 className="h-4 w-4 text-green-500" />;
        } else if (diagnosticResults.apiTest.status === 401) {
            status = 'error';
            message = 'Authentication error - API key is invalid or expired';
            icon = <XCircle className="h-4 w-4 text-red-500" />;
        } else if (diagnosticResults.apiTest.status === 'error') {
            status = 'error';
            message = 'Connection error - Cannot reach Perplexity API';
            icon = <XCircle className="h-4 w-4 text-red-500" />;
        } else if (diagnosticResults.mockDataForced) {
            status = 'warning';
            message = 'Using mock data due to configuration or rate limiting';
            icon = <AlertCircle className="h-4 w-4 text-yellow-500" />;
        }

        return (
            <Alert variant={status === 'success' ? 'default' : status === 'error' ? 'destructive' : 'warning'} className="mb-4">
                <div className="flex items-center">
                    {icon}
                    <div className="ml-2">
                        <AlertTitle className="text-sm font-medium">
                            {status === 'success' ? 'API Available' : status === 'error' ? 'API Error' : 'Mock Data Mode'}
                        </AlertTitle>
                        <AlertDescription className="text-xs">
                            {message}
                        </AlertDescription>
                    </div>
                </div>
            </Alert>
        );
    };

    return (
        <Card className="w-full">
            <CardHeader>
                <div className="flex justify-between items-center">
                    <div>
                        <CardTitle>Perplexity API Diagnostics</CardTitle>
                        <CardDescription>Check why you're seeing mock data</CardDescription>
                    </div>
                    <Button
                        variant="outline"
                        onClick={runDiagnostics}
                        disabled={isLoading}
                    >
                        {isLoading ? 'Running...' : 'Run Diagnostics'}
                    </Button>
                </div>
            </CardHeader>

            <CardContent>
                {error ? (
                    <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Error</AlertTitle>
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                ) : !diagnosticResults ? (
                    <div className="text-center py-4">
                        {isLoading ? 'Running diagnostics...' : 'No diagnostic data available.'}
                    </div>
                ) : (
                    <div className="space-y-4">
                        {/* Summary Status */}
                        {getApiSummaryStatus(diagnosticResults)}

                        {/* Environment Section */}
                        <div>
                            <h3 className="text-sm font-medium mb-2">Environment Configuration</h3>
                            <div className="grid grid-cols-2 gap-2 text-sm">
                                <div className="flex items-center">
                                    <span className="text-muted-foreground mr-2">API Key:</span>
                                    {diagnosticResults.environment.apiKeyExists ? (
                                        <Badge variant={diagnosticResults.environment.apiKeyFormat === 'valid' ? 'outline' : 'destructive'}>
                                            {diagnosticResults.environment.apiKeyFormat === 'valid'
                                                ? `${diagnosticResults.environment.apiKeyFirstFive}...${diagnosticResults.environment.apiKeyLastFour}`
                                                : 'Invalid Format'}
                                        </Badge>
                                    ) : (
                                        <Badge variant="destructive">Missing</Badge>
                                    )}
                                </div>
                                <div className="flex items-center">
                                    <span className="text-muted-foreground mr-2">USE_MOCK_DATA:</span>
                                    <Badge variant={diagnosticResults.environment.useMockData ? 'destructive' : 'outline'}>
                                        {diagnosticResults.environment.useMockData ? 'true' : 'false'}
                                    </Badge>
                                </div>
                                <div className="flex items-center">
                                    <span className="text-muted-foreground mr-2">MOCK_API:</span>
                                    <Badge variant={diagnosticResults.environment.mockApi ? 'destructive' : 'outline'}>
                                        {diagnosticResults.environment.mockApi ? 'true' : 'false'}
                                    </Badge>
                                </div>
                                <div className="flex items-center">
                                    <span className="text-muted-foreground mr-2">NODE_ENV:</span>
                                    <Badge variant="outline">{diagnosticResults.environment.nodeEnv}</Badge>
                                </div>
                            </div>
                        </div>

                        {/* API Test Section */}
                        {diagnosticResults.apiTest.tested && (
                            <div>
                                <h3 className="text-sm font-medium mb-2">API Test Results</h3>
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="text-muted-foreground">Status:</span>
                                    <Badge variant={getStatusBadge(diagnosticResults.apiTest.status)}>
                                        {diagnosticResults.apiTest.status === 'error'
                                            ? 'Error'
                                            : diagnosticResults.apiTest.status}
                                    </Badge>
                                    <span className={getStatusColor(diagnosticResults.apiTest.status)}>
                                        {diagnosticResults.apiTest.message}
                                    </span>
                                </div>

                                {diagnosticResults.apiTest.sample && (
                                    <div className="text-sm">
                                        <span className="text-muted-foreground">Sample Result:</span>
                                        <span className="ml-2">{JSON.stringify(diagnosticResults.apiTest.sample)}</span>
                                    </div>
                                )}

                                {diagnosticResults.apiTest.error && (
                                    <div className="text-sm mt-2">
                                        <span className="text-red-500">Error Details:</span>
                                        <div className="p-2 bg-red-50 dark:bg-red-900/20 rounded text-xs mt-1 overflow-auto max-h-20">
                                            {diagnosticResults.apiTest.error}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Mockup Status */}
                        <div className="flex items-center gap-2">
                            <span className="text-muted-foreground">Mock Data Status:</span>
                            {diagnosticResults.mockDataForced ? (
                                <div className="flex items-center">
                                    <Badge variant="warning">Forced</Badge>
                                    <span className="ml-2 text-sm text-yellow-600 dark:text-yellow-400">
                                        Mock data is being used due to configuration
                                    </span>
                                </div>
                            ) : (
                                <div className="flex items-center">
                                    <Badge variant="success">Disabled</Badge>
                                    <span className="ml-2 text-sm text-green-600 dark:text-green-400">
                                        Application should use real API data
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* Recommendations */}
                        {diagnosticResults.recommendations && diagnosticResults.recommendations.length > 0 && (
                            <div>
                                <h3 className="text-sm font-medium mb-2">Recommendations</h3>
                                <ul className="list-disc pl-5 text-sm space-y-1">
                                    {diagnosticResults.recommendations.map((rec, index) => (
                                        <li key={index} className="text-blue-600 dark:text-blue-400">{rec}</li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {/* API Usage Statistics */}
                        {diagnosticResults.apiUsage && (
                            <div>
                                <h3 className="text-sm font-medium mb-2">API Usage Statistics</h3>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                    <div className="bg-muted p-3 rounded-lg">
                                        <div className="text-xs text-muted-foreground">Requests Today</div>
                                        <div className="text-lg font-semibold">{diagnosticResults.apiUsage.requestsToday || 0}</div>
                                    </div>
                                    <div className="bg-muted p-3 rounded-lg">
                                        <div className="text-xs text-muted-foreground">Rate Limit</div>
                                        <div className="text-lg font-semibold">{diagnosticResults.apiUsage.rateLimit || 'N/A'}</div>
                                    </div>
                                    <div className="bg-muted p-3 rounded-lg">
                                        <div className="text-xs text-muted-foreground">Remaining</div>
                                        <div className="text-lg font-semibold">{diagnosticResults.apiUsage.remaining || 'N/A'}</div>
                                    </div>
                                    <div className="bg-muted p-3 rounded-lg">
                                        <div className="text-xs text-muted-foreground">Reset Time</div>
                                        <div className="text-lg font-semibold">
                                            {diagnosticResults.apiUsage.resetTime
                                                ? new Date(diagnosticResults.apiUsage.resetTime).toLocaleTimeString()
                                                : 'N/A'}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </CardContent>

            <CardFooter className="text-xs text-muted-foreground">
                {diagnosticResults?.timestamp && (
                    <div>Last checked: {new Date(diagnosticResults.timestamp).toLocaleString()}</div>
                )}
            </CardFooter>
        </Card>
    );
} 