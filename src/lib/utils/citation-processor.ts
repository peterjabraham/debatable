import { Citation } from '@/types/message';
import { SourceReference } from '@/types/expert';
import { v4 as uuidv4 } from 'uuid';

/**
 * Process citation markers in text and extract citations
 * Citation format: [citation:1], [citation:2], etc.
 */
export function processCitationMarkers(
    text: string,
    sourceReferences: SourceReference[]
): { processedText: string; citations: Citation[] } {
    const citations: Citation[] = [];

    // Regular expression to find citation markers like [Citation: 1]
    const citationRegex = /\[Citation:\s*(\d+)\]/g;

    // Replace citation markers with superscript numbers and collect citation data
    let match;
    let processedText = text;

    while ((match = citationRegex.exec(text)) !== null) {
        const fullMatch = match[0];
        const referenceNumber = parseInt(match[1], 10);

        // Find the corresponding source reference
        const sourceReference = sourceReferences[referenceNumber - 1];

        if (sourceReference) {
            const startIndex = match.index;
            const endIndex = startIndex + fullMatch.length;

            const citation: Citation = {
                id: uuidv4(),
                referenceId: sourceReference.id,
                text: `${sourceReference.title} - ${sourceReference.author || 'Unknown'} (${sourceReference.year || 'Unknown'})`,
                startIndex,
                endIndex
            };

            citations.push(citation);

            // Replace the citation marker with a superscript number
            const superscriptNumber = `<sup>[${referenceNumber}]</sup>`;
            processedText = processedText.replace(fullMatch, superscriptNumber);
        }
    }

    return { processedText, citations };
}

/**
 * Enhances the system prompt with instructions for using citations
 */
export function enhancePromptWithCitationInstructions(systemContent: string): string {
    const citationInstructions = `
When referencing information from the provided sources, use citation markers in the format [citation:N] where N is the source number.
For example: "According to the research [citation:1], AI integration leads to improved customer engagement."
Make sure to cite specific claims and statistics from the sources to support your arguments.
`;

    return `${systemContent}\n\n${citationInstructions.trim()}`;
} 