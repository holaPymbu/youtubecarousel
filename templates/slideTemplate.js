/**
 * Generate HTML for a content slide
 */
function getSlideHTML(slide, totalSlides, videoTitle) {
    const slideNumber = slide.number;
    const progress = ((slideNumber - 1) / totalSlides) * 100;

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;900&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      width: 1080px;
      height: 1350px;
      font-family: 'Inter', sans-serif;
      background: linear-gradient(180deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
      color: #ffffff;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      padding: 80px;
      overflow: hidden;
      position: relative;
    }

    .bg-decoration {
      position: absolute;
      width: 400px;
      height: 400px;
      border-radius: 50%;
      filter: blur(120px);
      opacity: 0.15;
    }
    .bg-decoration.top-right {
      top: -100px;
      right: -100px;
      background: #e94560;
    }
    .bg-decoration.bottom-left {
      bottom: -100px;
      left: -100px;
      background: #f97316;
    }

    .slide-number {
      font-size: 200px;
      font-weight: 900;
      color: #e94560;
      line-height: 1;
      opacity: 0.9;
      margin-bottom: 10px;
    }

    .slide-title {
      font-size: 48px;
      font-weight: 700;
      text-align: center;
      line-height: 1.2;
      margin-bottom: 30px;
      max-width: 900px;
    }

    .divider {
      width: 120px;
      height: 4px;
      background: linear-gradient(90deg, #e94560, #f97316);
      border-radius: 2px;
      margin-bottom: 40px;
    }

    .slide-content {
      font-size: 32px;
      font-weight: 400;
      color: #cbd5e1;
      text-align: center;
      line-height: 1.6;
      max-width: 850px;
    }

    .footer {
      position: absolute;
      bottom: 50px;
      left: 80px;
      right: 80px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 16px;
    }

    .progress-bar-container {
      width: 100%;
      height: 4px;
      background: rgba(255,255,255,0.1);
      border-radius: 2px;
      overflow: hidden;
    }
    .progress-bar {
      height: 100%;
      background: linear-gradient(90deg, #e94560, #f97316);
      border-radius: 2px;
      width: ${progress}%;
    }

    .slide-indicator {
      font-size: 18px;
      color: rgba(255,255,255,0.4);
      font-weight: 600;
      letter-spacing: 2px;
    }
  </style>
</head>
<body>
  <div class="bg-decoration top-right"></div>
  <div class="bg-decoration bottom-left"></div>

  <div class="slide-number">${String(slideNumber).padStart(2, '0')}</div>
  <div class="slide-title">${escapeHtml(slide.title)}</div>
  <div class="divider"></div>
  <div class="slide-content">${escapeHtml(slide.content)}</div>

  <div class="footer">
    <div class="progress-bar-container">
      <div class="progress-bar"></div>
    </div>
    <div class="slide-indicator">${slideNumber} / ${totalSlides}</div>
  </div>
</body>
</html>`;
}

/**
 * Generate HTML for the cover slide (fallback when no thumbnail)
 */
function getCoverHTML(title, totalSlides) {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;900&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      width: 1080px;
      height: 1350px;
      font-family: 'Inter', sans-serif;
      background: linear-gradient(180deg, #0f0f1a 0%, #1a1a2e 40%, #0f3460 100%);
      color: #ffffff;
      display: flex;
      flex-direction: column;
      justify-content: flex-end;
      padding: 80px;
      overflow: hidden;
      position: relative;
    }

    .bg-glow {
      position: absolute;
      top: 15%;
      left: 50%;
      transform: translateX(-50%);
      width: 600px;
      height: 600px;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(233,69,96,0.3) 0%, transparent 70%);
      filter: blur(80px);
    }

    .content {
      position: relative;
      z-index: 2;
    }

    .cover-title {
      font-size: 64px;
      font-weight: 900;
      line-height: 1.1;
      margin-bottom: 30px;
      max-width: 900px;
    }

    .divider {
      width: 120px;
      height: 4px;
      background: linear-gradient(90deg, #e94560, #f97316);
      border-radius: 2px;
      margin-bottom: 30px;
    }

    .swipe-cta {
      font-size: 24px;
      color: rgba(255,255,255,0.6);
      font-weight: 600;
    }
    .swipe-cta .arrow {
      color: #e94560;
    }
  </style>
</head>
<body>
  <div class="bg-glow"></div>
  <div class="content">
    <div class="cover-title">${escapeHtml(title)}</div>
    <div class="divider"></div>
    <div class="swipe-cta">Desliza para explorar <span class="arrow">→</span></div>
  </div>
</body>
</html>`;
}

function escapeHtml(text) {
    if (!text) return '';
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

module.exports = { getSlideHTML, getCoverHTML };
