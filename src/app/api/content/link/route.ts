import { NextRequest, NextResponse } from 'next/server';
import fetch from 'cross-fetch';
import * as cheerio from 'cheerio';
import openai from '@/lib/ai/openai-client';
import { extractTextFromUrl } from '@/lib/content-processing/web-scraper';
import { extractTopicsFromText } from '@/lib/content-processing/topic-extractor';

// Intelligent topic extractor using OpenAI
class AITopicExtractor {
    async extractTopics(document: any) {
        try {
            const content = document.content || '';

            // If content is too large, we need to truncate it
            const truncatedContent = content.length > 8000
                ? content.substring(0, 8000) + "..."
                : content;

            // Use OpenAI to extract topics and arguments
            const response = await openai.chat.completions.create({
                model: process.env.OPENAI_MODEL || "gpt-4o", // Use the configured model or default to gpt-4o
                messages: [
                    {
                        role: "system",
                        content: `You are an expert at analyzing content and extracting key topics for debate.
                        
                        For a given piece of content:
                        1. Identify 3-5 main topics that would make excellent debate subjects
                        2. For each topic, extract key arguments representing DIFFERENT SIDES of the issue
                        3. Include both supporting AND opposing viewpoints for each topic
                        4. Base all arguments directly on content from the source material
                        5. Focus on controversial or nuanced issues where reasonable people might disagree
                        6. Look for topics that involve ethical considerations, policy decisions, or competing values
                        
                        Format each topic with a clear title and multiple arguments that present different perspectives.`
                    },
                    {
                        role: "user",
                        content: `Analyze the following content and extract debate topics with key arguments. 
                        Format your response as JSON with this exact structure:
                        
                        {
                          "topics": [
                            {
                              "title": "Clear debate topic title",
                              "relevance": 0.9, // number between 0-1
                              "summary": "Brief summary of the topic",
                              "keywords": ["keyword1", "keyword2", "keyword3"],
                              "arguments": [
                                {
                                  "claim": "Argument supporting one perspective",
                                  "evidence": "Direct evidence from the content that supports this claim",
                                  "relevance": 0.85 // number between 0-1
                                },
                                {
                                  "claim": "Argument from an opposing perspective",
                                  "evidence": "Direct evidence from the content that supports this counter-claim",
                                  "relevance": 0.82 // number between 0-1
                                }
                              ]
                            }
                            // additional topics...
                          ]
                        }
                        
                        CONTENT TO ANALYZE:
                        ${truncatedContent}`
                    }
                ],
                response_format: { type: "json_object" },
                temperature: 0.5,
            });

            const result = JSON.parse(response.choices[0].message.content || "{}");

            // Map the result to the expected format
            const topics = (result.topics || []).map((topic: any) => ({
                title: topic.title,
                confidence: topic.relevance || 0.85,
                keywords: topic.keywords || [],
                summary: topic.summary || topic.title,
                sourceSection: {
                    content: truncatedContent.substring(0, 200), // Just a placeholder
                    position: 0
                }
            }));

            const mainArguments = (result.topics || []).flatMap((topic: any, topicIndex: number) =>
                (topic.arguments || []).map((arg: any) => ({
                    claim: arg.claim,
                    confidence: arg.relevance || 0.8,
                    evidence: Array.isArray(arg.evidence) ? arg.evidence : [arg.evidence],
                    sourceSection: {
                        content: truncatedContent.substring(0, 200), // Just a placeholder
                        position: topicIndex
                    }
                }))
            );

            return {
                success: true,
                topics,
                mainArguments
            };
        } catch (error) {
            console.error("Error extracting topics with AI:", error);
            return {
                success: false,
                topics: [],
                mainArguments: [],
                error: `Failed to extract topics: ${(error as Error).message}`
            };
        }
    }
}

export async function POST(request: Request) {
    try {
        const { url } = await request.json();

        if (!url) {
            return NextResponse.json(
                { error: 'No URL provided' },
                { status: 400 }
            );
        }

        // Extract text from URL
        const text = await extractTextFromUrl(url);
        if (!text) {
            return NextResponse.json(
                { error: 'Failed to extract text from URL' },
                { status: 400 }
            );
        }

        // Extract topics from text
        const topics = await extractTopicsFromText(text);
        if (!topics || topics.length === 0) {
            return NextResponse.json(
                { error: 'No topics found in content' },
                { status: 400 }
            );
        }

        return NextResponse.json({
            message: 'Web link processed successfully',
            topics
        });

    } catch (error) {
        console.error('[Link API] Error:', error);
        return NextResponse.json(
            { error: 'Failed to process web link' },
            { status: 500 }
        );
    }
}
