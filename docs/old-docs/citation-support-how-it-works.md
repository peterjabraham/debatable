# Citation Support Implementation

## Overview

The citation support feature enhances the debate application by enabling experts to back their claims with verifiable sources. This document explains how citations are implemented, from knowledge retrieval to UI display.

## Architecture

The citation system uses a multi-stage approach:

1. **Knowledge Retrieval**: Background information and sources are gathered for each expert
2. **Citation Instruction**: The LLM is prompted to include citation markers in responses
3. **Citation Processing**: Response text is parsed to extract citation markers
4. **Source Linking**: Citations are linked to specific source references
5. **UI Rendering**: Citations are displayed in a collapsible footer under expert messages

## Key Components

### 1. Data Structures

```typescript
// Citation structure
export interface Citation {
  id: string;          // Citation identifier (e.g., "1", "2")
  source: SourceReference; // Reference to the source
  highlight?: string;  // Optional highlighted text that was cited
}

// Source reference structure
export interface SourceReference {
  title: string;
  url?: string;
  author?: string;
  publishDate?: string;
  excerpt?: string;
  relevance?: number; // 0-1 scale
}

// Extended Message interface
export interface Message {
  // Existing fields...
  citations?: Citation[];
  hasProcessedCitations?: boolean;
}

// Extended Expert interface
export interface Expert {
  // Existing fields...
  sourceReferences?: SourceReference[];
}
```

### 2. Utility Functions

#### Citation Processing

The `processCitationMarkers` function extracts citation markers from text and links them to source references:

```typescript
export function processCitationMarkers(
  text: string,
  sources: SourceReference[]
): {
  processedText: string;
  citations: Citation[];
} {
  // If no sources provided, return original text with empty citations
  if (!sources || sources.length === 0) {
    return {
      processedText: text,
      citations: []
    };
  }

  // Regex to find citation markers like [1], [2], etc.
  const citationRegex = /\[(\d+)\]/g;
  
  // Track all citations (avoid duplicates)
  const citationMap = new Map<string, SourceReference>();
  
  // Find all citation markers in the text
  let match;
  while ((match = citationRegex.exec(text)) !== null) {
    const id = match[1];
    const sourceIndex = parseInt(id, 10) - 1;
    
    // Only add citation if source exists at the given index
    if (sources[sourceIndex]) {
      citationMap.set(id, sources[sourceIndex]);
    }
  }
  
  // Convert the map to citations array
  const citations: Citation[] = [];
  citationMap.forEach((source, id) => {
    citations.push({
      id,
      source,
    });
  });
  
  return {
    processedText: text,
    citations,
  };
}
```

#### Prompt Enhancement

The system prompt is enhanced with citation instructions:

```typescript
export function enhancePromptWithCitationInstructions(systemPrompt: string): string {
  const citationInstructions = `
When stating facts or making claims, include citation markers in square brackets [1], [2], etc.
Each citation should reference a credible source from your knowledge base.
Place the citation marker immediately after the relevant claim.
Ensure each citation is relevant and correctly numbered starting from [1].
Only cite reliable sources that actually exist.`;

  return `${systemPrompt}\n\n${citationInstructions}`;
}
```

### 3. UI Components

The `CitationFooter` component displays citations in a collapsible section:

