import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { selectExperts } from '../../../lib/ai/expert-selector';

// ULTRA QUIET MVP MODE - Completely disabled API routing
// This route handler is SILENT and does nothing but return a minimal response
// All actual API calls should use the Express server directly

// Simple stub response for all methods
const getSharedResponse = () => {
    return NextResponse.json(
        {
            status: 'success',
            message: 'API DISABLED IN MVP MODE - Use Express API server directly',
            apiUrl: process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3030',
            timestamp: new Date().toISOString(),
        },
        {
            status: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Cache-Control': 'no-store, max-age=0',
            },
        }
    );
};

// Silent GET handler - no logging
export async function GET() {
    return getSharedResponse();
}

// Silent POST handler - no logging
export async function POST(request: NextRequest) {
    return getSharedResponse();
}

// Silent OPTIONS handler - no logging
export async function OPTIONS() {
    return new NextResponse(null, {
        status: 204,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        }
    });
} 