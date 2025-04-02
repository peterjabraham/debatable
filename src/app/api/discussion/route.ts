import { NextResponse } from 'next/server';

// Simple GET handler with no dependencies
export async function GET() {
    console.log('Discussion API GET called');

    return NextResponse.json({
        status: 'success',
        message: 'Discussion API is working',
        timestamp: new Date().toISOString()
    });
}

// Simple POST handler with no dependencies
export async function POST() {
    console.log('Discussion API POST called');

    return NextResponse.json({
        status: 'success',
        message: 'Discussion API POST is working',
        timestamp: new Date().toISOString()
    });
} 