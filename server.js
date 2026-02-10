require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { getTranscript } = require('./services/apify');
const { generateSlides, generateCaption } = require('./services/gemini');
const { generateImages } = require('./services/imageGenerator');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Extract transcript from YouTube URL via Apify
app.post('/api/transcript', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ error: 'URL es requerida' });
    }
    const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|shorts\/)|youtu\.be\/)/;
    if (!youtubeRegex.test(url)) {
      return res.status(400).json({ error: 'URL de YouTube no válida' });
    }
    const result = await getTranscript(url);
    res.json(result);
  } catch (error) {
    console.error('Transcript error:', error);
    res.status(500).json({ error: error.message || 'Error al obtener la transcripción' });
  }
});

// Generate slides content and caption using Gemini
app.post('/api/generate', async (req, res) => {
  try {
    const { transcript, slideCount, title } = req.body;
    if (!transcript) {
      return res.status(400).json({ error: 'Transcripción es requerida' });
    }
    const count = parseInt(slideCount) || 7;
    const slides = await generateSlides(transcript, count, title);
    const caption = await generateCaption(title || '', slides);
    res.json({ slides, caption });
  } catch (error) {
    console.error('Generate error:', error);
    res.status(500).json({ error: error.message || 'Error al generar contenido' });
  }
});

// Generate final slide images
app.post('/api/generate-images', async (req, res) => {
  try {
    const { slides, title, thumbnail, videoTitle } = req.body;
    if (!slides || !slides.length) {
      return res.status(400).json({ error: 'Slides son requeridos' });
    }
    const images = await generateImages(slides, title, thumbnail, videoTitle);
    res.json({ images });
  } catch (error) {
    console.error('Image generation error:', error);
    res.status(500).json({ error: error.message || 'Error al generar imágenes' });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 YT→Carousel server running on http://localhost:${PORT}`);
});
