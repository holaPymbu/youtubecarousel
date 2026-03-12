/**
 * AI Content Processor using Google Gemini
 * Interprets transcripts and generates coherent slide content
 * Supports model fallback: gemini-2.0-flash → gemini-1.5-flash
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');

// Models to try in order (fallback chain for rate limits)
const MODELS = ['gemini-2.0-flash', 'gemini-2.5-flash', 'gemini-2.0-flash-lite'];

// Initialize Gemini client
function getGenAI() {
    if (!process.env.GEMINI_API_KEY) {
        throw new Error('GEMINI_API_KEY environment variable is required');
    }
    return new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
}

/**
 * Try generating content with model fallback
 * If the primary model fails (429, etc), tries the next model in the chain
 */
async function generateWithFallback(genAI, prompt) {
    let lastError = null;

    for (const modelName of MODELS) {
        try {
            console.log(`🤖 Trying model: ${modelName}...`);
            const model = genAI.getGenerativeModel({ model: modelName });
            const result = await model.generateContent(prompt);
            const responseText = result.response.text();
            console.log(`✅ Model ${modelName} succeeded`);
            return responseText;
        } catch (error) {
            console.error(`❌ Model ${modelName} failed: ${error.message}`);
            lastError = error;

            // Only retry with next model on rate limit or quota errors
            if (!error.message.includes('429') && !error.message.includes('quota') && !error.message.includes('rate')) {
                throw error; // Non-retryable error, don't try other models
            }
        }
    }

    throw lastError;
}

/**
 * Process transcript with AI to extract coherent concepts for slides
 */
async function processTranscript(transcript, options = {}) {
    const genAI = getGenAI();
    const slideCount = options.slideCount || 5;

    const prompt = `Eres un experto en content marketing especializado en crear carruseles virales de Instagram. Tu trabajo es transformar transcripts de videos de YouTube en diapositivas que la gente guarde, comparta y recuerde.

PASO 1 — ANÁLISIS PREVIO (no incluir en la respuesta):
- Lee todo el transcript
- Identifica la TESIS CENTRAL del video (¿de qué habla realmente?)
- Detecta los ${slideCount} puntos más valiosos, priorizando: tips concretos, datos con números, métodos paso a paso, errores comunes, revelaciones sorprendentes

PASO 2 — GENERA ${slideCount} SLIDES:

Para cada slide genera:
1. **title**: Un título GANCHO de máximo 5 palabras que resuma el punto clave de esa slide. Sin emojis. Debe ser claro y directo.
2. **content**: El contenido ESPECÍFICO de esa slide (entre 80 y 180 caracteres). Debe ser:
   - AUTO-CONTENIDO: se entiende solo, sin necesidad de leer las otras slides
   - CONCRETO: incluir números, datos, ejemplos o pasos específicos del video
   - RESUMIDO: sintetiza la idea, NO copies frases literales del transcript

REGLAS ESTRICTAS:
- ❌ PROHIBIDO copiar frases textuales del transcript
- ❌ PROHIBIDO contenido genérico como "Es importante tener disciplina" o "Debes trabajar duro"
- ❌ PROHIBIDO repetir ideas entre slides
- ❌ PROHIBIDO inventar datos que no estén en el transcript
- ✅ RESUME y SINTETIZA cada punto con tus propias palabras
- ✅ Si el video menciona un número, porcentaje o estadística → INCLUIRLO
- ✅ Si el video da un método o framework → DESCRIBIRLO con pasos claros
- ✅ Escribe en el MISMO idioma del transcript
- ✅ Cada slide debe aportar VALOR REAL al lector
- ✅ Usa la ORTOGRAFÍA CORRECTA de términos técnicos: "JSON" (no "Jason"), "API" (no "Api"), "SQL" (no "Sequel"), "HTML", "CSS", "JavaScript", etc.

La primera slide debe resumir la PROMESA del video (qué va a aprender el lector).
La última slide debe cerrar con una conclusión memorable.

Transcript:
${transcript.text.substring(0, 12000)}

Responde ÚNICAMENTE con JSON válido (sin markdown, sin backticks):
{"concepts":[{"title":"...", "content":"..."}]}`;

    try {
        const responseText = await generateWithFallback(genAI, prompt);
        const parsed = parseAIResponse(responseText);
        // Sanitize tech terms in all concepts
        if (parsed.concepts) {
            parsed.concepts = parsed.concepts.map(c => ({
                ...c,
                title: sanitizeTechTerms(c.title),
                content: sanitizeTechTerms(c.content)
            }));
        }
        console.log(`✅ AI processed ${parsed.concepts.length} concepts`);
        return parsed;
    } catch (error) {
        console.error('❌ AI processing error:', error.message);
        throw error;
    }
}

/**
 * Sanitize common LLM phonetic errors in tech terminology
 * LLMs sometimes write phonetic versions of tech terms (e.g. "Jason" for "JSON")
 */
