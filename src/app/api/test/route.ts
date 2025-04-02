import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
    console.log('GET /api/test called');
    return NextResponse.json({
        status: 'success',
        message: 'Test API GET is working',
        timestamp: new Date().toISOString()
    });
}

export async function POST(request: NextRequest) {
    console.log('POST /api/test called');
    return NextResponse.json({
        status: 'success',
        message: 'Test API POST is working',
        timestamp: new Date().toISOString()
    });
} 