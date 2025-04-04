/** @type {import('next').NextConfig} */
const { checkApiServer } = require('./src/lib/server-check');
const fs = require('fs');
const path = require('path');

// Variable to cache server availability check result
let isApiServerAvailable = null;

// IMPORTANT: Only set these values if they haven't been set in .env.local
if (!process.env.API_SERVER_ENABLED) process.env.API_SERVER_ENABLED = 'false';
if (!process.env.MOCK_API) process.env.MOCK_API = 'false';
if (!process.env.USE_MOCK_DATA) process.env.USE_MOCK_DATA = 'false';
if (!process.env.NEXT_PUBLIC_USE_REAL_API) process.env.NEXT_PUBLIC_USE_REAL_API = 'true';
if (!process.env.DISABLE_API_TESTING) process.env.DISABLE_API_TESTING = 'false';

// Check if API server should be enabled from environment
const apiServerEnabled = process.env.API_SERVER_ENABLED === 'true';

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
        USE_MOCK_DATA: process.env.USE_MOCK_DATA || 'false',
        NEXT_PUBLIC_USE_REAL_API: process.env.NEXT_PUBLIC_USE_REAL_API || 'true',
        DISABLE_API_TESTING: process.env.DISABLE_API_TESTING || 'false',
        API_SERVER_ENABLED: process.env.API_SERVER_ENABLED || 'false',
        MOCK_API: process.env.MOCK_API || 'false',
        MVP_CONFIG_API_SERVER_AVAILABLE: process.env.MVP_CONFIG_API_SERVER_AVAILABLE || 'false'
    },

    // Redirect API calls to our dedicated Express server
    async rewrites() {
        if (!apiServerEnabled) {
            console.log("API server explicitly disabled - using built-in Next.js API routes");

            // Update global config to reflect server unavailability
            try {
                // Use value from environment if available
                global.API_SERVER_AVAILABLE = process.env.MVP_CONFIG_API_SERVER_AVAILABLE === 'true';

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
        }

        // Other rewrites would go here if API server enabled
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
    }
};

// Enable module resolution debugging in development
if (process.env.NODE_ENV === 'development') {
    // Set environment variable to help debug module resolution
    process.env.NODE_OPTIONS = (process.env.NODE_OPTIONS || '') + ' --trace-warnings';
}

module.exports = nextConfig; 