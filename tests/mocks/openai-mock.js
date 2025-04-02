/**
 * Mock implementation for OpenAI API calls
 * This allows us to test without real API dependencies
 */

const mockTopicResponses = {
    // Mock response for climate text
    climate: {
        topics: [
            {
                title: "Climate Change Impact",
                confidence: 0.92,
                arguments: [
                    "Rising global temperatures are causing more frequent extreme weather events",
                    "Melting ice caps contribute to sea level rise threatening coastal communities",
                    "Climate change disrupts ecosystems and biodiversity worldwide"
                ]
            },
            {
                title: "Carbon Emission Reduction",
                confidence: 0.87,
                arguments: [
                    "Comprehensive policies are needed to reduce carbon footprint",
                    "Investing in renewable energy is essential for sustainability",
                    "Individual and corporate responsibility in emissions reduction is crucial"
                ]
            },
            {
                title: "Climate Justice and Equity",
                confidence: 0.83,
                arguments: [
                    "Developing nations face disproportionate climate impacts despite lower historical emissions",
                    "Vulnerable communities require additional support for climate adaptation",
                    "Equitable distribution of climate action costs is an ethical imperative"
                ]
            }
        ]
    },

    // Mock response for AI text
    ai: {
        topics: [
            {
                title: "Artificial Intelligence Ethics",
                confidence: 0.89,
                arguments: [
                    "AI raises significant privacy concerns in data collection and usage",
                    "Potential job displacement due to automation requires economic planning",
                    "Ethical frameworks are needed for responsible AI development"
                ]
            },
            {
                title: "AI Innovation Benefits",
                confidence: 0.85,
                arguments: [
                    "AI enhances productivity across various sectors",
                    "Automation of routine tasks allows humans to focus on creative work",
                    "Complex problem-solving capabilities can address major challenges"
                ]
            },
            {
                title: "AI Regulation and Governance",
                confidence: 0.81,
                arguments: [
                    "International cooperation is needed for effective AI governance",
                    "Balancing innovation with safety requires thoughtful regulatory frameworks",
                    "Transparency in AI systems is essential for public trust and accountability"
                ]
            }
        ]
    },

    // Mock response for education text
    education: {
        topics: [
            {
                title: "Future of Education",
                confidence: 0.91,
                arguments: [
                    "Technology is transforming traditional educational models",
                    "Personalized learning approaches can address individual student needs",
                    "Digital divide creates inequitable access to educational resources"
                ]
            },
            {
                title: "Teacher's Role in Digital Education",
                confidence: 0.84,
                arguments: [
                    "Teachers remain essential facilitators in technology-enhanced learning",
                    "Professional development is needed for educators to utilize new tools",
                    "Balance between automation and human instruction is crucial"
                ]
            },
            {
                title: "Educational Assessment Methods",
                confidence: 0.79,
                arguments: [
                    "Traditional standardized testing may not measure all valuable skills",
                    "Project-based assessments can better evaluate critical thinking and creativity",
                    "Continuous feedback systems may be more effective than periodic examinations",
                    "Schools need to adapt assessment methods to prepare students for future challenges"
                ]
            }
        ]
    },

    // Default response for other text
    default: {
        topics: [
            {
                title: "Generic Topic 1",
                confidence: 0.80,
                arguments: [
                    "This is a generic argument point",
                    "This is another general argument",
                    "This is a third supporting point"
                ]
            },
            {
                title: "Generic Topic 2",
                confidence: 0.75,
                arguments: [
                    "First generic argument for second topic",
                    "Second generic argument for second topic",
                    "Third generic argument for second topic"
                ]
            },
            {
                title: "Generic Topic 3",
                confidence: 0.72,
                arguments: [
                    "First argument for third generic topic",
                    "Second argument for third generic topic",
                    "Third argument for third generic topic"
                ]
            }
        ]
    }
};

/**
 * Mock OpenAI API for topic extraction
 * Returns different responses based on text content
 */
const mockOpenAI = {
    chat: {
        completions: {
            create: async (options) => {
                // Simulate API delay
                await new Promise(resolve => setTimeout(resolve, 500));

                const userContent = options.messages.find(m => m.role === 'user')?.content || '';

                // Determine which mock response to return based on text content
                let response;

                if (userContent.toLowerCase().includes('climate')) {
                    response = mockTopicResponses.climate;
                } else if (userContent.toLowerCase().includes('artificial intelligence') ||
                    userContent.toLowerCase().includes(' ai ')) {
                    response = mockTopicResponses.ai;
                } else if (userContent.toLowerCase().includes('education') ||
                    userContent.toLowerCase().includes('learning')) {
                    response = mockTopicResponses.education;
                } else {
                    response = mockTopicResponses.default;
                }

                // Return in OpenAI format
                return {
                    choices: [
                        {
                            message: {
                                content: JSON.stringify(response)
                            }
                        }
                    ]
                };
            }
        }
    }
};

module.exports = mockOpenAI; 