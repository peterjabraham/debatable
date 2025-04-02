/**
 * Document Analysis Service
 * 
 * Extracts debate topics from text using OpenAI's API.
 * Uses environment variables for API configuration.
 */

// Use mock OpenAI in test environment, real one in production
const openai = process.env.NODE_ENV === 'test'
    ? require('../../tests/mocks/openai-mock')
    : require('openai');

// Initialize OpenAI client in production
let openaiClient;
if (process.env.NODE_ENV !== 'test') {
    openaiClient = new openai.OpenAI({
        apiKey: process.env.OPENAI_API_KEY
    });
} else {
    openaiClient = openai; // Use the mock directly in test
}

// Maximum text length to send to OpenAI (to stay within context limits)
const MAX_TEXT_LENGTH = 15000;

/**
 * Extract debate topics from text
 * 
 * @param {string} text - The text to analyze
 * @returns {Promise<Object>} - Object with topics array
 */
async function extractTopicsFromText(text) {
    try {
        // Handle empty or very short text
        if (!text || text.length < 50) {
            return { topics: [] };
        }

        // Truncate text if too long
        const truncatedText = text.substring(0, MAX_TEXT_LENGTH);

        // Prepare the prompt for OpenAI
        const prompt = [
            {
                role: "system",
                content: `Analyze the provided text and extract 3-5 key debate topics.
For each topic:
1. Create a clear, concise title
2. Assign a confidence score (0-1) based on how strongly the topic is represented
3. Extract 3-5 key arguments related to the topic

Format your response as a JSON object with the following structure:
{
  "topics": [
    {
      "title": "Topic Title",
      "confidence": 0.85,
      "arguments": [
        "First key argument or point",
        "Second key argument or point",
        "Third key argument or point"
      ]
    }
  ]
}

Ensure topics are suitable for debate with different perspectives.`
            },
            {
                role: "user",
                content: truncatedText
            }
        ];

        // Call OpenAI API
        const response = await openaiClient.chat.completions.create({
            model: process.env.OPENAI_MODEL || "gpt-4-turbo",
            messages: prompt,
            temperature: 0.7,
            response_format: { type: "json_object" }
        });

        // Parse the response
        const responseContent = response.choices[0].message.content;
        const parsedResponse = JSON.parse(responseContent);

        // Ensure proper structure
        if (!parsedResponse.topics || !Array.isArray(parsedResponse.topics)) {
            throw new Error('Invalid response format from OpenAI');
        }

        return parsedResponse;
    } catch (error) {
        console.error('Error extracting topics:', error);

        // Return empty topics array in case of error
        return { topics: [] };
    }
}

module.exports = {
    extractTopicsFromText
}; 