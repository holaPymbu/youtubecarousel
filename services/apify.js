const { ApifyClient } = require('apify-client');

const client = new ApifyClient({
    token: process.env.APIFY_API_KEY,
});

/**
 * Extract transcript from YouTube URL using Apify actor karamelo~youtube-transcripts
 */
async function getTranscript(url) {
    if (!process.env.APIFY_API_KEY) {
        throw new Error('APIFY_API_KEY no está configurada');
    }

    const input = {
        urls: [url],
        outputFormat: 'singleStringText',
    };

    const run = await client.actor('karamelo~youtube-transcripts').call(input, {
        waitSecs: 120,
    });

    const { items } = await client.dataset(run.defaultDatasetId).listItems();

    if (!items || items.length === 0) {
        throw new Error('No se pudo obtener la transcripción. Verifica que el video tenga subtítulos disponibles.');
    }

    const item = items[0];

    if (item.error) {
        throw new Error(`Error de Apify: ${item.error}`);
    }

    const transcript = item.captions || item.text || item.transcript || item.content || '';
    if (!transcript || transcript.trim().length === 0) {
        throw new Error('La transcripción está vacía. El video podría no tener subtítulos.');
    }

    // Extract video ID for thumbnail
    let videoId = '';
    const match = url.match(/(?:v=|\/shorts\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    if (match) {
        videoId = match[1];
    }

    return {
        transcript: transcript.trim(),
        title: item.title || '',
        thumbnail: videoId ? `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg` : '',
        videoId,
    };
}

module.exports = { getTranscript };
