import { readFile } from 'fs/promises';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import {
    DocumentMetadata,
    DocumentParserOptions,
    DocumentParserResult,
    ParsedDocument,
    SupportedDocumentType,
} from '@/types/content-processing';

const DEFAULT_OPTIONS: DocumentParserOptions = {
    extractSections: true,
    maxSizeInMB: 10,
    preserveFormatting: true,
};

export class DocumentParser {
    private options: DocumentParserOptions;

    constructor(options: Partial<DocumentParserOptions> = {}) {
        this.options = { ...DEFAULT_OPTIONS, ...options };
    }

    async parseFile(filePath: string): Promise<DocumentParserResult> {
        try {
            const fileBuffer = await readFile(filePath);
            const fileType = this.getFileType(filePath);

            if (!this.validateFile(fileBuffer, fileType)) {
                return {
                    success: false,
                    error: 'File validation failed: File too large or unsupported type',
                };
            }

            const metadata = await this.extractMetadata(filePath, fileBuffer, fileType);
            const parsedContent = await this.parseContent(fileBuffer, fileType);

            const parsedDocument: ParsedDocument = {
                metadata,
                content: parsedContent.content,
                rawText: parsedContent.rawText,
                sections: parsedContent.sections,
            };

            return {
                success: true,
                parsedDocument,
            };
        } catch (error) {
            return {
                success: false,
                error: `Failed to parse document: ${error.message}`,
            };
        }
    }

    private getFileType(filePath: string): SupportedDocumentType {
        const extension = filePath.split('.').pop()?.toLowerCase();
        switch (extension) {
            case 'pdf':
                return 'pdf';
            case 'docx':
                return 'docx';
            case 'txt':
                return 'txt';
            default:
                throw new Error(`Unsupported file type: ${extension}`);
        }
    }

    private validateFile(buffer: Buffer, fileType: SupportedDocumentType): boolean {
        const fileSizeInMB = buffer.length / (1024 * 1024);
        return fileSizeInMB <= (this.options.maxSizeInMB || DEFAULT_OPTIONS.maxSizeInMB!);
    }

    private async extractMetadata(
        filePath: string,
        buffer: Buffer,
        fileType: SupportedDocumentType
    ): Promise<DocumentMetadata> {
        const stats = await readFile(filePath).then(buffer => ({
            size: buffer.length,
            // In a real implementation, we'd use proper file stats
            createdAt: new Date(),
            lastModified: new Date(),
        }));

        const metadata: DocumentMetadata = {
            fileName: filePath.split('/').pop() || '',
            fileType,
            fileSize: stats.size,
            createdAt: stats.createdAt,
            lastModified: stats.lastModified,
        };

        if (fileType === 'pdf') {
            const pdfData = await pdfParse(buffer);
            metadata.pageCount = pdfData.numpages;
        }

        return metadata;
    }

    private async parseContent(
        buffer: Buffer,
        fileType: SupportedDocumentType
    ): Promise<Omit<ParsedDocument, 'metadata'>> {
        switch (fileType) {
            case 'pdf':
                return this.parsePDF(buffer);
            case 'docx':
                return this.parseDocx(buffer);
            case 'txt':
                return this.parseTxt(buffer);
            default:
                throw new Error(`Unsupported file type: ${fileType}`);
        }
    }

    private async parsePDF(buffer: Buffer) {
        const pdfData = await pdfParse(buffer);
        const content = pdfData.text;

        let sections = [];
        if (this.options.extractSections) {
            // Basic section extraction based on line breaks and potential headers
            sections = content
                .split(/\n\s*\n/)
                .filter(section => section.trim().length > 0)
                .map((section, index) => ({
                    content: section.trim(),
                    pageNumber: Math.floor(index / 3) + 1, // Rough estimation
                }));
        }

        return {
            content: this.options.preserveFormatting ? content : content.replace(/\s+/g, ' ').trim(),
            rawText: content,
            sections,
        };
    }

    private async parseDocx(buffer: Buffer) {
        const result = await mammoth.extractRawText({ buffer });
        const content = result.value;

        let sections = [];
        if (this.options.extractSections) {
            // Extract sections based on headings or double line breaks
            sections = content
                .split(/\n\s*\n/)
                .filter(section => section.trim().length > 0)
                .map(section => ({
                    content: section.trim(),
                }));
        }

        return {
            content: this.options.preserveFormatting ? content : content.replace(/\s+/g, ' ').trim(),
            rawText: content,
            sections,
        };
    }

    private parseTxt(buffer: Buffer) {
        const content = buffer.toString('utf-8');

        let sections = [];
        if (this.options.extractSections) {
            // Simple section extraction based on double line breaks
            sections = content
                .split(/\n\s*\n/)
                .filter(section => section.trim().length > 0)
                .map(section => ({
                    content: section.trim(),
                }));
        }

        return {
            content: this.options.preserveFormatting ? content : content.replace(/\s+/g, ' ').trim(),
            rawText: content,
            sections,
        };
    }
} 