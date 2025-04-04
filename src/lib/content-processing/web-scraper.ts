// web-scraper.ts - Basic web content extractor
import axios from 'axios';
import * as cheerio from 'cheerio';

/**
 * Extracts text content from a given URL by scraping the webpage
 * 
 * @param url The URL to scrape content from
 * @returns The extracted text content from the webpage
 */
export async function extractTextFromUrl(url: string): Promise<string> {
    try {
        // Fetch the HTML content from the URL
        const response = await axios.get(url);
        const html = response.data;

        // Load HTML into cheerio
        const $ = cheerio.load(html);

        // Remove script and style elements
        $('script, style, nav, footer, header, [role="banner"], [role="navigation"]').remove();

        // Extract text from the body, preserving paragraph structure
        let text = '';

        // Extract article/main content if available
        const mainContent = $('article, [role="main"], main, .content, #content, .post, .article');

        if (mainContent.length > 0) {
            // If we found content containers, use them
            mainContent.each((_, element) => {
                $(element).find('p, h1, h2, h3, h4, h5, h6, li').each((_, el) => {
                    const content = $(el).text().trim();
                    if (content) {
                        text += content + '\n\n';
                    }
                });
            });
        } else {
            // Fallback: get all paragraphs and headings
            $('p, h1, h2, h3, h4, h5, h6, li').each((_, el) => {
                const content = $(el).text().trim();
                if (content) {
                    text += content + '\n\n';
                }
            });
        }

        // Clean up the text
        return text
            .replace(/\s+/g, ' ') // Replace multiple spaces with single space
            .replace(/\n\s*\n/g, '\n\n') // Replace multiple newlines with double newlines
            .trim();

    } catch (error) {
        console.error('Error extracting text from URL:', error);
        throw new Error(`Failed to extract text from URL: ${error.message}`);
    }
} 