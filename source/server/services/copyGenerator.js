/**
 * Genera copy para Instagram (descripción y hashtags) desde los conceptos
 * Usa Gemini AI para generar copy contextual, con fallback estático
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');

// Models to try in order (same fallback chain as aiProcessor)
const MODELS = ['gemini-2.0-flash', 'gemini-2.5-flash', 'gemini-2.0-flash-lite'];

/**
 * Get Gemini client
 */
function getGenAI() {
    if (!process.env.GEMINI_API_KEY) {
        return null;
    }
    return new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
}

/**
 * Try generating content with model fallback
 */
async function generateWithFallback(genAI, prompt) {
    let lastError = null;
    for (const modelName of MODELS) {
        try {
            const model = genAI.getGenerativeModel({ model: modelName });
            const result = await model.generateContent(prompt);
            return result.response.text();
        } catch (error) {
            lastError = error;
            if (!error.message.includes('429') && !error.message.includes('quota') && !error.message.includes('rate')) {
                throw error;
            }
        }
    }
    throw lastError;
}

/**
 * Generar copy con IA basado en los conceptos reales del video
 */
async function generateCopyWithAI(concepts, transcript) {
    const genAI = getGenAI();
    if (!genAI) {
        console.log('⚠️ No GEMINI_API_KEY, using static copy generation');
        return null;
    }

    const conceptsSummary = concepts
        .map((c, i) => `${i + 1}. ${c.title}: ${c.content}`)
        .join('\n');

    const prompt = `Eres un community manager experto en Instagram. Genera el copy para acompañar un carrusel de Instagram basado en estos conceptos extraídos de un video:

${conceptsSummary}

Contexto del video (primeros 2000 chars del transcript):
${transcript.text.substring(0, 2000)}

Genera un JSON con:
1. "caption": Descripción para Instagram (máximo 300 caracteres). Debe:
   - Empezar con un HOOK que genere curiosidad (pregunta retórica, dato impactante, o afirmación provocadora)
   - Mencionar brevemente qué encontrará en el carrusel (sin listar todo)
   - Terminar con un CTA claro (guardar, compartir, comentar)
   - Usar máximo 3 emojis estratégicamente colocados
   - Escribir en el MISMO idioma del transcript/conceptos

2. "hashtags": Array de 12-15 hashtags RELEVANTES al tema específico del video. NO uses hashtags genéricos como #motivacion o #exito a menos que el video sea específicamente sobre eso. Los hashtags deben reflejar el TEMA REAL del video.

Responde ÚNICAMENTE con JSON válido (sin markdown, sin backticks):
{"caption":"...", "hashtags":["#tag1","#tag2",...]}`;

    try {
        const responseText = await generateWithFallback(genAI, prompt);

        // Robust JSON parsing (same as aiProcessor)
        let cleaned = responseText
            .replace(/```json\n?/g, '')
            .replace(/```\n?/g, '')
            .trim();

        let parsed;
        try {
            parsed = JSON.parse(cleaned);
        } catch (e) {
            // Fix common LLM JSON issues
            const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
            if (jsonMatch) cleaned = jsonMatch[0];
            cleaned = cleaned.replace(/"([^"]*)"/g, (match, content) => {
                return `"${content.replace(/\n/g, ' ').replace(/\r/g, '').replace(/\t/g, ' ')}"`;
            });
            cleaned = cleaned.replace(/,\s*([}\]])/g, '$1');
            parsed = JSON.parse(cleaned);
        }

        console.log('✅ AI-generated Instagram copy');
        return parsed;
    } catch (error) {
        console.error('⚠️ AI copy generation failed:', error.message);
        return null;
    }
}

/**
 * Fallback: Generar descripción estática para Instagram
 */
function generateCaptionStatic(concepts) {
    const mainPoints = concepts
        .slice(0, 5)
        .map((c, i) => `${i + 1}. ${c.content}`)
        .join('\n\n');

    return `✨ ¡Desliza para ver las ideas clave! ✨

${mainPoints}

💡 ¡Guarda esta publicación para después!
👉 Comparte con alguien que necesite ver esto

¿Qué punto te resonó más? ¡Déjalo en los comentarios! 👇`;
}

/**
 * Fallback: Generar hashtags estáticos basados en keywords del contenido
 */
function generateHashtagsStatic(concepts, transcript) {
    const baseHashtags = [
        '#conocimiento', '#aprendizaje', '#educacion',
        '#consejos', '#insights', '#crecimientopersonal',
        '#carrusel', '#infografia'
    ];

    const contentHashtags = [];
    const text = transcript.text.toLowerCase();

    const topicMap = {
        negocio: ['#negocios', '#emprendedor'],
        business: ['#negocios', '#emprendedor'],
        tecnología: ['#tecnologia', '#tech'],
        tech: ['#tecnologia', '#tech'],
        marketing: ['#marketing', '#marketingdigital'],
        finanzas: ['#finanzas', '#inversiones'],
        finance: ['#finanzas', '#inversiones'],
        salud: ['#salud', '#bienestar'],
        health: ['#salud', '#bienestar'],
        productividad: ['#productividad', '#habitos'],
        productivity: ['#productividad', '#habitos'],
        liderazgo: ['#liderazgo', '#gestion'],
        leadership: ['#liderazgo', '#gestion']
    };

    for (const [topic, hashtags] of Object.entries(topicMap)) {
        if (text.includes(topic)) {
            contentHashtags.push(...hashtags);
        }
    }

    const allHashtags = [...new Set([...contentHashtags, ...baseHashtags])];
    return allHashtags.slice(0, 15);
}

/**
 * Generar copy completo para Instagram (IA con fallback estático)
 */
async function generateCopy(concepts, transcript) {
    // Try AI generation first
    const aiCopy = await generateCopyWithAI(concepts, transcript);

    let caption, hashtags;

    if (aiCopy && aiCopy.caption && aiCopy.hashtags) {
        caption = aiCopy.caption;
        hashtags = aiCopy.hashtags;
    } else {
        caption = generateCaptionStatic(concepts);
        hashtags = generateHashtagsStatic(concepts, transcript);
    }

    const hashtagsString = Array.isArray(hashtags) ? hashtags.join(' ') : hashtags;

    return {
        caption,
        hashtags: hashtagsString,
        hashtagsList: Array.isArray(hashtags) ? hashtags : hashtagsString.split(' '),
        cta: '💾 ¡Guarda esta publicación como referencia!',
        fullPost: `${caption}\n\n${hashtagsString}`,
        characterCount: caption.length + hashtagsString.length + 2
    };
}

module.exports = {
    generateCopy,
    generateCaptionStatic,
    generateHashtagsStatic
};
