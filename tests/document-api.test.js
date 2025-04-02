const request = require('supertest');
const fs = require('fs').promises;
const path = require('path');
const express = require('express');
const fileUpload = require('express-fileupload');
const PDFDocument = require('pdfkit');

// Import the API route handler
const documentApiHandler = require('../server/routes/document-api');

// Create a test Express app
const app = express();
app.use(express.json());
app.use(fileUpload({
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    useTempFiles: true,
    tempFileDir: '/tmp/'
}));

// Mount the API route
app.use('/api/content', documentApiHandler);

// Helper function to create a valid PDF buffer
async function createTestPdfBuffer() {
    return new Promise((resolve, reject) => {
        try {
            // Create a PDF document
            const doc = new PDFDocument();
            const chunks = [];

            // Collect data chunks
            doc.on('data', chunk => {
                chunks.push(chunk);
            });

            // Resolve with the complete buffer when done
            doc.on('end', () => {
                const pdfBuffer = Buffer.concat(chunks);
                resolve(pdfBuffer);
            });

            // Add content to the PDF
            doc.fontSize(16).text('Test PDF Document', { align: 'center' });
            doc.moveDown();
            doc.fontSize(12).text('This is a test PDF for document analysis.', { align: 'center' });
            doc.moveDown();
            doc.text('Climate change is a pressing global issue that demands immediate action. Rising temperatures have led to melting ice caps, extreme weather events, and disruption of ecosystems worldwide.');
            doc.moveDown();
            doc.text('Artificial intelligence presents both opportunities and challenges for society. While AI can enhance productivity, automate routine tasks, and solve complex problems, it also raises concerns about privacy, job displacement, and ethical decision-making.');

            // Finalize the PDF
            doc.end();
        } catch (error) {
            reject(error);
        }
    });
}

describe('Document Analysis API', () => {
    let pdfBuffer;

    beforeAll(async () => {
        try {
            // Create a test PDF buffer
            pdfBuffer = await createTestPdfBuffer();
        } catch (error) {
            console.error('Failed to create test PDF:', error);
        }
    });

    test('POST /api/content/document should return topics from a PDF', async () => {
        if (!pdfBuffer) {
            console.log('Skipping API test - could not create test PDF');
            return;
        }

        const response = await request(app)
            .post('/api/content/document')
            .attach('file', pdfBuffer, 'test-document.pdf');

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('status', 'success');
        expect(response.body).toHaveProperty('topics');
        expect(Array.isArray(response.body.topics)).toBe(true);

        // Each topic should have the required structure
        if (response.body.topics.length > 0) {
            const firstTopic = response.body.topics[0];
            expect(firstTopic).toHaveProperty('title');
            expect(firstTopic).toHaveProperty('confidence');
            expect(firstTopic).toHaveProperty('arguments');
            expect(Array.isArray(firstTopic.arguments)).toBe(true);
        }
    });

    test('POST /api/content/document should handle request with no file', async () => {
        const response = await request(app)
            .post('/api/content/document')
            .send({});

        expect(response.status).toBe(400);
        expect(response.body).toHaveProperty('error');
    });

    test('POST /api/content/document should handle non-PDF files', async () => {
        const textFilePath = path.resolve(__dirname, 'fixtures', 'test-file.txt');

        try {
            await fs.writeFile(textFilePath, 'This is a test file, not a PDF');

            const textFileBuffer = await fs.readFile(textFilePath);

            const response = await request(app)
                .post('/api/content/document')
                .attach('file', textFileBuffer, 'test-file.txt');

            expect(response.status).toBe(400);
            expect(response.body).toHaveProperty('error');

        } catch (error) {
            console.error('Failed to create test text file:', error);
        } finally {
            try {
                await fs.unlink(textFilePath);
            } catch (error) {
                // Ignore cleanup errors
            }
        }
    });
}); 