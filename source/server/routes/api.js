const express = require('express');
const router = express.Router();
const youtubeService = require('../services/youtube');
const conceptExtractor = require('../services/conceptExtractor');
const copyGenerator = require('../services/copyGenerator');
const imageGenerator = require('../services/imageGenerator');
const slideRenderer = require('../services/slideRenderer');

// Health check
router.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Demo endpoint with sample data
router.get('/demo', async (req, res) => {
    const sampleTranscript = {
        text: `Welcome to this comprehensive guide on productivity and time management. 
    The first key concept is the Pomodoro Technique, which involves working in focused 25-minute intervals followed by short breaks. 
    This method helps maintain concentration and prevents burnout. 
    The second important strategy is task batching, where you group similar tasks together to minimize context switching. 
    Studies show that context switching can reduce productivity by up to 40 percent. 
    Another crucial tip is to tackle your most important task first thing in the morning when your energy levels are highest. 
    This is often called eating the frog. 
    Digital minimalism is also essential in today's world. 
    Turn off unnecessary notifications and designate specific times to check email and social media. 
    Finally, remember that rest is productive. 
    Quality sleep and regular breaks actually improve your overall output. 
    The key to sustainable productivity is balance, not burnout.`
    };

    const concepts = await conceptExtractor.extractConcepts(sampleTranscript, 7);
    const copy = await copyGenerator.generateCopy(concepts, sampleTranscript);

    res.json({
        success: true,
        videoId: 'demo',
        videoTitle: 'Productivity & Time Management Tips',
        concepts,
        copy,
        slideCount: concepts.length,
        isDemo: true
    });
});

// Extract transcript from YouTube URL
router.post('/transcript', async (req, res) => {
    try {
        const { url } = req.body;

        if (!url) {
            return res.status(400).json({ error: 'URL is required' });
        }

        const videoId = youtubeService.extractVideoId(url);
        if (!videoId) {
            return res.status(400).json({ error: 'Invalid YouTube URL' });
        }

        const transcript = await youtubeService.getTranscript(videoId);
        res.json({ success: true, videoId, transcript });
    } catch (error) {
        console.error('Error extracting transcript:', error);
        res.status(500).json({ error: error.message || 'Failed to extract transcript' });
    }
});

// Process transcript and generate carousel data
router.post('/process', async (req, res) => {
    try {
        const { url, slideCount = 7, transcript: manualTranscript } = req.body;

        let transcript;
        let videoId = 'manual';
        let videoTitle = 'Custom Transcript';

        // If manual transcript provided, use it
        if (manualTranscript && manualTranscript.trim().length > 50) {
            transcript = { text: manualTranscript.trim() };
        } else if (url) {
            // Try to extract from YouTube
            videoId = youtubeService.extractVideoId(url);
            if (!videoId) {
                return res.status(400).json({ error: 'Invalid YouTube URL' });
            }

            try {
                const result = await youtubeService.getTranscript(videoId);
                transcript = result;
                videoTitle = result.videoTitle || 'YouTube Video';
            } catch (ytError) {
                return res.status(400).json({
                    error: ytError.message,
                    suggestion: 'You can paste the transcript manually in the text area below the URL input.'
                });
            }
        } else {
            return res.status(400).json({ error: 'URL or transcript text is required' });
        }

        // Step 2: Extract key concepts
        const concepts = await conceptExtractor.extractConcepts(transcript, slideCount);

        // Step 3: Generate Instagram copy
        const copy = await copyGenerator.generateCopy(concepts, transcript);

        res.json({
            success: true,
            videoId,
            videoTitle,
            concepts,
            copy,
            slideCount: concepts.length
        });
    } catch (error) {
        console.error('Error processing video:', error);
        res.status(500).json({ error: error.message || 'Failed to process video' });
    }
});

// Process manual transcript
router.post('/process-text', async (req, res) => {
    try {
        const { text, slideCount = 7 } = req.body;

        if (!text || text.trim().length < 50) {
            return res.status(400).json({ error: 'Please provide at least 50 characters of transcript text' });
        }

        const transcript = { text: text.trim() };
        const concepts = await conceptExtractor.extractConcepts(transcript, slideCount);
        const copy = await copyGenerator.generateCopy(concepts, transcript);

        res.json({
            success: true,
            videoId: 'manual',
            videoTitle: 'Custom Transcript',
            concepts,
            copy,
            slideCount: concepts.length
        });
    } catch (error) {
        console.error('Error processing text:', error);
        res.status(500).json({ error: error.message || 'Failed to process text' });
    }
});

// Generate slide images using Puppeteer (consistent HTML-to-image)
router.post('/generate-images', async (req, res) => {
    try {
        const { concepts, videoId, videoTitle } = req.body;

        if (!concepts || !Array.isArray(concepts) || concepts.length === 0) {
            return res.status(400).json({ error: 'Concepts array is required' });
        }

        // Check if slide rendering is available
        if (!slideRenderer.isRenderingAvailable()) {
            // Fallback to prompts only
            const slidePrompts = await imageGenerator.generateSlidePrompts(concepts, videoId, videoTitle);
            return res.json({
                success: true,
                slides: slidePrompts,
                thumbnailUrl: videoId && videoId !== 'manual' && videoId !== 'demo'
                    ? imageGenerator.getThumbnailUrl(videoId)
                    : null,
                message: 'Puppeteer not available. Returning prompts only.',
                promptsOnly: true
            });
        }

        // Generate slides using Puppeteer (consistent HTML rendering)
        console.log(`🎨 Starting slide rendering for ${concepts.length} slides...`);
        const generatedSlides = await slideRenderer.renderSlidesToImages(concepts, videoId, videoTitle);

        // Check how many succeeded
        const successCount = generatedSlides.filter(s => s.success).length;
        const failedCount = generatedSlides.filter(s => !s.success).length;

        res.json({
            success: true,
            slides: generatedSlides,
            thumbnailUrl: videoId && videoId !== 'manual' && videoId !== 'demo'
                ? imageGenerator.getThumbnailUrl(videoId)
                : null,
            message: `Generated ${successCount} images${failedCount > 0 ? `, ${failedCount} failed` : ''}`,
            stats: { total: concepts.length, success: successCount, failed: failedCount }
        });
    } catch (error) {
        console.error('Error generating images:', error);
        res.status(500).json({ error: error.message || 'Failed to generate images' });
    }
});


// Get YouTube thumbnail URL
router.get('/thumbnail/:videoId', (req, res) => {
    const { videoId } = req.params;

    if (!videoId || videoId.length !== 11) {
        return res.status(400).json({ error: 'Invalid video ID' });
    }

    res.json({
        success: true,
        thumbnailUrl: imageGenerator.getThumbnailUrl(videoId),
        videoId
    });
});

module.exports = router;
