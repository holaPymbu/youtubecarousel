/**
 * Extract key concepts from transcript text for carousel slides
 * Uses AI processing with Gemini, with fallback to heuristic extraction
 */

const { processTranscript } = require('./aiProcessor');

/**
 * Clean and normalize text
 */
function cleanText(text) {
    return text
        .replace(/\[.*?\]/g, '') // Remove bracketed content like [Music]
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Split text into sentences
 */
function splitIntoSentences(text) {
    return text
        .split(/(?<=[.!?])\s+/)
        .filter(s => s.length > 10)
        .map(s => s.trim());
}

/**
 * Calculate importance score for a sentence (bilingual ES/EN)
 */
function scoreSentence(sentence, allText) {
    let score = 0;
    const lowerSentence = sentence.toLowerCase();

    // Length bonus (prefer medium-length sentences with real content)
    const wordCount = sentence.split(/\s+/).length;
    if (wordCount >= 10 && wordCount <= 30) score += 3;
    else if (wordCount >= 6 && wordCount <= 40) score += 1;
    else if (wordCount < 5) score -= 2; // Penalize very short fragments

    // Bilingual key phrase indicators (ES + EN)
    const keyPhrases = [
        // Spanish
        'importante', 'clave', 'principal', 'esencial', 'fundamental',
        'recuerda', 'consejo', 'secreto', 'estrategia', 'método',
        'primero', 'segundo', 'tercero', 'finalmente', 'conclusión',
        'mejor', 'debes', 'necesitas', 'significa', 'resultado',
        'ejemplo', 'problema', 'solución', 'ventaja', 'beneficio',
        'porque', 'entonces', 'básicamente', 'realmente',
        // English
        'important', 'key', 'main', 'essential', 'critical',
        'remember', 'tip', 'secret', 'strategy', 'method',
        'first', 'second', 'third', 'finally', 'conclusion',
        'best', 'must', 'should', 'need', 'means', 'result',
        'example', 'problem', 'solution', 'advantage', 'benefit'
    ];

    keyPhrases.forEach(phrase => {
        if (lowerSentence.includes(phrase)) score += 1.5;
    });

    // Numbers/statistics bonus (strong signal of concrete content)
    if (/\d+\s*%/.test(sentence)) score += 3;
    if (/\d+/.test(sentence)) score += 1;

    // Penalize filler phrases and speech artifacts
    const fillerPhrases = [
        'bueno', 'o sea', 'digamos', 'este', 'ehh', 'umm',
        'you know', 'like', 'basically', 'right',
        'van a', 'vamos a ver', 'les voy a', 'aquí ustedes',
        'suscríbanse', 'dale like', 'compartan', 'subscribe'
    ];
    fillerPhrases.forEach(filler => {
        if (lowerSentence.includes(filler)) score -= 2;
    });

    // Penalize questions that are just rhetorical/engagement
    if (sentence.endsWith('?') && wordCount < 8) score -= 1;

    // Bonus for sentences that explain something (contain cause-effect)
    const explanatoryPhrases = [
        'porque', 'por eso', 'esto significa', 'esto permite',
        'la razón', 'el motivo', 'la diferencia', 'en lugar de',
        'because', 'that means', 'this allows', 'the reason',
        'instead of', 'the difference'
    ];
    explanatoryPhrases.forEach(phrase => {
        if (lowerSentence.includes(phrase)) score += 2;
    });

    return score;
}

/**
 * Generate a meaningful title from a sentence (not just first N words)
 * Tries to extract the core idea as a short phrase
 */
function generateTitle(text, index, total) {
    const lowerText = text.toLowerCase();

    // Try to extract a meaningful noun phrase or key concept
    // Look for patterns like "X es Y", "la clave es", "el método de", etc.
    const patterns = [
        /(?:la |el |lo )?(clave|secreto|truco|método|problema|solución|ventaja|error|regla|principio|concepto|idea|punto)\s+(?:es|de|para)\s+(.{5,30})/i,
        /(?:the )?(key|secret|trick|method|problem|solution|advantage|error|rule|principle|concept|idea|point)\s+(?:is|of|for|to)\s+(.{5,30})/i,
        /(\d+\s*%?\s+\w+.{3,25})/,
    ];

    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) {
            let title = match[0].substring(0, 35).replace(/[.!?,;:]$/, '').trim();
            title = title.charAt(0).toUpperCase() + title.slice(1);
            return title;
        }
    }

    // Fallback: Take the most meaningful words, skip filler
    const skipWords = new Set([
        'y', 'o', 'el', 'la', 'los', 'las', 'un', 'una', 'de', 'del', 'en', 'que', 'es',
        'no', 'se', 'lo', 'por', 'con', 'para', 'como', 'pero', 'más', 'este', 'esta',
        'also', 'the', 'a', 'an', 'is', 'in', 'to', 'of', 'and', 'or', 'for', 'that',
        'muy', 'entonces', 'bueno', 'pues', 'ahora', 'eso', 'esto', 'aquí', 'así',
        'van', 'vamos', 'ustedes', 'nosotros', 'les', 'me', 'te', 'su', 'mi'
    ]);

    const meaningfulWords = text.split(/\s+/)
        .filter(w => !skipWords.has(w.toLowerCase()) && w.length > 2)
        .slice(0, 5);

    let title = meaningfulWords.join(' ').replace(/[.!?,;:]$/, '').trim();
    if (title.length < 5) {
        title = text.split(/\s+/).slice(0, 5).join(' ').replace(/[.!?,;:]$/, '').trim();
    }
    title = title.charAt(0).toUpperCase() + title.slice(1);

    return title;
}

