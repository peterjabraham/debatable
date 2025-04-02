import { NextRequest, NextResponse } from 'next/server';

// Basic GET handler
export async function GET(request: NextRequest) {
    console.log('Debate API GET called - alternative file');

    return NextResponse.json({
        status: 'success',
        message: 'Debate API is working (alternative file)',
        timestamp: new Date().toISOString()
    });
}

// Basic POST handler
export async function POST(request: NextRequest) {
    console.log('Debate API POST called - alternative file');

    try {
        const body = await request.json();
        return NextResponse.json({
            status: 'success',
            message: 'Debate API received request (alternative file)',
            receivedData: body,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error in alternative debate API:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        );
    }
} 