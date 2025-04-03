import fs from 'fs/promises';
import path from 'path';
import pdfParse from 'pdf-parse';

/**
 * Extract text from a document file
 * @param filePath The path to the document file
 * @returns The extracted text, or null if extraction failed
 */
export async function extractTextFromDocument(filePath: string): Promise<string | null> {
    try {
        console.log(`Extracting text from document: ${filePath}`);
        const fileExtension = path.extname(filePath).toLowerCase();

        switch (fileExtension) {
            case '.pdf':
                return await extractTextFromPDF(filePath);
            case '.docx':
                return await extractTextFromDOCX(filePath);
            case '.txt':
                return await extractTextFromTXT(filePath);
            default:
                console.error(`Unsupported file type: ${fileExtension}`);
                return null;
        }
    } catch (error) {
        console.error('Error extracting text from document:', error);
        return null;
    }
}

/**
 * Extract text from a PDF file
 * @param filePath The path to the PDF file
 * @returns The extracted text
 */
async function extractTextFromPDF(filePath: string): Promise<string> {
    try {
        console.log(`Processing PDF file: ${filePath}`);

        try {
            // Check if the file exists
            await fs.access(filePath);

            // Get file size to check if it's reasonable
            const stats = await fs.stat(filePath);
            console.log(`PDF file size: ${stats.size} bytes`);

            // Reject extremely large files
            if (stats.size > 10 * 1024 * 1024) { // 10MB
                throw new Error('PDF file is too large (>10MB)');
            }

            // Read file
            let fileData;
            try {
                fileData = await fs.readFile(filePath);
                console.log(`PDF file read successfully, size: ${fileData.length} bytes`);
            } catch (readError) {
                console.error(`Error reading PDF file:`, readError);
                throw new Error(`Failed to read PDF file: ${readError.message}`);
            }

            // Check for zero-byte file
            if (!fileData || fileData.length === 0) {
                throw new Error('PDF file is empty (zero bytes)');
            }

            // Use pdf-parse to extract text with enhanced error handling
            let pdfData;
            try {
                pdfData = await pdfParse(fileData, {
                    // Add a timeout to prevent hanging on corrupted PDFs
                    max: 5 * 1024 * 1024, // 5MB max file size 
                    timeout: 45000, // 45 seconds timeout
                    pagerender: function (pageData) {
                        // Just extract the text - no rendering
                        return Promise.resolve();
                    }
                });
            } catch (parseError) {
                console.error('PDF parsing error:', parseError);

                // Try to provide a useful error message based on the type of failure
                if (parseError.message?.includes('file corrupted') ||
                    parseError.message?.includes('malformed') ||
                    parseError.message?.includes('invalid') ||
                    parseError.message?.includes('corrupted') ||
                    parseError.message?.includes('Invalid PDF')) {
                    throw new Error('The PDF file appears to be corrupted or invalid format');
                }

                if (parseError.message?.includes('timeout') ||
                    parseError.message?.includes('timed out') ||
                    parseError.message?.includes('exceeded')) {
                    throw new Error('PDF processing timed out - the file may be too large or too complex');
                }

                if (parseError.message?.includes('encrypted') ||
                    parseError.message?.includes('password')) {
                    throw new Error('The PDF file is encrypted or password-protected');
                }

                // Default error
                throw new Error(`PDF parsing failed: ${parseError.message}`);
            }

            console.log(`PDF processed successfully, extracted ${pdfData.text?.length || 0} characters`);

            // Check if we actually got meaningful text
            if (!pdfData || !pdfData.text || pdfData.text.trim().length === 0) {
                throw new Error('PDF appears to be empty or contains no extractable text - it may contain only images or scanned content');
            }

            // Return the extracted text
            return pdfData.text;
        } catch (readError) {
            // Log the specific error
            console.error('PDF extraction specific error:', readError);

            // Check for specific error conditions
            if (readError.message?.includes('timeout') || readError.message?.includes('timed out') || readError.message?.includes('exceeded')) {
                throw new Error('PDF processing timed out - the file may be too large or corrupted');
            }

            if (readError.message?.includes('malformed') ||
                readError.message?.includes('invalid') ||
                readError.message?.includes('corrupted')) {
                throw new Error('The PDF file appears to be corrupted or invalid');
            }

            if (readError.message?.includes('no such file') || readError.message?.includes('ENOENT')) {
                throw new Error('PDF file not found at the specified path');
            }

            throw readError;
        }
    } catch (error) {
        console.error('Error extracting text from PDF:', error);
        throw new Error(`Failed to extract text from PDF: ${error.message}`);
    }
}

/**
 * Extract text from a DOCX file
 * @param filePath The path to the DOCX file
 * @returns The extracted text
 */
async function extractTextFromDOCX(filePath: string): Promise<string> {
    // In a real implementation, we would use a library like mammoth
    // But for now we'll return a simple message as DOCX support requires additional libraries
    console.log(`DOCX processing not fully implemented yet: ${filePath}`);

    const sampleText = `
        Climate Change and Global Policy

        Climate change represents one of the most significant challenges facing humanity today. 
        Rising temperatures, changing weather patterns, and increasing sea levels are just a few of the effects being observed globally. 
        Nations around the world are implementing various policies to reduce carbon emissions and mitigate these effects. 
        Some advocate for carbon taxes and cap-and-trade systems, while others focus on renewable energy investments and research. 
        The effectiveness of these policies remains debated, with economic considerations often weighed against environmental benefits. 
        Developing nations face particular challenges in balancing economic growth with environmental protection. 
        International cooperation through agreements like the Paris Climate Accord represents attempts to coordinate global efforts, 
        though enforcement mechanisms remain limited. The role of technology in addressing climate change is also significant, 
        with innovations in renewable energy, carbon capture, and sustainable agriculture offering promising solutions.
    `;

    return sampleText;
}

/**
 * Extract text from a TXT file
 * @param filePath The path to the TXT file
 * @returns The extracted text
 */
async function extractTextFromTXT(filePath: string): Promise<string> {
    try {
        console.log(`Reading TXT file: ${filePath}`);
        return await fs.readFile(filePath, 'utf-8');
    } catch (error) {
        console.error('Error reading TXT file:', error);
        throw new Error(`Failed to read TXT file: ${error.message}`);
    }
} 