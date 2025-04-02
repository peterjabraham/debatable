import { NextRequest, NextResponse } from 'next/server';
import { getAggregatedMetrics } from '@/lib/monitoring/api-metrics';
import { vercelAPI } from '@/lib/vercel/api';

// This API key is used to secure the monitoring endpoints
// In a real app, you'd use a more secure authentication mechanism
const MONITORING_API_KEY = process.env.MONITORING_API_KEY || 'test-monitoring-key';

// Mock API metrics for when we don't have any real metrics yet
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
    }
];

export async function GET(req: NextRequest) {
    console.log('API metrics request received');

    // Check authentication
    const apiKey = req.headers.get('x-api-key');
    console.log('Received API key:', apiKey ? 'Present' : 'Missing');
    console.log('Expected API key:', MONITORING_API_KEY ? `${MONITORING_API_KEY.substring(0, 4)}...` : 'None configured');

    if (!apiKey || apiKey !== MONITORING_API_KEY) {
        console.error('API key authentication failed. Key mismatch.');
        return NextResponse.json(
            { error: 'Unauthorized' },
            { status: 401 }
        );
    }

    try {
        // Get metrics from local store
        const localMetrics = getAggregatedMetrics();
        console.log(`Found ${localMetrics.length} local metrics`);

        // If we don't have any local metrics, return mock data
        if (!localMetrics || localMetrics.length === 0) {
            console.log('No local metrics found, returning mock data');
            return NextResponse.json({ metrics: MOCK_API_METRICS });
        }

        return NextResponse.json({ metrics: localMetrics });
    } catch (error) {
        console.error('Error getting API metrics:', error);
        return NextResponse.json(
            { error: 'Failed to fetch API metrics', metrics: MOCK_API_METRICS },
            { status: 200 } // Still return 200 with mock data on error
        );
    }
} 