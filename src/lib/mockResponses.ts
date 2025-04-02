import { Message } from '@/types/message';

/**
 * Hard-coded supporter responses for common topics when API fails
 */
const MOCK_SUPPORTER_RESPONSES: Record<string, string[]> = {
    'climate change': [
        "Climate change demands immediate global action. The scientific consensus is clear: human activities have caused unprecedented warming. Renewable energy solutions are becoming more cost-effective, and transitioning to them creates jobs while reducing emissions. The economic cost of inaction far exceeds the investments needed now.",
        "Investing in climate solutions represents an opportunity for innovation and economic growth. Many countries are already demonstrating that emissions reduction and economic prosperity can go hand-in-hand. Furthermore, addressing climate change directly benefits public health by reducing air pollution.",
        "The international cooperation demonstrated through agreements like the Paris Accord shows that global solutions are possible. Every country and individual can contribute to building a sustainable future."
    ],
    'artificial intelligence': [
        "AI technology represents one of the greatest opportunities for human advancement. It can automate routine tasks, allowing people to focus on creative and fulfilling work. The productivity gains from AI will likely create more jobs than are displaced, as we've seen with previous technological revolutions.",
        "AI systems are already improving healthcare through better diagnostics, making education more personalized, and helping solve complex scientific problems. Responsible development of AI, with appropriate safeguards, can ensure these benefits are widely shared across society.",
        "We should embrace AI's potential while thoughtfully addressing challenges. History shows that technological progress ultimately improves human welfare when we manage transitions effectively."
    ],
    'education reform': [
        "Education reform is essential to prepare students for the modern world. Traditional models focus too heavily on standardized testing rather than critical thinking, creativity, and practical skills. Personalized learning approaches can better accommodate different learning styles and needs.",
        "Investment in education pays tremendous dividends for society - from economic growth to social cohesion. Technology can help democratize access to quality education regardless of geographic or socioeconomic barriers.",
        "Teacher empowerment should be central to reform efforts. When educators have resources, autonomy, and support, they can innovate and inspire students more effectively."
    ],
    'healthcare': [
        "Expanding healthcare access is both a moral imperative and economically sensible. Universal coverage reduces expensive emergency care by encouraging preventative medicine. Systems that ensure healthcare for all have demonstrated better health outcomes at lower costs per capita.",
        "Integrating technology into healthcare delivery can improve efficiency and patient outcomes while potentially reducing costs. Telehealth, electronic records, and AI diagnostics are transforming how care is delivered.",
        "A healthy population is more productive and contributes more to economic growth. The return on investment in public health initiatives is substantial when considering reduced sick days and longer, more productive lives."
    ],
    'default': [
        "This position deserves strong consideration based on both moral and practical grounds. The evidence supports this approach, and many successful implementations demonstrate its viability.",
        "From an ethical perspective, this position aligns with widely-shared values of fairness and opportunity. The practical benefits are substantial and would address several current challenges.",
        "Taking this position would represent a forward-thinking approach that balances immediate needs with long-term sustainability. The potential benefits outweigh the adjustment costs."
    ]
};

/**
 * Hard-coded opposer responses for common topics when API fails
 */
