import { NextRequest, NextResponse } from 'next/server';
import fetch from 'cross-fetch';
import * as cheerio from 'cheerio';
import OpenAI from 'openai';

// Create an OpenAI client
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

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

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const url = formData.get('url') as string;

        if (!url) {
            return NextResponse.json(
                { message: 'No URL provided' },
                { status: 400 }
            );
        }

        // Fetch the web page content
        const response = await fetch(url);
        if (!response.ok) {
            return NextResponse.json(
                { message: `Failed to fetch content from URL: ${response.statusText}` },
                { status: 400 }
            );
        }

        const html = await response.text();

        // Parse the HTML content
        const $ = cheerio.load(html);

        // Extract text content from the page (removing scripts, styles, etc.)
        $('script, style, noscript, iframe, object, embed').remove();
        const textContent = $('body').text().replace(/\s+/g, ' ').trim();

        // Extract metadata
        const metadata = {
            url,
            title: $('title').text() || 'Unknown Title',
            author: $('meta[name="author"]').attr('content') || 'Unknown Author',
            publishedDate: $('meta[name="date"]').attr('content') || 'Unknown Date',
            source: new URL(url).hostname,
            wordCount: textContent.split(/\s+/).length
        };

        // Check if OpenAI API key is available
        if (!process.env.OPENAI_API_KEY) {
            console.warn("OpenAI API key not found, falling back to mock data");
            // Return mock data with a warning
            return NextResponse.json({
                message: 'Web link processed with mock data (OpenAI API key not configured)',
                metadata,
                topics: [
                    {
                        title: 'No OpenAI API key configured',
                        confidence: 1.0,
                        arguments: [
                            {
                                claim: "To use actual topic extraction, you need to configure OPENAI_API_KEY in your .env file",
                                evidence: "This is a placeholder response because OpenAI API key is not configured."
                            },
                            {
                                claim: "The app is currently using mock data instead of real content analysis",
                                evidence: "Check your environment variables and make sure OPENAI_API_KEY is set properly."
                            }
                        ]
                    }
                ]
            });
        }

        // Use the AITopicExtractor to analyze the content
        const topicExtractor = new AITopicExtractor();
        const extractionResult = await topicExtractor.extractTopics({
            content: textContent
        });

        if (!extractionResult.success) {
            console.error('Topic extraction failed:', extractionResult.error);
            return NextResponse.json(
                { message: 'Failed to extract topics from content', error: extractionResult.error },
                { status: 500 }
            );
        }

        // Format the topics for the frontend
        const formattedTopics = extractionResult.topics.map(topic => {
            // Convert the arguments to the format expected by the frontend
            const args = extractionResult.mainArguments
                .filter(arg => arg.sourceSection.position === extractionResult.topics.indexOf(topic))
                .map(arg => ({
                    claim: arg.claim,
                    evidence: Array.isArray(arg.evidence) ? arg.evidence.join(' ') : arg.evidence
                }));

            return {
                title: topic.title,
                confidence: topic.confidence,
                arguments: args.length > 0 ? args : [
                    {
                        claim: "No specific arguments found for this topic",
                        evidence: "Consider exploring this topic further for more detailed analysis"
                    }
                ]
            };
        });

        return NextResponse.json({
            message: 'Web link processed successfully',
            metadata,
            topics: formattedTopics
        });

    } catch (error) {
        console.error('Error processing web link:', error);
        return NextResponse.json(
            { message: 'Error processing web link', error: (error as Error).message },
            { status: 500 }
        );
    }
} 