/**
 * Fallback heuristic extraction (when AI is unavailable)
 * Divides transcript into segments and extracts the best content from each
 */
function extractConceptsHeuristic(transcript, slideCount = 7) {
    const text = cleanText(transcript.text);
    const sentences = splitIntoSentences(text);

    if (sentences.length < 3) {
        throw new Error('Transcript too short to extract meaningful concepts');
    }

    // Score all sentences
    const scoredSentences = sentences.map((sentence, idx) => ({
        text: sentence,
        score: scoreSentence(sentence, text),
        position: idx / sentences.length,
        index: idx
    }));

    // Divide transcript into equal segments (one per slide)
    const actualSlideCount = Math.min(slideCount, Math.max(3, Math.ceil(sentences.length / 4)));
    const segmentSize = Math.ceil(sentences.length / actualSlideCount);
    const selected = [];

    for (let seg = 0; seg < actualSlideCount; seg++) {
        const segStart = seg * segmentSize;
        const segEnd = Math.min((seg + 1) * segmentSize, sentences.length);

        // Get sentences in this segment
        const segmentSentences = scoredSentences.slice(segStart, segEnd);

        if (segmentSentences.length === 0) continue;

        // Pick the best-scored sentence from this segment
        const best = segmentSentences.reduce((a, b) => a.score > b.score ? a : b);

        // Try to build richer content by adding context from neighbor sentences
        let content = best.text;
        if (content.length < 80 && best.index + 1 < sentences.length) {
            const next = sentences[best.index + 1];
            if (next && (content + ' ' + next).length <= 220) {
                content = content + ' ' + next;
            }
        }

        // Trim to reasonable length
        if (content.length > 220) {
            content = content.substring(0, 217) + '...';
        }

        selected.push({
            text: best.text,
            content: content,
            score: best.score,
            position: best.position
        });
    }

    // Create slide concepts
    const concepts = selected.map((item, index) => {
        return {
            slideNumber: index + 1,
            title: generateTitle(item.text, index, selected.length),
            content: item.content,
            position: item.position,
            isIntro: index === 0,
            isOutro: index === selected.length - 1
        };
    });

    // Mark first and last slides
    if (concepts.length > 0) {
        concepts[0].title = 'Ideas Clave del Video';
        concepts[concepts.length - 1].title = 'Conclusión';
    }

    return concepts;
}

/**
 * Extract key concepts from transcript using AI
 * Falls back to heuristic extraction if AI fails
 * @param {Object} transcript - Transcript object with text property
 * @param {number} slideCount - Number of slides to generate (default 7)
 * @returns {Promise<Array>} Array of concept objects for slides
 */
async function extractConcepts(transcript, slideCount = 7) {
    // Try AI processing first
    try {
        if (!process.env.GEMINI_API_KEY) {
            console.log('⚠️ No GEMINI_API_KEY, using heuristic extraction');
            return extractConceptsHeuristic(transcript, slideCount);
        }

        console.log('🤖 Processing transcript with Gemini AI...');
        const aiResult = await processTranscript(transcript, { slideCount });

        // Transform AI result to match expected format
        const concepts = aiResult.concepts.map((concept, index) => ({
            slideNumber: index + 1,
            title: concept.title,
            content: concept.content,
            position: index / aiResult.concepts.length,
            isIntro: index === 0,
            isOutro: index === aiResult.concepts.length - 1,
            aiGenerated: true
        }));

        console.log(`✅ AI extracted ${concepts.length} coherent concepts`);
        return concepts;

    } catch (error) {
        console.log('⚠️ AI processing failed, using heuristic fallback:', error.message);
        return extractConceptsHeuristic(transcript, slideCount);
    }
}

/**
 * Generate slide prompts for image generation
 */
function generateSlidePrompts(concepts, style = 'modern') {
    const styleGuides = {
        modern: 'Modern minimalist design with bold typography, gradient background, clean geometric shapes',
        vibrant: 'Vibrant colorful design with dynamic gradients, bold colors, energetic composition',
        professional: 'Professional corporate design with clean lines, subtle gradients, elegant typography',
        creative: 'Creative artistic design with abstract shapes, artistic elements, unique composition'
    };

    const baseStyle = styleGuides[style] || styleGuides.modern;

    return concepts.map((concept, index) => ({
        slideNumber: concept.slideNumber,
        prompt: `Instagram carousel slide, ${baseStyle}. Title: "${concept.title}". Key message displayed prominently. Slide ${index + 1} of ${concepts.length}. Professional social media content, 1080x1350 pixels, portrait orientation. Text should be large and readable. High quality, polished design.`,
        concept
    }));
}

module.exports = {
    extractConcepts,
    extractConceptsHeuristic,
    generateSlidePrompts,
    cleanText,
    splitIntoSentences
};
