import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
    console.log('GET /api/debate/test called');
    return NextResponse.json({
        status: 'success',
        message: 'Debate test API GET is working',
        timestamp: new Date().toISOString()
    });
}

export async function POST(request: NextRequest) {
    console.log('POST /api/debate/test called');
    return NextResponse.json({
        status: 'success',
        message: 'Debate test API POST is working',
        timestamp: new Date().toISOString()
    });
} 