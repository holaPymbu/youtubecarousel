/**
 * Slide Renderer Service
 * Generates consistent slide images using Puppeteer (HTML-to-image)
 * Cover uses YouTube thumbnail with Sharp compositing
 */

const puppeteer = require('puppeteer');
const sharp = require('sharp');
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { generateCoverTitle } = require('./aiProcessor');

// Ensure output directory exists
const OUTPUT_DIR = path.join(__dirname, '../../public/generated');
if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Instagram carousel dimensions
const SLIDE_WIDTH = 1080;
const SLIDE_HEIGHT = 1350;

/**
 * Download image from URL and return as buffer
 */
async function downloadImageBuffer(url) {
    return new Promise((resolve, reject) => {
        const protocol = url.startsWith('https') ? https : http;

        protocol.get(url, (response) => {
            if (response.statusCode === 301 || response.statusCode === 302) {
                return downloadImageBuffer(response.headers.location)
                    .then(resolve)
                    .catch(reject);
            }

            if (response.statusCode !== 200) {
                // Try fallback thumbnail quality
                if (url.includes('maxresdefault')) {
                    const fallbackUrl = url.replace('maxresdefault', 'hqdefault');
                    return downloadImageBuffer(fallbackUrl)
                        .then(resolve)
                        .catch(reject);
                }
                reject(new Error(`Failed to download: ${response.statusCode}`));
                return;
            }

            const chunks = [];
            response.on('data', chunk => chunks.push(chunk));
            response.on('end', () => resolve(Buffer.concat(chunks)));
            response.on('error', reject);
        }).on('error', reject);
    });
}

/**
 * Generate cover slide from YouTube thumbnail
 * Downloads thumbnail and adapts it to Instagram 4:5 format with overlay
 */