function sanitizeTechTerms(text) {
    if (!text) return text;
    return text
        .replace(/\bJason\b/g, 'JSON')
        .replace(/\bjason\b/g, 'JSON')
        .replace(/\bJASON\b/g, 'JSON')
        .replace(/\bjayson\b/gi, 'JSON')
        .replace(/\bApi\b/g, 'API')
        .replace(/\bHtml\b/g, 'HTML')
        .replace(/\bCss\b/g, 'CSS')
        .replace(/\bSql\b/g, 'SQL')
        .replace(/\bUrl\b/g, 'URL')
        .replace(/\bIa\b/g, 'IA')
        .replace(/\bJavascript\b/g, 'JavaScript')
        .replace(/\bTypescript\b/g, 'TypeScript');
}

/**
 * Robustly parse AI response that may contain malformed JSON
 * Handles: markdown wrapping, unescaped quotes, newlines in values, trailing commas
 */
function parseAIResponse(responseText) {
    // Step 1: Remove markdown code blocks
    let cleaned = responseText
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();

    // Step 2: Try direct parse first
    try {
        return JSON.parse(cleaned);
    } catch (e) {
        console.log('⚠️ Direct JSON parse failed, attempting repair...');
    }

    // Step 3: Try to extract JSON object from the text
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
        cleaned = jsonMatch[0];
    }

    // Step 4: Fix common JSON issues from LLMs
    // Fix unescaped newlines within string values
    cleaned = cleaned.replace(/"([^"]*)"/g, (match, content) => {
        const fixed = content
            .replace(/\n/g, ' ')
            .replace(/\r/g, '')
            .replace(/\t/g, ' ');
        return `"${fixed}"`;
    });

    // Remove trailing commas before } or ]
    cleaned = cleaned.replace(/,\s*([}\]])/g, '$1');

    try {
        return JSON.parse(cleaned);
    } catch (e) {
        console.log('⚠️ Repaired JSON parse also failed, trying regex extraction...');
    }

    // Step 5: Last resort — extract concepts with regex
    const concepts = [];
    const titleContentRegex = /"title"\s*:\s*"([^"]+)"\s*,\s*"content"\s*:\s*"([^"]+)"/g;
    let match;
    while ((match = titleContentRegex.exec(cleaned)) !== null) {
        concepts.push({ title: match[1], content: match[2] });
    }

    if (concepts.length > 0) {
        console.log(`✅ Regex extraction recovered ${concepts.length} concepts`);
        return { concepts };
    }

    throw new Error('Could not parse AI response as JSON');
}

/**
 * Generate a short, attractive cover title from video title
 * Shortens long YouTube titles to 4-6 words max
 */
async function generateCoverTitle(videoTitle) {
    const genAI = getGenAI();

    const prompt = `Acorta este título de video de YouTube para que sea una portada de carrusel de Instagram.

Título original: "${videoTitle}"

Requisitos:
- Máximo 4-5 palabras
- Captura la ESENCIA del tema
- Atractivo y claro
- En el MISMO idioma que el original
- Sin emojis, sin comillas, sin dos puntos
- NO agregues palabras que no estén en el original a menos que sea necesario para claridad

Responde SOLO con el título corto, nada más.`;

    try {
        const title = await generateWithFallback(genAI, prompt);
        const cleanTitle = title.trim().replace(/['"]/g, '');
        console.log(`✅ Generated cover title: "${cleanTitle}" (from "${videoTitle}")`);
        return cleanTitle;
    } catch (error) {
        console.error('❌ Cover title generation error:', error.message);
        // Fallback: take first 4 meaningful words
        const words = videoTitle.split(/[\s:|\-–—]+/).filter(w => w.length > 2).slice(0, 4);
        return words.join(' ');
    }
}

/**
 * Transcribe video using Gemini's video understanding
 * Fallback when YouTube transcript is not available
 */
async function transcribeWithGemini(videoId) {
    const genAI = getGenAI();

    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

    const prompt = `Mira este video de YouTube y genera una transcripción detallada del contenido hablado.
    
Video: ${videoUrl}

Genera una transcripción completa del audio/narración del video. Si no puedes acceder al video directamente, indica que no es posible.

Responde SOLO con el texto de la transcripción, sin marcas de tiempo ni formato especial.`;

    try {
        const transcriptText = await generateWithFallback(genAI, prompt);

        if (transcriptText.length < 100) {
            throw new Error('Transcription too short or failed');
        }

        console.log(`✅ Gemini transcription generated (${transcriptText.length} chars)`);
        return {
            text: transcriptText.trim(),
            segments: [],
            videoTitle: 'Unknown',
            duration: 0,
            source: 'gemini-fallback'
        };
    } catch (error) {
        console.error('❌ Gemini transcription error:', error.message);
        throw new Error('Could not transcribe video with AI fallback');
    }
}

module.exports = {
    processTranscript,
    generateCoverTitle,
    transcribeWithGemini
};
