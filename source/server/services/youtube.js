/**
 * YouTube Service
 * Extracts video ID and gets transcript using Apify
 */

const apifyService = require('./apifyTranscriptionService');

/**
 * Extract video ID from various YouTube URL formats
 */
function extractVideoId(url) {
    if (!url) return null;

    const patterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([^&\n?#]+)/,
        /^([a-zA-Z0-9_-]{11})$/ // Direct video ID
    ];

    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match && match[1]) {
            return match[1];
        }
    }

    return null;
}

/**
 * Get transcript from a YouTube video using Apify
 */
async function getTranscript(videoId) {
    if (!apifyService.isAvailable()) {
        throw new Error('APIFY_API_KEY is required. Configure it in your .env file.');
    }

    console.log(`🎬 Getting transcript for video ${videoId} via Apify...`);
    return await apifyService.getTranscript(videoId);
}

/**
 * Validate if URL is a valid YouTube URL
 */
function isValidYoutubeUrl(url) {
    return extractVideoId(url) !== null;
}

module.exports = {
    extractVideoId,
    getTranscript,
    isValidYoutubeUrl
};
