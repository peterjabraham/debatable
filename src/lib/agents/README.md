# LangChain Integration for Great Debate

This directory contains the enhanced debate functionality using LangChain. The goal is to provide more substantive, informed debates with better context management and fact-checking.

## Key Components

### 1. Knowledge Retrieval (knowledge-retrieval.ts)

Provides background knowledge for debate experts before they respond, making their arguments more substantive and accurate:

- Retrieves relevant facts, statistics, and research for each expert's stance
- Uses LangChain's structured prompts to get tailored information
- Operates asynchronously to avoid slowing down initial debate setup

### 2. Fact Checking (fact-checking.ts)

Verifies factual claims made during debates:

- Identifies potential factual claims using heuristics
- Assesses claim accuracy with a structured evaluation system
- Returns formatted results with accuracy ratings and explanations
- Runs in the background without blocking the main conversation flow

### 3. Context Management (context-management.ts)

Maintains debate flow and structure:

- Tracks conversation history with LangChain's memory components
- Manages turn-based debate structure
- Adds simulated "thinking" delays for a more natural feel
- Summarizes debate context for better continuity

## Integration with Debate API

The debate API route (/api/debate/route.ts) has been updated to use these components:

1. When a debate starts:
   - Experts are selected as before
   - Background knowledge retrieval is triggered asynchronously
   - Debate context is initialized

2. During response generation:
   - Context from previous messages is summarized
   - Background knowledge is incorporated into prompts
   - Simulated thinking is applied for more natural timing
   - Generated responses are fact-checked in the background

3. When user messages are added:
   - Message is stored and context is updated
   - The next speaker is determined based on turn-taking rules

## Future Improvements

- Storing fact-check results in the database and displaying them to users
- Integrating additional knowledge sources (e.g., web search)
- Adding bias detection and logical fallacy identification
- Implementing real-time notifications for when an expert is "thinking"

## Usage

The agents work automatically as part of the debate API. No manual intervention is needed beyond the initial setup. 