const MOCK_OPPOSER_RESPONSES: Record<string, string[]> = {
    'climate change': [
        "While climate concerns merit attention, we must be realistic about solutions. Many proposed climate policies would impose enormous economic costs, particularly on working families, while making minimal impact on global temperatures. We need balance, not alarmism.",
        "Developing nations need affordable energy to lift their populations out of poverty. Restricting their access to reliable energy sources prioritizes environmental idealism over human welfare. Technology and innovation, not restrictions, offer the most promising path forward.",
        "Market-based solutions and adaptation strategies deserve more attention. Government mandates often create inefficiencies and unintended consequences. We should focus on resilience and technological breakthroughs rather than drastic economic restructuring."
    ],
    'artificial intelligence': [
        "The rapid advancement of AI raises serious concerns about job displacement. Unlike previous technological shifts, AI threatens to automate many white-collar and professional jobs simultaneously, potentially outpacing our ability to create new employment opportunities.",
        "AI systems often reflect and amplify existing biases in their training data, raising concerns about fairness and discrimination. Furthermore, the concentration of AI capabilities in a few large companies threatens to increase economic inequality and power imbalances.",
        "The lack of transparency in many AI systems makes accountability difficult. We need thoughtful regulation to ensure safe, ethical AI development before deployment in critical domains like healthcare, criminal justice, and employment decisions."
    ],
    'education reform': [
        "Many education reforms are implemented without sufficient evidence of effectiveness, turning students into test subjects for unproven theories. Standardized measures, despite their limitations, provide necessary accountability and objective comparisons.",
        "Technology in education often fails to deliver on its promises while creating new problems like screen addiction and privacy concerns. Excessive focus on digital skills may come at the expense of fundamental abilities like critical thinking and interpersonal communication.",
        "Constant reform creates instability in educational systems. Teachers need consistency to develop expertise in their methods. We should focus on implementing proven approaches well rather than continuously changing direction."
    ],
    'healthcare': [
        "Government-centralized healthcare systems often lead to inefficiency, long wait times, and reduced innovation. Market competition and consumer choice drive quality improvements and cost containment more effectively than top-down control.",
        "Healthcare is not one-size-fits-all, and individuals have different needs and priorities. Systems that preserve choice and allow customization better serve diverse populations than monolithic approaches.",
        "The enormous costs of universal programs often lead to rationing of care or unsustainable tax burdens. We should focus on targeted reforms that address specific problems while preserving what works well in current systems."
    ],
    'default': [
        "This position overlooks several important practical challenges in implementation. The costs and unintended consequences could outweigh the potential benefits.",
        "While well-intentioned, this approach fails to account for the diversity of circumstances and individual needs. A more flexible, nuanced solution would be more effective.",
        "Historical attempts at similar approaches have revealed significant limitations. We should learn from these experiences rather than repeating past mistakes with renewed enthusiasm."
    ]
};

/**
 * Generates a mock supporter response based on the topic and user message
 */
export function generateSupporterResponse(topic: string, userMessage: string): string {
    // Find the most relevant topic category
    const topicKey = Object.keys(MOCK_SUPPORTER_RESPONSES).find(key =>
        topic.toLowerCase().includes(key)
    ) || 'default';

    // Select a random response from that category
    const responses = MOCK_SUPPORTER_RESPONSES[topicKey];
    const randomIndex = Math.floor(Math.random() * responses.length);

    // Extract keywords from user message to make response more relevant
    const keywords = extractKeywords(userMessage);

    // Create personalized intro if we have keywords
    let personalization = '';
    if (keywords.length > 0) {
        personalization = `Regarding your point about ${keywords[0]}: `;
    }

    return personalization + responses[randomIndex];
}

/**
 * Generates a mock opposer response based on the topic and user message
 */
export function generateOpposerResponse(topic: string, userMessage: string): string {
    // Find the most relevant topic category
    const topicKey = Object.keys(MOCK_OPPOSER_RESPONSES).find(key =>
        topic.toLowerCase().includes(key)
    ) || 'default';

    // Select a random response from that category
    const responses = MOCK_OPPOSER_RESPONSES[topicKey];
    const randomIndex = Math.floor(Math.random() * responses.length);

    // Extract keywords from user message to make response more relevant
    const keywords = extractKeywords(userMessage);

    // Create personalized intro if we have keywords
    let personalization = '';
    if (keywords.length > 0) {
        personalization = `I understand your concern about ${keywords[0]}, however: `;
    }

    return personalization + responses[randomIndex];
}

/**
 * Extract key words or phrases from a message for personalization
 */
function extractKeywords(message: string): string[] {
    if (!message || message.trim().length === 0) {
        return [];
    }

    // Simple keyword extraction based on common meaningful words
    const words = message.toLowerCase().split(/\s+/);
    const commonWords = new Set([
        'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'with',
        'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had',
        'do', 'does', 'did', 'will', 'would', 'should', 'could', 'can', 'may', 'might',
        'i', 'you', 'he', 'she', 'it', 'we', 'they', 'this', 'that', 'these', 'those'
    ]);

    // Filter out common words and get longest remaining words (likely more meaningful)
    const keywords = words
        .filter(word => word.length > 3 && !commonWords.has(word))
        .sort((a, b) => b.length - a.length)
        .slice(0, 3);

    // If we couldn't find meaningful keywords, try noun phrases
    if (keywords.length === 0) {
        // Look for 2-3 word phrases that might be concepts
        const text = message.toLowerCase();
        const phrases = [
            'climate change', 'global warming', 'renewable energy',
            'artificial intelligence', 'machine learning',
            'education reform', 'standardized testing', 'teacher training',
            'healthcare system', 'universal coverage', 'medical costs',
            'economic growth', 'tax policy', 'income inequality',
            'immigration reform', 'border security',
            'gun control', 'second amendment',
            'free speech', 'social media'
        ];

        return phrases.filter(phrase => text.includes(phrase)).slice(0, 1);
    }

    return keywords;
} 