import type { NextApiRequest, NextApiResponse } from 'next';

type ResponseData = {
    message: string;
    timestamp: string;
}

export default function handler(
    req: NextApiRequest,
    res: NextApiResponse<ResponseData>
) {
    // Log the request
    console.log('Legacy Debate API called with method:', req.method);

    // Return a simple response
    res.status(200).json({
        message: 'Legacy Debate API is working',
        timestamp: new Date().toISOString()
    });
} 