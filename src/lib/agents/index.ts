/**
 * LangChain Agents Index
 * 
 * This file exports all the agent functionality for use in the application.
 */

import { retrieveBackgroundKnowledge } from './knowledge-retrieval';
import { checkFactualAccuracy } from './fact-checking';
import {
    initializeDebateContext,
    updateDebateContext,
    getDebateContextSummary,
    determineNextSpeaker,
    simulateThinking
} from './context-management';

// Export all agent functions
export {
    // Knowledge retrieval
    retrieveBackgroundKnowledge,

    // Fact checking
    checkFactualAccuracy,

    // Context management
    initializeDebateContext,
    updateDebateContext,
    getDebateContextSummary,
    determineNextSpeaker,
    simulateThinking
}; 