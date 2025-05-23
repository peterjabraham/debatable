/** @type {import('next').NextConfig} */
const { checkApiServer } = require('./src/lib/server-check');
const fs = require('fs');
const path = require('path');

// Variable to cache server availability check result
let isApiServerAvailable = null;

// IMPORTANT: Only set these values if they haven't been set in .env.local
if (!process.env.NEXT_PUBLIC_USE_REAL_API) process.env.NEXT_PUBLIC_USE_REAL_API = 'true';

const nextConfig = {
    eslint: {
        // Don't fail the build for ESLint errors in production
        ignoreDuringBuilds: true,
    },
    typescript: {
        // Don't fail the build for TypeScript errors in production
        ignoreBuildErrors: true,
    },
    images: {
        remotePatterns: [
            {
                protocol: 'https',
                hostname: 'avatars.githubusercontent.com',
            },
            {
                protocol: 'https',
                hostname: 'lh3.googleusercontent.com',
            },
            {
                protocol: 'https',
                hostname: '*.githubusercontent.com',
            },
            {
                protocol: 'https',
                hostname: 'images.unsplash.com',
            }
        ],
    },
    experimental: {
        mdxRs: true,
    },

    // Environment variables to be available at build time
    env: {
        // Use values from .env.local or fallback to defaults
        NEXT_PUBLIC_USE_REAL_API: process.env.NEXT_PUBLIC_USE_REAL_API || 'true',
    },

    // Configure headers for API routes to handle CORS properly
    async headers() {
        return [
            {
                // Apply these headers to all API routes
                source: '/api/:path*',
                headers: [
                    { key: 'Access-Control-Allow-Credentials', value: 'true' },
                    { key: 'Access-Control-Allow-Origin', value: '*' },
                    { key: 'Access-Control-Allow-Methods', value: 'GET,DELETE,PATCH,POST,PUT,OPTIONS' },
                    { key: 'Access-Control-Allow-Headers', value: 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version' },
                ],
            },
        ];
    },

    // Redirect API calls to our dedicated Express server
    async rewrites() {
        console.log("Using built-in Next.js API routes - rewrites disabled");

        // Update global config to reflect server unavailability
        try {
            // Simplify: Assume API server is not available as we removed the check
            global.API_SERVER_AVAILABLE = false; // Directly set to false

            // Create a flag file to communicate to client-side code
            const publicFlagPath = path.join(__dirname, 'public', 'api-status.json');
            fs.writeFileSync(
                publicFlagPath,
                JSON.stringify({
                    apiServerAvailable: global.API_SERVER_AVAILABLE,
                    timestamp: new Date().toISOString()
                }),
                'utf8'
            );
        } catch (e) {
            console.error("Error setting API availability flags:", e);
        }

        // Force empty rewrites - no proxying
        return [];
    },

    // Disable React StrictMode in development to prevent double rendering
    reactStrictMode: false,

    // Configure Webpack to handle imports better
    webpack: (config, { buildId, dev, isServer, defaultLoaders, webpack }) => {
        // Improve module resolution
        config.resolve.modules.push(path.resolve('./src'));

        // Add alias for component paths
        config.resolve.alias = {
            ...config.resolve.alias,
            '@': path.join(__dirname, 'src'),
            '@components': path.join(__dirname, 'src', 'components'),
            '@lib': path.join(__dirname, 'src', 'lib'),
        };

        return config;
    },

    // Enable better error logging for API routes
    onDemandEntries: {
        // Period (in ms) where the server will keep pages in the buffer
        maxInactiveAge: 25 * 1000,
        // Number of pages that should be kept simultaneously without being disposed
        pagesBufferLength: 2,
    }
};

// Enable module resolution debugging in development
if (process.env.NODE_ENV === 'development') {
    // Set environment variable to help debug module resolution
    process.env.NODE_OPTIONS = (process.env.NODE_OPTIONS || '') + ' --trace-warnings';
}

module.exports = nextConfig; 