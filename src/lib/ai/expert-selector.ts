import { Expert } from '../../types/expert';
import { v4 as uuidv4 } from 'uuid';
import openai, { getModel } from './openai-client';

export async function selectExperts(
    topic: string,
    expertType: 'historical' | 'domain' = 'historical',
    count: number = 2
): Promise<Expert[]> {
    try {
        console.log(`Selecting ${count} ${expertType} experts for topic: ${topic}`);

        const response = await openai.chat.completions.create({
            model: getModel(),
            messages: [
                { role: 'system', content: getSystemPrompt(expertType) },
                { role: 'user', content: getUserPrompt(topic, expertType, count) }
            ],
            temperature: 0.7,
            response_format: { type: 'json_object' }
        });

        const content = response.choices[0]?.message?.content;
        if (!content) {
            throw new Error('No response from OpenAI');
        }

        try {
            const parsedResponse = JSON.parse(content);

            // Check if the response has an experts property (which should be an array)
            const expertsArray = parsedResponse.experts || parsedResponse;

            if (!Array.isArray(expertsArray)) {
                console.error('OpenAI response is not properly formatted:', parsedResponse);
                throw new Error('Invalid format: OpenAI response does not contain an experts array');
            }

            // Map the response to our Expert interface and ensure type is set correctly
            const experts = expertsArray.map(expert => ({
                id: uuidv4(),
                name: expert.name || 'Unknown Expert',
                background: expert.background || (expert.bio || ''),
                stance: expert.stance || 'pro',
                perspective: expert.perspective || '',
                type: expertType, // Explicitly set the type based on what was selected
                expertise: Array.isArray(expert.expertise) ? expert.expertise :
                    (expert.expertise ? [expert.expertise] : []),
            }));

            console.log(`Successfully selected ${experts.length} ${expertType} experts`);
            return experts;
        } catch (error) {
            console.error('Error parsing OpenAI response:', content, error);
            throw new Error('Failed to parse OpenAI response');
        }
    } catch (error) {
        console.error('Error selecting experts:', error);
        throw error;
    }
}

function getSystemPrompt(expertType: 'historical' | 'domain'): string {
    return `You are an expert debate coordinator. Your task is to select 2 ${expertType === 'historical' ? 'historical figures' : 'domain experts'} who would have interesting and contrasting perspectives on a given topic.

Return a JSON object with an "experts" array containing objects with these fields:
1. name: Full name ${expertType === 'domain' ? 'with relevant title (Dr., Prof., etc.)' : 'of the historical figure'}
2. background: Brief description of ${expertType === 'historical' ? 'who they were' : 'their field and credentials'} (1-2 sentences)
3. stance: One expert should be 'pro' and one should be 'con' regarding the topic
4. perspective: ${expertType === 'historical' ? 'How they would approach this topic based on their historical context' : 'Their approach to this topic based on their expertise'} (2-3 sentences)
5. expertise: An array of 2-4 short phrases describing their ${expertType === 'historical' ? 'areas of expertise or knowledge domains' : 'specific areas of expertise or specializations'}

Format your response as a valid JSON object with an "experts" array containing these expert objects.`;
}

function getUserPrompt(topic: string, expertType: 'historical' | 'domain', count: number): string {
    return `Select ${count} ${expertType === 'historical' ? 'historical figures' : 'domain experts'} who would have the most interesting and contrasting perspectives on the topic: "${topic}".

Ensure you select experts with opposing viewpoints - one should be generally "pro" and one should be generally "con" on this topic.

Make sure each expert has:
- A name
- A background description
- A clear stance (one pro, one con)
- A detailed perspective on the topic
- An array of expertise areas (2-4 specific domains)

Return only a JSON object with an "experts" array.`;
} 