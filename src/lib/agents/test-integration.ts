/**
 * LangChain Integration Test
 * 
 * This file contains test functions for verifying the LangChain integration.
 * It provides functions to test each agent module independently.
 */

import { Expert } from '@/types/expert';
import { Message } from '@/types/message';
import { retrieveBackgroundKnowledge } from './knowledge-retrieval';
import { checkFactualAccuracy, extractClaimsToCheck } from './fact-checking';
import {
    initializeDebateContext,
    updateDebateContext,
    getDebateContextSummary,
    simulateThinking
} from './context-management';

/**
 * Test types for running different integration tests
 */
export type TestType =
    | 'knowledge-retrieval'
    | 'fact-checking'
    | 'context-management'
    | 'all';

/**
 * Test options interface
 */
export interface TestOptions {
    topic?: string;
    testType?: TestType;
    verbose?: boolean;
}

/**
 * Test result interface
 */
export interface TestResult {
    success: boolean;
    message: string;
    data?: any;
    error?: Error;
}

/**
 * Run all integration tests
 * 
 * @param options Test options
 * @returns Test results
 */
export async function runIntegrationTests(options: TestOptions = {}): Promise<Record<string, TestResult>> {
    const results: Record<string, TestResult> = {};
    const testType = options.testType || 'all';
    const topic = options.topic || 'climate change';

    console.log(`Starting LangChain integration tests for topic: "${topic}"`);

    // Test knowledge retrieval
    if (testType === 'all' || testType === 'knowledge-retrieval') {
        results['knowledge-retrieval'] = await testKnowledgeRetrieval(topic, options.verbose);
    }

    // Test fact checking
    if (testType === 'all' || testType === 'fact-checking') {
        results['fact-checking'] = await testFactChecking(topic, options.verbose);
    }

    // Test context management
    if (testType === 'all' || testType === 'context-management') {
        results['context-management'] = await testContextManagement(topic, options.verbose);
    }

    return results;
}

/**
 * Test knowledge retrieval functionality
 * 
 * @param topic The topic to test with
 * @param verbose Whether to log detailed results
 * @returns Test result
 */
async function testKnowledgeRetrieval(topic: string, verbose = false): Promise<TestResult> {
    console.log(`Testing knowledge retrieval for topic: "${topic}"`);

    try {
        // Create test experts
        const proExpert: Expert = {
            name: "Dr. Alex Johnson",
            stance: "pro",
            background: "Climate scientist with 15 years experience in atmospheric research",
            expertise: ["Climate science", "Environmental policy", "Renewable energy"],
            id: "test-pro-expert"
        };

        const conExpert: Expert = {
            name: "Dr. Morgan Smith",
            stance: "con",
            background: "Economist specializing in energy markets and industry impacts",
            expertise: ["Economics", "Energy policy", "Industrial development"],
            id: "test-con-expert"
        };

        // Test pro expert knowledge retrieval
        const proKnowledge = await retrieveBackgroundKnowledge(proExpert, topic);

        if (verbose) {
            console.log(`\nPro Expert Knowledge:\n${proKnowledge}\n`);
        }

        // Test con expert knowledge retrieval
        const conKnowledge = await retrieveBackgroundKnowledge(conExpert, topic);

        if (verbose) {
            console.log(`\nCon Expert Knowledge:\n${conKnowledge}\n`);
        }

        // Validate results
        const isValid =
            typeof proKnowledge === 'string' &&
            proKnowledge.length > 100 &&
            typeof conKnowledge === 'string' &&
            conKnowledge.length > 100;

        return {
            success: isValid,
            message: isValid
                ? "Successfully retrieved background knowledge for experts"
                : "Failed to retrieve valid background knowledge",
            data: { proKnowledge, conKnowledge }
        };
    } catch (error) {
        console.error("Error in knowledge retrieval test:", error);
        return {
            success: false,
            message: "Knowledge retrieval test failed with an error",
            error: error instanceof Error ? error : new Error(String(error))
        };
    }
}

/**
 * Test fact checking functionality
 * 
 * @param topic The topic to test with
 * @param verbose Whether to log detailed results
 * @returns Test result
 */
