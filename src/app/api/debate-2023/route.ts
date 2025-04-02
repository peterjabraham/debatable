import { NextRequest, NextResponse } from 'next/server';

// Basic GET handler
export async function GET(request: NextRequest) {
    console.log('Debate-2023 API GET called');

    return NextResponse.json({
        status: 'success',
        message: 'Debate-2023 API is working',
        timestamp: new Date().toISOString()
    });
}

// Basic POST handler
export async function POST(request: NextRequest) {
    console.log('Debate-2023 API POST called');

    try {
        const body = await request.json();
        return NextResponse.json({
            status: 'success',
            message: 'Debate-2023 API received request',
            receivedData: body,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error in Debate-2023 API:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        );
    }
} 