async function generateCoverFromThumbnail(videoId, title, outputFilename) {
    const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;

    try {
        console.log('📥 Downloading YouTube thumbnail...');
        const thumbnailBuffer = await downloadImageBuffer(thumbnailUrl);

        // Get thumbnail dimensions
        const metadata = await sharp(thumbnailBuffer).metadata();
        console.log(`📐 Thumbnail size: ${metadata.width}x${metadata.height}`);

        // Strategy: Crop thumbnail to fill 4:5 ratio, keeping center focus
        // YouTube is 16:9 = 1.78, Instagram is 4:5 = 0.8
        // We need to crop the sides significantly and may need to extend top/bottom

        // First resize to match width, then determine cropping
        const resizedToWidth = await sharp(thumbnailBuffer)
            .resize(SLIDE_WIDTH, null, { fit: 'cover' })
            .toBuffer();

        const resizedMeta = await sharp(resizedToWidth).metadata();

        // Calculate how much of the thumbnail we can use
        // Maximize thumbnail coverage - use 90% of slide height
        const thumbnailCoverHeight = Math.min(resizedMeta.height, Math.floor(SLIDE_HEIGHT * 0.90));

        // Crop/resize the thumbnail to fill most of the slide
        const croppedThumb = await sharp(resizedToWidth)
            .resize(SLIDE_WIDTH, thumbnailCoverHeight, { fit: 'cover', position: 'center' })
            .toBuffer();

        // Create gradient overlay SVG
        const gradientOverlay = `
            <svg width="${SLIDE_WIDTH}" height="${SLIDE_HEIGHT}">
                <defs>
                    <linearGradient id="fadeToBlack" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stop-color="rgba(0,0,0,0)"/>
                        <stop offset="50%" stop-color="rgba(0,0,0,0.2)"/>
                        <stop offset="75%" stop-color="rgba(0,0,0,0.6)"/>
                        <stop offset="100%" stop-color="rgba(15,15,35,1)"/>
                    </linearGradient>
                </defs>
                <rect width="100%" height="100%" fill="url(#fadeToBlack)"/>
            </svg>
        `;

        // Clean and escape title for SVG
        const cleanTitle = (title || 'Instagram Carousel')
            .replace(/[🎬🎯✨💡🔥⚡📌]/g, '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .trim();

        // Split long titles into multiple lines
        const maxCharsPerLine = 30;
        const words = cleanTitle.split(' ');
        const lines = [];
        let currentLine = '';

        for (const word of words) {
            if ((currentLine + ' ' + word).trim().length <= maxCharsPerLine) {
                currentLine = (currentLine + ' ' + word).trim();
            } else {
                if (currentLine) lines.push(currentLine);
                currentLine = word;
            }
        }
        if (currentLine) lines.push(currentLine);

        // Limit to 3 lines max
        const displayLines = lines.slice(0, 3);
        const lineHeight = 85;
        const baseY = 1120 - ((displayLines.length - 1) * lineHeight / 2);

        const titleTexts = displayLines.map((line, i) =>
            `<text x="540" y="${baseY + i * lineHeight}" text-anchor="middle" 
                   style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; 
                          font-size: 72px; font-weight: 800; fill: white;
                          text-shadow: 0 4px 30px rgba(0,0,0,0.8);">${line}</text>`
        ).join('\n');

        // Create text overlay with title and elements (no CAROUSEL badge)
        const textOverlay = `
            <svg width="${SLIDE_WIDTH}" height="${SLIDE_HEIGHT}">
                <!-- Title -->
                ${titleTexts}
                
                <!-- Divider -->
                <rect x="440" y="1230" width="200" height="6" rx="3" fill="url(#divGrad)"/>
                <defs>
                    <linearGradient id="divGrad" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stop-color="#e94560"/>
                        <stop offset="100%" stop-color="#f97316"/>
                    </linearGradient>
                </defs>
                
                <!-- Swipe text -->
                <text x="540" y="1300" text-anchor="middle" 
                      style="font-family: Arial, sans-serif; font-size: 28px; font-weight: 400; 
                             fill: rgba(255,255,255,0.7);">Desliza para explorar →</text>
                
                <!-- Corner decorations -->
                <rect x="50" y="50" width="120" height="120" rx="20" fill="none" 
                      stroke="rgba(233,69,96,0.3)" stroke-width="3"/>
                <rect x="${SLIDE_WIDTH - 170}" y="${SLIDE_HEIGHT - 170}" width="120" height="120" rx="20" 
                      fill="none" stroke="rgba(233,69,96,0.3)" stroke-width="3"/>
            </svg>
        `;

        // Compose final image
        const finalImage = await sharp({
            create: {
                width: SLIDE_WIDTH,
                height: SLIDE_HEIGHT,
                channels: 4,
                background: { r: 15, g: 15, b: 35, alpha: 1 }
            }
        })
            .composite([
                {
                    input: croppedThumb,
                    top: 0,
                    left: 0
                },
                {
                    input: Buffer.from(gradientOverlay),
                    top: 0,
                    left: 0
                },
                {
                    input: Buffer.from(textOverlay),
                    top: 0,
                    left: 0
                }
            ])
            .png()
            .toBuffer();

        const outputPath = path.join(OUTPUT_DIR, outputFilename);
        await fs.promises.writeFile(outputPath, finalImage);

        console.log(`✅ Cover slide generated with thumbnail: ${outputFilename}`);
        return `/generated/${outputFilename}`;

    } catch (error) {
        console.error('❌ Error generating cover from thumbnail:', error.message);
        throw error;
    }
}

/**
 * Generate HTML for a content slide
 * Uses system fonts for reliability (no external dependencies)
 * Optimized font sizes for readability
 */
function getSlideHTML(slideNumber, totalSlides, title, content) {
    const paddedNumber = String(slideNumber).padStart(2, '0');
    const progressPercent = Math.round((slideNumber / totalSlides) * 100);

    return `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                * {
                    margin: 0;
                    padding: 0;
                    box-sizing: border-box;
                }
                body {
                    width: ${SLIDE_WIDTH}px;
                    height: ${SLIDE_HEIGHT}px;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                    background: linear-gradient(165deg, #1a1a2e 0%, #0f3460 100%);
                    color: white;
                    display: flex;
                    flex-direction: column;
                    padding: 90px;
                    position: relative;
                    overflow: hidden;
                }
                .slide-number {
                    font-size: 200px;
                    font-weight: 900;
                    color: #e94560;
                    line-height: 1;
                    margin-bottom: 40px;
                }
                .slide-title {
                    font-size: 64px;
                    font-weight: 700;
                    line-height: 1.15;
                    margin-bottom: 50px;
                    max-width: 95%;
                }
                .divider {
                    width: 100px;
                    height: 6px;
                    background: linear-gradient(90deg, #e94560, #f97316);
                    border-radius: 3px;
                    margin-bottom: 50px;
                }
                .slide-content {
                    font-size: 50px;
                    font-weight: 400;
                    line-height: 1.45;
                    color: rgba(255, 255, 255, 0.9);
                    max-width: 95%;
                    flex-grow: 1;
                }
                .progress-container {
                    position: absolute;
                    bottom: 90px;
                    left: 90px;
                    right: 90px;
                }
                .progress-bar {
                    width: 100%;
                    height: 8px;
                    background: rgba(255, 255, 255, 0.15);
                    border-radius: 4px;
                    overflow: hidden;
                }
                .progress-fill {
                    width: ${progressPercent}%;
                    height: 100%;
                    background: linear-gradient(90deg, #e94560, #f97316);
                    border-radius: 4px;
                }
                .slide-indicator {
                    position: absolute;
                    bottom: 110px;
                    right: 90px;
                    font-size: 26px;
                    color: rgba(255, 255, 255, 0.6);
                    font-weight: 500;
                }
            </style>
        </head>
        <body>
            <div class="slide-number">${paddedNumber}</div>
            <h1 class="slide-title">${title}</h1>
            <div class="divider"></div>
            <p class="slide-content">${content}</p>
            <div class="progress-container">
                <div class="progress-bar">
                    <div class="progress-fill"></div>
                </div>
            </div>
            <div class="slide-indicator">${slideNumber}/${totalSlides}</div>
        </body>
        </html>
    `;
}

// Load CTA logo as base64 at startup
let CTA_LOGO_BASE64 = '';
const logoPath = path.join(__dirname, '../../public/assets/logo_ia.png');
if (fs.existsSync(logoPath)) {
    CTA_LOGO_BASE64 = fs.readFileSync(logoPath).toString('base64');
    console.log('✅ CTA logo loaded');
} else {
    console.warn('⚠️ CTA logo not found at', logoPath);
}

/**
 * Generate HTML for the CTA (Call To Action) slide
 * Always the last slide in every carousel
 */
function getCtaSlideHTML(totalSlides) {
    const logoImg = CTA_LOGO_BASE64
        ? `<img src="data:image/png;base64,${CTA_LOGO_BASE64}" style="width: 400px; height: auto; margin-bottom: 60px;" />`
        : '';

    return `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                * {
                    margin: 0;
                    padding: 0;
                    box-sizing: border-box;
                }
                body {
                    width: ${SLIDE_WIDTH}px;
                    height: ${SLIDE_HEIGHT}px;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                    background: linear-gradient(165deg, #1a1a2e 0%, #0f3460 100%);
                    color: white;
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                    align-items: center;
                    text-align: center;
                    padding: 90px;
                    position: relative;
                    overflow: hidden;
                }
                .logo {
                    margin-bottom: 60px;
                }
                .cta-main {
                    font-size: 56px;
                    font-weight: 700;
                    line-height: 1.25;
                    margin-bottom: 70px;
                    max-width: 90%;
                }
                .cta-highlight {
                    background: linear-gradient(90deg, #e94560, #f97316);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    background-clip: text;
                }
                .cta-action {
                    font-size: 48px;
                    font-weight: 600;
                    color: rgba(255, 255, 255, 0.95);
                    margin-bottom: 20px;
                }
                .cta-keyword {
                    display: inline-block;
                    font-size: 52px;
                    font-weight: 800;
                    background: linear-gradient(90deg, #e94560, #f97316);
                    padding: 12px 40px;
                    border-radius: 16px;
                    margin-top: 20px;
                    color: white;
                }
                .divider {
                    width: 140px;
                    height: 6px;
                    background: linear-gradient(90deg, #e94560, #f97316);
                    border-radius: 3px;
                    margin-bottom: 70px;
                }
                .progress-container {
                    position: absolute;
                    bottom: 90px;
                    left: 90px;
                    right: 90px;
                }
                .progress-bar {
                    width: 100%;
                    height: 8px;
                    background: rgba(255, 255, 255, 0.15);
                    border-radius: 4px;
                    overflow: hidden;
                }
                .progress-fill {
                    width: 100%;
                    height: 100%;
                    background: linear-gradient(90deg, #e94560, #f97316);
                    border-radius: 4px;
                }
                .slide-indicator {
                    position: absolute;
                    bottom: 110px;
                    right: 90px;
                    font-size: 26px;
                    color: rgba(255, 255, 255, 0.6);
                    font-weight: 500;
                }
                /* Corner decorations */
                .corner-tl, .corner-br {
                    position: absolute;
                    width: 100px;
                    height: 100px;
                    border-radius: 16px;
                    border: 3px solid rgba(233, 69, 96, 0.25);
                }
                .corner-tl { top: 50px; left: 50px; }
                .corner-br { bottom: 140px; right: 50px; }
            </style>
        </head>
        <body>
            <div class="corner-tl"></div>
            <div class="corner-br"></div>
            <div class="logo">${logoImg}</div>
            <p class="cta-main">
                Aprende a crear y vender soluciones con <span class="cta-highlight">IA y Vibe Coding</span>
            </p>
            <div class="divider"></div>
            <p class="cta-action">Comentá</p>
            <span class="cta-keyword">"quiero"</span>
            <div class="progress-container">
                <div class="progress-bar">
                    <div class="progress-fill"></div>
                </div>
            </div>
            <div class="slide-indicator">${totalSlides}/${totalSlides}</div>
        </body>
        </html>
    `;
}

/**
 * Render HTML slides to images using Puppeteer
 */
async function renderSlidesToImages(concepts, videoId, videoTitle, onProgress) {
    const slides = [];
    const total = concepts.length + 1; // +1 for CTA slide
    const timestamp = Date.now();

    let browser = null;

    try {
        console.log('🚀 Launching Puppeteer browser...');

        // Use system Chrome if available (for Render deployment)
        const launchOptions = {
            headless: 'new',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--single-process'
            ]
        };

        // Check for Chrome path from environment (Render deployment)
        if (process.env.PUPPETEER_EXECUTABLE_PATH) {
            launchOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
            console.log(`📍 Using Chrome at: ${launchOptions.executablePath}`);
        }

        browser = await puppeteer.launch(launchOptions);

        const page = await browser.newPage();
        await page.setViewport({ width: SLIDE_WIDTH, height: SLIDE_HEIGHT });

        for (let i = 0; i < concepts.length; i++) {
            const concept = concepts[i];
            const isCover = i === 0;
            const slideNum = concept.slideNumber ?? (i + 1);

            console.log(`🖼️ Generating slide ${i + 1}/${total}...`);
            if (onProgress) onProgress(i + 1, total);

            try {
                let filename;
                let url;

                if (isCover && videoId && videoId !== 'manual' && videoId !== 'demo') {
                    // Generate cover from YouTube thumbnail (with creator's face)
                    filename = `slide_01_cover_${timestamp}.png`;
                    // Use AI to shorten the video title for the cover
                    let coverTitle = videoTitle || concept.title || 'Instagram Carousel';
                    try {
                        coverTitle = await generateCoverTitle(coverTitle);
                    } catch (e) {
                        console.log('⚠️ Could not shorten cover title, using original');
                        // Fallback: just take first 5 words
                        coverTitle = coverTitle.split(/[\s:|\.\-–—]+/).filter(w => w.length > 1).slice(0, 5).join(' ');
                    }
                    url = await generateCoverFromThumbnail(videoId, coverTitle, filename);
                } else {
                    // Generate content slide with Puppeteer
                    filename = `slide_${String(slideNum).padStart(2, '0')}_content_${timestamp}.png`;
                    const cleanTitle = concept.title.replace(/[🎬🎯✨💡🔥⚡📌]/g, '').trim();
                    const html = getSlideHTML(slideNum, total, cleanTitle, concept.content || '');

                    await page.setContent(html, { waitUntil: 'domcontentloaded' });

                    // Small delay to ensure rendering is complete
                    await new Promise(r => setTimeout(r, 200));

                    const outputPath = path.join(OUTPUT_DIR, filename);
                    await page.screenshot({
                        path: outputPath,
                        type: 'png',
                        clip: { x: 0, y: 0, width: SLIDE_WIDTH, height: SLIDE_HEIGHT }
                    });

                    url = `/generated/${filename}`;
                    console.log(`✅ Slide ${i + 1} rendered: ${filename}`);
                }

                slides.push({
                    slideNumber: slideNum,
                    type: isCover ? 'cover' : 'content',
                    title: concept.title,
                    filename: filename,
                    url: url,
                    success: true
                });

            } catch (error) {
                console.error(`❌ Failed to generate slide ${i + 1}:`, error.message);
                slides.push({
                    slideNumber: slideNum,
                    type: isCover ? 'cover' : 'content',
                    title: concept.title,
                    error: error.message,
                    success: false
                });
            }
        }

        // === Always append CTA slide as the last slide ===
        try {
            console.log(`🖼️ Generating CTA slide ${total}/${total}...`);
            if (onProgress) onProgress(total, total);

            const ctaFilename = `slide_${String(total).padStart(2, '0')}_cta_${timestamp}.png`;
            const ctaHtml = getCtaSlideHTML(total);

            await page.setContent(ctaHtml, { waitUntil: 'domcontentloaded' });
            await new Promise(r => setTimeout(r, 200));

            const ctaOutputPath = path.join(OUTPUT_DIR, ctaFilename);
            await page.screenshot({
                path: ctaOutputPath,
                type: 'png',
                clip: { x: 0, y: 0, width: SLIDE_WIDTH, height: SLIDE_HEIGHT }
            });

            slides.push({
                slideNumber: total,
                type: 'cta',
                title: 'CTA',
                filename: ctaFilename,
                url: `/generated/${ctaFilename}`,
                success: true
            });

            console.log(`✅ CTA slide rendered: ${ctaFilename}`);
        } catch (error) {
            console.error('❌ Failed to generate CTA slide:', error.message);
        }

    } finally {
        if (browser) {
            await browser.close();
            console.log('🔒 Browser closed');
        }
    }

    return slides;
}

/**
 * Check if slide rendering is available
 */
function isRenderingAvailable() {
    try {
        require.resolve('puppeteer');
        require.resolve('sharp');
        return true;
    } catch (e) {
        return false;
    }
}

module.exports = {
    renderSlidesToImages,
    generateCoverFromThumbnail,
    isRenderingAvailable,
    OUTPUT_DIR,
    SLIDE_WIDTH,
    SLIDE_HEIGHT
};
