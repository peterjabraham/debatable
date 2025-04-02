/**
 * Document Analysis API Routes
 * 
 * Handles PDF uploads and topic extraction.
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const { extractTextFromBuffer } = require('../services/pdf-extractor');
const { extractTopicsFromText } = require('../services/document-analyzer');

// Whitelist of allowed file types
const ALLOWED_MIME_TYPES = [
    'application/pdf',
    'application/x-pdf',
];

// Size limit for uploaded files (10 MB)
const MAX_FILE_SIZE = 10 * 1024 * 1024;

/**
 * POST /api/content/document
 * 
 * Processes uploaded PDF files and extracts debate topics.
 */
router.post('/document', async (req, res) => {
    try {
        // Check if file was uploaded
        if (!req.files || !req.files.file) {
            return res.status(400).json({
                error: 'No file uploaded',
                status: 'error'
            });
        }

        const file = req.files.file;

        // Check file size
        if (file.size > MAX_FILE_SIZE) {
            return res.status(400).json({
                error: 'File size exceeds the maximum limit (10 MB)',
                status: 'error'
            });
        }

        // Check file type
        if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
            return res.status(400).json({
                error: 'Invalid file type. Only PDF files are allowed.',
                status: 'error'
            });
        }

        console.log(`Processing document: ${file.name} (${file.size} bytes)`);

        // Extract text from the PDF
        const text = await extractTextFromBuffer(file.data);

        if (!text || text.trim().length === 0) {
            return res.status(400).json({
                error: 'Could not extract text from the PDF file',
                status: 'error'
            });
        }

        console.log(`Extracted text length: ${text.length} characters`);

        // Extract topics from the text
        const result = await extractTopicsFromText(text);

        // Return the extracted topics
        return res.json({
            status: 'success',
            topics: result.topics,
            textLength: text.length,
            fileName: file.name
        });

    } catch (error) {
        console.error('Error processing document:', error);

        return res.status(500).json({
            error: 'Failed to process document',
            message: error.message,
            status: 'error'
        });
    }
});

/**
 * POST /api/content/analyze
 * 
 * Alternative endpoint for document analysis.
 * Behaves identically to /document for API compatibility.
 */
router.post('/analyze', async (req, res) => {
    try {
        // Forward to the document endpoint
        const documentHandler = router.stack.find(layer =>
            layer.route && layer.route.path === '/document' && layer.route.methods.post);

        if (documentHandler && documentHandler.handle) {
            return documentHandler.handle(req, res);
        } else {
            // Fallback if route handler can't be found
            return res.status(500).json({
                error: 'Internal server error',
                status: 'error'
            });
        }
    } catch (error) {
        console.error('Error forwarding to document endpoint:', error);

        return res.status(500).json({
            error: 'Failed to process document',
            message: error.message,
            status: 'error'
        });
    }
});

module.exports = router; 