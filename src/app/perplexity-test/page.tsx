"use client";

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';

export default function PerplexityTestPage() {
    const [testResults, setTestResults] = useState<string>('No test run yet');
    const [isLoading, setIsLoading] = useState(false);
    const [expertType, setExpertType] = useState<'historical' | 'ai'>('ai');
    const [testTopic, setTestTopic] = useState('climate change');
    const [keyStatus, setKeyStatus] = useState<{
        verified: boolean;
        details: any;
    } | null>(null);

    const runBasicTest = async () => {
        setIsLoading(true);
        setTestResults('Running test...');

        try {
            // Call our debug endpoint
            const response = await fetch('/api/perplexity/debug');
            const data = await response.json();

            setTestResults(JSON.stringify(data, null, 2));
        } catch (error) {
            setTestResults(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            setIsLoading(false);
        }
    };

    const runTopicTest = async () => {
        setIsLoading(true);
        setTestResults(`Running topic test for "${testTopic}" as ${expertType} expert...`);

        try {
            // Call the single-expert endpoint with our test parameters
            const response = await fetch('/api/perplexity/single-expert', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    expertName: expertType === 'historical' ? 'Albert Einstein' : 'Topic Expert',
                    topic: testTopic,
                    expertType
                })
            });

            const data = await response.json();

            setTestResults(JSON.stringify({
                status: response.status,
                timestamp: new Date().toISOString(),
                readingsCount: data.readings?.length || 0,
                firstReading: data.readings?.[0] || null,
                fullResponse: data
            }, null, 2));
        } catch (error) {
            setTestResults(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            setIsLoading(false);
        }
    };

    const verifyApiKey = async () => {
        setIsLoading(true);
        setKeyStatus(null);

        try {
            const response = await fetch('/api/perplexity/verify-key');
            const data = await response.json();

            setKeyStatus({
                verified: data.keyInEnvironment && data.validFormat && (data.apiTest?.ok === true),
                details: data
            });

            setTestResults(JSON.stringify(data, null, 2));
        } catch (error) {
            setKeyStatus({
                verified: false,
                details: { error: error instanceof Error ? error.message : 'Unknown error' }
            });
            setTestResults(`Error verifying API key: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="container mx-auto p-4">
            <h1 className="text-2xl font-bold mb-4">Perplexity API Test</h1>

            <div className="mb-6 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
                <h2 className="text-xl font-semibold mb-2">API Key Verification</h2>
                <p className="mb-4 text-sm">Verify if your Perplexity API key is correctly configured and working.</p>

                <div className="flex items-center space-x-4">
                    <Button
                        onClick={verifyApiKey}
                        disabled={isLoading}
                        variant="default"
                    >
                        {isLoading ? 'Verifying...' : 'Verify API Key'}
                    </Button>

                    {keyStatus && (
                        <div className={`flex items-center space-x-2 px-4 py-2 rounded-md ${keyStatus.verified ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'}`}>
                            <span className={`h-3 w-3 rounded-full ${keyStatus.verified ? 'bg-green-500' : 'bg-red-500'}`}></span>
                            <span>{keyStatus.verified ? 'API Key Valid' : 'API Key Invalid'}</span>
                        </div>
                    )}
                </div>

                {keyStatus && !keyStatus.verified && keyStatus.details.recommendations && (
                    <div className="mt-4 p-3 bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 rounded-md">
                        <h3 className="font-medium mb-2">Recommendations:</h3>
                        <ul className="list-disc list-inside space-y-1">
                            {keyStatus.details.recommendations.map((rec: string, i: number) => (
                                <li key={i}>{rec}</li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>

            <div className="space-y-8">
                <div className="p-4 border rounded-md">
                    <h2 className="text-xl font-semibold mb-2">Basic API Test</h2>
                    <p className="mb-4 text-sm">This will test if the Perplexity API key is valid with a simple request.</p>
                    <Button
                        onClick={runBasicTest}
                        disabled={isLoading}
                    >
                        {isLoading ? 'Testing...' : 'Run Basic Test'}
                    </Button>
                </div>

                <div className="p-4 border rounded-md">
                    <h2 className="text-xl font-semibold mb-2">Topic Recommendations Test</h2>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">Topic:</label>
                            <input
                                type="text"
                                value={testTopic}
                                onChange={(e) => setTestTopic(e.target.value)}
                                className="w-full p-2 border rounded-md"
                                placeholder="Enter a test topic"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1">Expert Type:</label>
                            <div className="flex space-x-4">
                                <label className="flex items-center">
                                    <input
                                        type="radio"
                                        checked={expertType === 'ai'}
                                        onChange={() => setExpertType('ai')}
                                        className="mr-2"
                                    />
                                    AI Expert
                                </label>
                                <label className="flex items-center">
                                    <input
                                        type="radio"
                                        checked={expertType === 'historical'}
                                        onChange={() => setExpertType('historical')}
                                        className="mr-2"
                                    />
                                    Historical Figure
                                </label>
                            </div>
                        </div>

                        <Button
                            onClick={runTopicTest}
                            disabled={isLoading || !testTopic.trim()}
                        >
                            {isLoading ? 'Testing...' : 'Run Topic Test'}
                        </Button>
                    </div>
                </div>

                <div className="p-4 border rounded-md">
                    <h2 className="text-xl font-semibold mb-2">Test Results</h2>
                    <pre className="bg-gray-800 text-gray-100 p-4 rounded-md overflow-auto max-h-96">
                        {testResults}
                    </pre>
                </div>
            </div>
        </div>
    );
} 