const puppeteer = require('puppeteer');
const sharp = require('sharp');
const fetch = require('node-fetch');
const { getSlideHTML, getCoverHTML } = require('../templates/slideTemplate');

let browser = null;

async function getBrowser() {
    if (!browser || !browser.isConnected()) {
        browser = await puppeteer.launch({
            headless: 'new',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
            ],
        });
    }
    return browser;
}

/**
 * Render HTML string to PNG buffer (1080x1350)
 */
async function renderHTMLToImage(html) {
    const b = await getBrowser();
    const page = await b.newPage();
    try {
        await page.setViewport({ width: 1080, height: 1350 });
        await page.setContent(html, { waitUntil: 'networkidle0', timeout: 15000 });
        const buffer = await page.screenshot({
            type: 'png',
            clip: { x: 0, y: 0, width: 1080, height: 1350 },
        });
        return buffer;
    } finally {
        await page.close();
    }
}

/**
 * Generate cover image with YouTube thumbnail
 */
async function generateCover(title, thumbnailUrl) {
    // Try to fetch the thumbnail
    let thumbnailBuffer = null;
    if (thumbnailUrl) {
        try {
            const res = await fetch(thumbnailUrl);
            if (res.ok) {
                thumbnailBuffer = Buffer.from(await res.arrayBuffer());
            }
        } catch (e) {
            console.warn('Failed to fetch thumbnail, using gradient fallback:', e.message);
        }

        // If maxresdefault fails, try hqdefault
        if (!thumbnailBuffer) {
            try {
                const fallbackUrl = thumbnailUrl.replace('maxresdefault', 'hqdefault');
                const res = await fetch(fallbackUrl);
                if (res.ok) {
                    thumbnailBuffer = Buffer.from(await res.arrayBuffer());
                }
            } catch (e) {
                console.warn('Fallback thumbnail also failed');
            }
        }
    }

    if (thumbnailBuffer) {
        // Composite: thumbnail background + gradient overlay + title
        const thumbnail = await sharp(thumbnailBuffer)
            .resize(1080, 1215, { fit: 'cover', position: 'center' })
            .toBuffer();

        // Create gradient overlay (dark at bottom)
        const gradientSvg = `<svg width="1080" height="1350">
      <defs>
        <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#0f0f1a" stop-opacity="0.3"/>
          <stop offset="50%" stop-color="#0f0f1a" stop-opacity="0.5"/>
          <stop offset="75%" stop-color="#0f0f1a" stop-opacity="0.85"/>
          <stop offset="100%" stop-color="#0f0f1a" stop-opacity="1"/>
        </linearGradient>
      </defs>
      <rect width="1080" height="1350" fill="url(#grad)"/>
    </svg>`;

        // Escape title for SVG
        const escapedTitle = (title || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

        // Title text overlay
        const words = escapedTitle.split(' ');
        const lines = [];
        let currentLine = '';
        for (const word of words) {
            if ((currentLine + ' ' + word).length > 25) {
                lines.push(currentLine.trim());
                currentLine = word;
            } else {
                currentLine += ' ' + word;
            }
        }
        if (currentLine.trim()) lines.push(currentLine.trim());

        const titleStartY = 1060;
        const lineHeight = 72;
        const titleTextSvg = lines.map((line, i) =>
            `<text x="80" y="${titleStartY + i * lineHeight}" font-family="Inter, sans-serif" font-size="58" font-weight="900" fill="white">${line}</text>`
        ).join('\n');

        const textOverlay = `<svg width="1080" height="1350">
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@900&amp;display=swap');
      </style>
      ${titleTextSvg}
      <rect x="80" y="${titleStartY + lines.length * lineHeight + 10}" width="120" height="4" rx="2" fill="url(#divGrad)"/>
      <defs>
        <linearGradient id="divGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="#e94560"/>
          <stop offset="100%" stop-color="#f97316"/>
        </linearGradient>
      </defs>
      <text x="80" y="${titleStartY + lines.length * lineHeight + 50}" font-family="Inter, sans-serif" font-size="22" font-weight="600" fill="rgba(255,255,255,0.6)">Desliza para explorar <tspan fill="#e94560">→</tspan></text>
    </svg>`;

        // Create base canvas
        const base = await sharp({
            create: {
                width: 1080,
                height: 1350,
                channels: 4,
                background: { r: 15, g: 15, b: 26, alpha: 1 },
            },
        }).png().toBuffer();

        // Composite all layers
        const result = await sharp(base)
            .composite([
                { input: thumbnail, top: 0, left: 0 },
                { input: Buffer.from(gradientSvg), top: 0, left: 0 },
                { input: Buffer.from(textOverlay), top: 0, left: 0 },
            ])
            .png()
            .toBuffer();

        return result;
    }

    // Fallback: render cover HTML without thumbnail
    const coverHTML = getCoverHTML(title, 0);
    return renderHTMLToImage(coverHTML);
}

/**
 * Generate all slide images
 */
async function generateImages(slides, title, thumbnailUrl, videoTitle) {
    const totalSlides = slides.length + 1; // +1 for cover
    const images = [];

    // Cover slide
    const coverTitle = title || videoTitle || 'Carrusel';
    const coverBuffer = await generateCover(coverTitle, thumbnailUrl);
    images.push({
        name: 'slide_01_cover.png',
        data: coverBuffer.toString('base64'),
    });

    // Content slides
    for (let i = 0; i < slides.length; i++) {
        const slide = {
            ...slides[i],
            number: i + 2,
        };
        const html = getSlideHTML(slide, totalSlides, videoTitle);
        const buffer = await renderHTMLToImage(html);
        images.push({
            name: `slide_${String(i + 2).padStart(2, '0')}.png`,
            data: buffer.toString('base64'),
        });
    }

    return images;
}

// Cleanup on exit
process.on('exit', async () => {
    if (browser) await browser.close();
});

module.exports = { generateImages };
