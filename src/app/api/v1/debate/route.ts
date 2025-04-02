import { NextResponse } from 'next/server';

// Simple GET handler with no dependencies
export async function GET() {
    console.log('V1 Debate API GET called');

    return NextResponse.json({
        status: 'success',
        message: 'V1 Debate API is working',
        timestamp: new Date().toISOString()
    });
}

// Simple POST handler with no dependencies
export async function POST() {
    console.log('V1 Debate API POST called');

    return NextResponse.json({
        status: 'success',
        message: 'V1 Debate API POST is working',
        timestamp: new Date().toISOString()
    });
} 