```tsx
export function CitationFooter({ citations, className }: CitationFooterProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // If no citations, don't render anything
  if (!citations || citations.length === 0) {
    return null;
  }

  return (
    <div className={cn("mt-2 pt-2 border-t border-gray-200 dark:border-gray-700", className)}>
      <Button
        variant="ghost"
        size="sm"
        className="flex items-center gap-1 mb-1 text-xs font-medium text-muted-foreground hover:text-foreground"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {isExpanded ? (
          <>
            <ChevronUp className="h-3 w-3" />
            Hide Sources ({citations.length})
          </>
        ) : (
          <>
            <ChevronDown className="h-3 w-3" />
            Show Sources ({citations.length})
          </>
        )}
      </Button>
      
      {isExpanded && (
        <div className="space-y-2 pl-2 text-xs">
          {citations.map((citation) => (
            <div key={citation.id} className="flex flex-col">
              <div className="flex items-baseline">
                <span className="font-semibold mr-1">[{citation.id}]</span>
                <span className="font-medium">{citation.source.title}</span>
              </div>
              
              <div className="text-muted-foreground text-xs ml-4 flex flex-col">
                {/* Source details... */}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

## Process Flow

### 1. Expert Knowledge Retrieval

When a debate is initiated, we retrieve background knowledge for each expert:

```typescript
async function retrieveBackgroundKnowledgeForExperts(debateId: string, experts: Expert[], topic: string) {
  // For each expert:
  // 1. Retrieve background knowledge
  const backgroundKnowledge = await retrieveBackgroundKnowledge(expert, topic);
  
  // 2. Extract source references
  const sourceReferences = await extractSourceReferences(backgroundKnowledge, topic);
  
  // 3. Store with the expert
  expert.backgroundKnowledge = backgroundKnowledge;
  expert.sourceReferences = sourceReferences;
  
  // 4. Update the database
  // ...
}
```

### 2. Response Generation with Citations

When generating responses, the system prompt is enhanced with citation instructions:

```typescript
// Create the base system prompt
let systemContent = `You are ${expert.name}, a ${expert.stance} expert...`;

// Enhance with citation instructions
systemContent = enhancePromptWithCitationInstructions(systemContent);

// Generate response
const completion = await openai.chat.completions.create({
  // ...
  messages: formattedMessages,
});
```

### 3. Citation Processing in the Client

When a message is added to the UI, citations are processed:

```typescript
// In DebatePanel.tsx
addMessage({
  id: messageId,
  role: 'assistant',
  content: response,
  speaker: expertName,
  // ...
});

// Process citations
useDebateStore.getState().processCitationsInMessage(messageId);
```

The store provides a method to process citations:

```typescript
// In store.ts
processCitationsInMessage: (messageId) => set((state) => {
  // Find the message and expert
  const msgIndex = state.messages.findIndex(m => m.id === messageId);
  if (msgIndex === -1) return state;
  
  const message = state.messages[msgIndex];
  if (message.hasProcessedCitations || message.role !== 'assistant') return state;
  
  const expert = state.experts.find(e => e.name === message.speaker);
  if (!expert || !expert.sourceReferences) return state;
  
  // Process the citations
  const { processedText, citations } = processCitationMarkers(
    message.content, 
    expert.sourceReferences
  );
  
  // Update the message
  const updatedMessages = [...state.messages];
  updatedMessages[msgIndex] = {
    ...message,
    content: processedText,
    citations,
    hasProcessedCitations: true
  };
  
  return { messages: updatedMessages };
})
```

### 4. Citation Rendering in the UI

The `MessageBubble` component displays citations:

```tsx
// In MessageBubble.tsx
return (
  <div className="...">
    {/* Expert information and message content... */}
    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
    
    {/* Citations */}
    {showCitations && message.citations && message.citations.length > 0 && (
      <CitationFooter citations={message.citations} />
    )}
  </div>
);
```

## User Experience

From the user's perspective:

1. The user starts a debate on a topic
2. Experts provide responses with citation markers [1], [2], etc.
3. Below each expert message, a "Show Sources" button appears
4. Clicking the button reveals the sources, with options to view more details
5. Sources may include titles, authors, publication dates, and links to external resources

## Future Enhancements

Potential improvements to the citation system:

1. **Citation Highlighting**: Highlight the specific text that corresponds to each citation
2. **Citation Quality Indicators**: Add visual indicators for source credibility
3. **Source Verification**: Integrate with external fact-checking APIs
4. **Cross-referencing**: Allow citations to reference sources from other experts
5. **Citation Search**: Enable users to search for specific cited claims or sources
6. **Citation Export**: Let users export citations in academic formats (APA, MLA, etc.)
7. **Citation Filtering**: Allow users to filter debates to show only claims with citations

## Technical Considerations

### Performance

- Citation processing happens client-side to avoid modifying the original LLM response
- Source references are cached to avoid repeated retrieval
- The UI uses a collapsible design to minimize visual clutter

### Reliability

- The system gracefully handles missing sources or invalid citation markers
- Source extraction uses a lower temperature setting for more reliable results
- The cache prevents repeated extraction of the same information

### Accessibility

- Citation markers are clearly visible in square brackets
- The citation footer is keyboard accessible
- Source information includes text alternatives for non-text content 