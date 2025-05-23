/**
 * LangChain Configuration File
 * 
 * This file centralizes configuration for LangChain integrations including:
 * - API keys for different services
 * - Model configuration options
 * - Environment-specific settings
 */

import { OpenAI } from "@langchain/openai";
import { ChatOpenAI } from "@langchain/openai";

// Configure environment variables (can be moved to .env file)
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o";
const SERPER_API_KEY = process.env.SERPER_API_KEY || ""; // For web search if needed
const PINECONE_API_KEY = process.env.PINECONE_API_KEY || ""; // For vector storage if needed

// LangChain Model Configuration
export const createChatModel = (options = {}) => {
    return new ChatOpenAI({
        modelName: OPENAI_MODEL,
        openAIApiKey: OPENAI_API_KEY,
        temperature: 0.7,
        maxTokens: 800,
        ...options
    });
};

export const createCompletionModel = (options = {}) => {
    return new OpenAI({
        modelName: OPENAI_MODEL,
        openAIApiKey: OPENAI_API_KEY,
        temperature: 0.7,
        maxTokens: 800,
        ...options
    });
};

// Agent Configuration
export const agentConfig = {
    // Knowledge retrieval settings
    knowledgeRetrieval: {
        maxSourcesPerQuery: 3,
        useCache: true,
        cacheTTL: 60 * 60 * 24, // 24 hours
    },

    // Fact checking settings
    factChecking: {
        confidenceThreshold: 0.7,
        useExternalAPIs: false, // Set to true when integrating with external fact-checking APIs
    },

    // Context management settings
    contextManagement: {
        maxHistoryItems: 10,
        summarizeThreshold: 12, // Summarize context when more than this many messages
        includeSummary: true,
    }
};

// Test credentials for development (overriden in production)
export const testCredentials = {
    // Only enable in development, never in production
    enabled: process.env.NODE_ENV === 'development',
    // Only use mock responses if not forced to use real API
    mockResponses: process.env.NODE_ENV !== 'production' &&
        process.env.NEXT_PUBLIC_USE_REAL_API !== 'true',
};

// Export configuration
export const langchainConfig = {
    apiKeys: {
        openai: OPENAI_API_KEY,
        serper: SERPER_API_KEY,
        pinecone: PINECONE_API_KEY,
    },
    models: {
        chat: createChatModel,
        completion: createCompletionModel,
    },
    agent: agentConfig,
    test: testCredentials,
};

export default langchainConfig; 