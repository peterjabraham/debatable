'use client';

import { useState, useEffect } from 'react';

export default function ApiTestPage() {
    const [results, setResults] = useState<Record<string, any>>({});
    const [loading, setLoading] = useState<Record<string, boolean>>({});
    const [error, setError] = useState<Record<string, string>>({});

    const testEndpoints = [
        '/api/debate?action=test',
        '/api/climate-debate?action=test',
        '/api/debate-2023?action=test',
        '/api/debate/test?action=test'
    ];

    async function testEndpoint(endpoint: string) {
        setLoading(prev => ({ ...prev, [endpoint]: true }));
        setError(prev => ({ ...prev, [endpoint]: '' }));

        try {
            const response = await fetch(endpoint);
            const data = await response.json();

            setResults(prev => ({
                ...prev,
                [endpoint]: {
                    status: response.status,
                    data
                }
            }));
        } catch (err) {
            setError(prev => ({
                ...prev,
                [endpoint]: err instanceof Error ? err.message : 'Unknown error'
            }));
        } finally {
            setLoading(prev => ({ ...prev, [endpoint]: false }));
        }
    }

    function testAllEndpoints() {
        testEndpoints.forEach(endpoint => {
            testEndpoint(endpoint);
        });
    }

    return (
        <div className="p-8 max-w-4xl mx-auto">
            <h1 className="text-3xl font-bold mb-6">API Endpoint Test</h1>

            <div className="mb-6">
                <button
                    onClick={testAllEndpoints}
                    className="bg-blue-500 text-white px-4 py-2 rounded"
                >
                    Test All Endpoints
                </button>
            </div>

            <div className="space-y-6">
                {testEndpoints.map(endpoint => (
                    <div key={endpoint} className="border p-4 rounded">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-semibold">{endpoint}</h2>
                            <button
                                onClick={() => testEndpoint(endpoint)}
                                className="bg-green-500 text-white px-3 py-1 rounded text-sm"
                            >
                                Test Endpoint
                            </button>
                        </div>

                        {loading[endpoint] && <p>Loading...</p>}

                        {error[endpoint] && (
                            <div className="bg-red-100 border border-red-400 text-red-700 p-3 rounded">
                                {error[endpoint]}
                            </div>
                        )}

                        {results[endpoint] && (
                            <div>
                                <p>Status: {results[endpoint].status}</p>
                                <pre className="bg-gray-100 p-3 rounded mt-2 overflow-auto max-h-60">
                                    {JSON.stringify(results[endpoint].data, null, 2)}
                                </pre>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
} 