async function testFactChecking(topic: string, verbose = false): Promise<TestResult> {
    console.log(`Testing fact checking for topic: "${topic}"`);

    try {
        // Create test claims
        const trueClaim = `The IPCC has stated that human activities are the dominant cause of observed warming since the mid-20th century.`;
        const falseClaim = `There has been no global warming measured in the last 30 years according to NASA data.`;
        const uncertainClaim = `Implementing carbon taxes will lead to 15% GDP growth within 5 years.`;

        // Check claims
        const trueResult = await checkFactualAccuracy(trueClaim, topic);
        const falseResult = await checkFactualAccuracy(falseClaim, topic);
        const uncertainResult = await checkFactualAccuracy(uncertainClaim, topic);

        if (verbose) {
            console.log('\nTrue Claim Check:', JSON.stringify(trueResult, null, 2));
            console.log('\nFalse Claim Check:', JSON.stringify(falseResult, null, 2));
            console.log('\nUncertain Claim Check:', JSON.stringify(uncertainResult, null, 2));
        }

        // Test claim extraction from a message
        const testMessage = `Climate change will cause sea levels to rise by 2 meters by 2100. 
The majority of scientists agree that we have only 10 years to act before irreversible damage. 
China produces more carbon emissions than any other country in history.`;

        const extractedClaims = await extractClaimsToCheck(testMessage, topic);

        if (verbose && extractedClaims.length > 0) {
            console.log('\nExtracted Claims:');
            extractedClaims.forEach((claim, i) => console.log(`${i + 1}. ${claim}`));
        }

        // Validate results
        const isValid =
            trueResult && trueResult.accuracy &&
            falseResult && falseResult.accuracy &&
            uncertainResult && uncertainResult.accuracy &&
            Array.isArray(extractedClaims) &&
            extractedClaims.length > 0;

        return {
            success: isValid,
            message: isValid
                ? "Successfully performed fact checking on test claims"
                : "Failed to properly fact check test claims",
            data: {
                trueResult,
                falseResult,
                uncertainResult,
                extractedClaims
            }
        };
    } catch (error) {
        console.error("Error in fact checking test:", error);
        return {
            success: false,
            message: "Fact checking test failed with an error",
            error: error instanceof Error ? error : new Error(String(error))
        };
    }
}

/**
 * Test context management functionality
 * 
 * @param topic The topic to test with
 * @param verbose Whether to log detailed results
 * @returns Test result
 */
async function testContextManagement(topic: string, verbose = false): Promise<TestResult> {
    console.log(`Testing context management for topic: "${topic}"`);

    try {
        // Create test debate ID
        const debateId = `test-debate-${Date.now()}`;

        // Initialize context
        const initialContext = await initializeDebateContext(debateId, topic);

        if (verbose) {
            console.log('\nInitial Context:', JSON.stringify(initialContext, null, 2));
        }

        // Create test messages
        const userMessage: Message = {
            id: 'msg1',
            role: 'user',
            content: `I'd like to understand more about the economic impacts of ${topic}. What about jobs and growth?`,
            timestamp: new Date().toISOString(),
            debateContext: { debateId }
        };

        const expertMessage: Message = {
            id: 'msg2',
            role: 'assistant',
            content: `When examining the economic dimensions of ${topic}, research from the International Labor Organization suggests significant job creation potential in renewable sectors. Studies show that investments in green infrastructure can generate more jobs per dollar than fossil fuel industries. However, regions dependent on traditional energy sectors may experience short-term economic challenges during the transition period. It's important to implement policies that support these communities through the shift.`,
            timestamp: new Date().toISOString(),
            senderInfo: {
                id: 'test-expert-1',
                name: 'Dr. Alex Johnson',
                type: 'expert'
            },
            debateContext: { debateId }
        };

        // Update context with messages
        await updateDebateContext(userMessage);
        await updateDebateContext(expertMessage);

        // Get context summary
        const summary = await getDebateContextSummary(debateId);

        if (verbose) {
            console.log('\nContext Summary:', summary);
        }

        // Test thinking simulation
        console.log('Testing thinking simulation (brief delay)...');
        await simulateThinking(1, 2);

        // Validate results
        const isValid =
            initialContext &&
            typeof summary === 'string' &&
            summary.length > 50;

        return {
            success: isValid,
            message: isValid
                ? "Successfully tested context management functionality"
                : "Failed to properly manage debate context",
            data: {
                debateId,
                summary
            }
        };
    } catch (error) {
        console.error("Error in context management test:", error);
        return {
            success: false,
            message: "Context management test failed with an error",
            error: error instanceof Error ? error : new Error(String(error))
        };
    }
} 