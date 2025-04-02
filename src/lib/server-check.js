/**
 * Utility to check if the API server is running
 */
const net = require('net');

/**
 * Tests if a server is available at the given host and port
 * @param {string} host - The host to check
 * @param {number} port - The port to check
 * @param {number} timeout - Timeout in milliseconds
 * @returns {Promise<boolean>} True if the server is available, false otherwise
 */
function isServerAvailable(host, port, timeout = 1000) {
    return new Promise((resolve) => {
        const socket = new net.Socket();
        let status = false;
        let error = null;

        // Set timeout
        socket.setTimeout(timeout);

        // Handle connection success
        socket.on('connect', () => {
            status = true;
            socket.destroy();
        });

        // Handle errors
        socket.on('error', (err) => {
            error = err;
            socket.destroy();
        });

        // Handle timeout
        socket.on('timeout', () => {
            socket.destroy();
        });

        // Handle close
        socket.on('close', () => {
            resolve(status);
        });

        // Attempt connection
        socket.connect(port, host);
    });
}

/**
 * Checks if the API server is available
 * @returns {Promise<boolean>} True if the API server is available
 */
async function checkApiServer(apiUrl) {
    if (!apiUrl) {
        return false;
    }

    // Parse URL to get host and port
    const url = new URL(apiUrl);
    const host = url.hostname;
    const port = url.port || (url.protocol === 'https:' ? 443 : 80);

    try {
        console.log(`Checking API server availability at ${host}:${port}...`);
        const isAvailable = await isServerAvailable(host, port);
        console.log(`API server at ${host}:${port} is ${isAvailable ? 'available' : 'not available'}`);
        return isAvailable;
    } catch (error) {
        console.error('Error checking API server:', error);
        return false;
    }
}

module.exports = {
    isServerAvailable,
    checkApiServer
}; 