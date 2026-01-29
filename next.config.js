/** @type {import('next').NextConfig} */
const path = require('path');

const nextConfig = {
    eslint: {
        ignoreDuringBuilds: true,
    },
    typescript: {
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

    // Configure headers for API routes
    async headers() {
        return [
            {
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

    reactStrictMode: false,

    // Webpack config
    webpack: (config) => {
        config.resolve.modules.push(path.resolve('./src'));
        config.resolve.alias = {
            ...config.resolve.alias,
            '@': path.join(__dirname, 'src'),
            '@components': path.join(__dirname, 'src', 'components'),
            '@lib': path.join(__dirname, 'src', 'lib'),
        };
        return config;
    },
};

module.exports = nextConfig; 