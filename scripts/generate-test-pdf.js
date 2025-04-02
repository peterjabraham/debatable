/**
 * Script to generate a test PDF file for document analysis testing
 * 
 * This script creates a simple PDF containing test content for our document analyzer tests.
 * It uses PDFKit, a simple PDF generation library for Node.js.
 */

const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

// Configure paths
const textFilePath = path.resolve(__dirname, '../tests/fixtures/test-content.txt');
const pdfFilePath = path.resolve(__dirname, '../tests/fixtures/test-document.pdf');

// Create a function to generate the PDF
async function generateTestPDF() {
    try {
        // Check if text file exists
        if (!fs.existsSync(textFilePath)) {
            console.error(`Text file not found: ${textFilePath}`);
            process.exit(1);
        }

        // Read the text content
        const textContent = fs.readFileSync(textFilePath, 'utf8');

        // Create a PDF document
        const doc = new PDFDocument();

        // Pipe output to a file
        doc.pipe(fs.createWriteStream(pdfFilePath));

        // Add a title
        doc.fontSize(20).text('Great Debate Test Document', {
            align: 'center'
        });

        // Add a subtitle
        doc.moveDown();
        doc.fontSize(12).text('Sample content for document analysis testing', {
            align: 'center'
        });

        // Add the content
        doc.moveDown(2);
        doc.fontSize(11).text(textContent, {
            align: 'justify',
            paragraphGap: 15
        });

        // Finalize the PDF
        doc.end();

        console.log(`Test PDF created successfully: ${pdfFilePath}`);
    } catch (error) {
        console.error('Error generating test PDF:', error);
        process.exit(1);
    }
}

// Execute the function
generateTestPDF(); 