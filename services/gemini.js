const { GoogleGenerativeAI } = require('@google/generative-ai');

const MODELS = ['gemini-2.0-flash', 'gemini-2.5-flash', 'gemini-2.0-flash-lite'];

let genAI = null;

function getClient() {
    if (!genAI) {
        if (!process.env.GEMINI_API_KEY) {
            throw new Error('GEMINI_API_KEY no está configurada');
        }
        genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    }
    return genAI;
}

/**
 * Robust JSON parser — fixes common LLM output issues
 */
function robustJsonParse(text) {
    // Strip markdown code blocks
    let cleaned = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();

    // Try direct parse first
    try {
        return JSON.parse(cleaned);
    } catch (e) {
        // Continue with repair
    }

    // Fix common issues
    // Remove trailing commas before } or ]
    cleaned = cleaned.replace(/,\s*([}\]])/g, '$1');
    // Fix unescaped newlines inside strings
    cleaned = cleaned.replace(/(?<=:\s*"[^"]*)\n([^"]*")/g, '\\n$1');
    // Fix single quotes used as string delimiters
    cleaned = cleaned.replace(/(?<=[{,[\s])'/g, '"').replace(/'(?=[}\],:\s])/g, '"');

    try {
        return JSON.parse(cleaned);
    } catch (e) {
        // Continue with regex extraction
    }

    // Regex fallback: extract array of objects
    const objectPattern = /\{[^{}]*\}/g;
    const objects = cleaned.match(objectPattern);
    if (objects && objects.length > 0) {
        const parsed = [];
        for (const obj of objects) {
            try {
                parsed.push(JSON.parse(obj));
            } catch (e) {
                // Try to extract key-value pairs manually
                const titleMatch = obj.match(/["']?title["']?\s*:\s*["']([^"']+)["']/);
                const contentMatch = obj.match(/["']?content["']?\s*:\s*["']([^"']+)["']/);
                if (titleMatch && contentMatch) {
                    parsed.push({ title: titleMatch[1], content: contentMatch[1] });
                }
            }
        }
        if (parsed.length > 0) return parsed;
    }

    throw new Error('No se pudo parsear la respuesta de la IA');
}

/**
 * Call Gemini with model fallback
 */
async function callGemini(prompt, modelIndex = 0) {
    if (modelIndex >= MODELS.length) {
        throw new Error('Todos los modelos de Gemini fallaron');
    }

    const modelName = MODELS[modelIndex];
    console.log(`Trying Gemini model: ${modelName}`);

    try {
        const client = getClient();
        const model = client.getGenerativeModel({ model: modelName });
        const result = await model.generateContent(prompt);
        const response = result.response;
        return response.text();
    } catch (error) {
        console.warn(`Model ${modelName} failed:`, error.message);
        return callGemini(prompt, modelIndex + 1);
    }
}

/**
 * Generate slide concepts from transcript
 */
async function generateSlides(transcript, slideCount = 7, title = '') {
    const truncated = transcript.substring(0, 12000);

    const prompt = `Eres un experto en contenido para Instagram. Analiza la siguiente transcripción de un video de YouTube y extrae exactamente ${slideCount} conceptos clave.

REGLAS IMPORTANTES:
- NO copies frases literales de la transcripción. SINTETIZA y reformula las ideas.
- Cada concepto debe ser claro, conciso y valioso por sí solo.
- Adapta el tono para redes sociales: directo, accionable, interesante.
- Respeta el idioma original del contenido.
- Si el contenido está en español, responde en español. Si está en inglés, responde en inglés.

${title ? `Título del video: "${title}"` : ''}

Transcripción:
"""
${truncated}
"""

Responde ÚNICAMENTE con un array JSON válido con exactamente ${slideCount} objetos, cada uno con:
- "title": título corto del concepto (máx 8 palabras)
- "content": explicación clara del concepto (2-3 oraciones, máx 200 caracteres)

Ejemplo de formato:
[
  {"title": "Título del concepto", "content": "Explicación clara y concisa del concepto."},
  ...
]

IMPORTANTE: Responde SOLO con el JSON, sin texto adicional.`;

    const text = await callGemini(prompt);
    const slides = robustJsonParse(text);

    if (!Array.isArray(slides)) {
        throw new Error('La respuesta de Gemini no es un array');
    }

    return slides.slice(0, slideCount).map((s, i) => ({
        number: i + 2, // Slide 1 is the cover
        title: s.title || `Concepto ${i + 1}`,
        content: s.content || '',
    }));
}

/**
 * Generate Instagram caption
 */
async function generateCaption(title, slides) {
    const slidesSummary = slides.map(s => `- ${s.title}: ${s.content}`).join('\n');

    const prompt = `Eres un copywriter experto en Instagram. Genera el copy para acompañar un carrusel de Instagram basado en el siguiente contenido.

Título del video: "${title}"

Contenido de las diapositivas:
${slidesSummary}

REGLAS:
- Respeta el idioma del contenido (si está en español, escribe en español; si está en inglés, en inglés).
- El copy debe tener un HOOK potente en la primera línea (pregunta o afirmación que atrape).
- Incluir un CTA claro al final (guardar, compartir, comentar).
- Usar emojis de forma moderada y estratégica.
- Incluir 10-15 hashtags relevantes al tema.

Responde ÚNICAMENTE con un JSON válido con esta estructura:
{
  "description": "El copy completo aquí (hook + contenido + CTA)",
  "hashtags": "#hashtag1 #hashtag2 #hashtag3 ..."
}

IMPORTANTE: Responde SOLO con el JSON, sin texto adicional.`;

    const text = await callGemini(prompt);
    const caption = robustJsonParse(text);

    return {
        description: caption.description || '',
        hashtags: caption.hashtags || '',
    };
}

module.exports = { generateSlides, generateCaption };
