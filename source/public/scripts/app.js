/**
 * YouTube to Instagram Carousel Generator - Frontend Application
 * Professional slide design with Nano Banana image generation
 */

// ─────────────────────────────────────────────────────────────────────────────
// DOM Elements
// ─────────────────────────────────────────────────────────────────────────────
const elements = {
    urlInput: document.getElementById('youtubeUrl'),
    clearBtn: document.getElementById('clearBtn'),
    generateBtn: document.getElementById('generateBtn'),
    slideCountSelect: document.getElementById('slideCount'),
    urlError: document.getElementById('urlError'),
    loadingSection: document.getElementById('loadingSection'),
    loaderText: document.getElementById('loaderText'),
    progressFill: document.getElementById('progressFill'),
    resultsSection: document.getElementById('resultsSection'),
    videoTitle: document.getElementById('videoTitle'),
    videoTitleSection: document.getElementById('videoTitleSection'),
    carouselPreview: document.getElementById('carouselPreview'),
    carouselDots: document.getElementById('carouselDots'),
    prevSlide: document.getElementById('prevSlide'),
    nextSlide: document.getElementById('nextSlide'),
    generateImagesBtn: document.getElementById('generateImagesBtn'),
    downloadAllBtn: document.getElementById('downloadAllBtn'),
    copyCaptionBtn: document.getElementById('copyCaptionBtn'),
    captionText: document.getElementById('captionText'),
    hashtagsText: document.getElementById('hashtagsText'),
    toast: document.getElementById('toast'),
    toggleManualBtn: document.getElementById('toggleManualBtn'),
    manualInputSection: document.getElementById('manualInputSection'),
    manualTranscript: document.getElementById('manualTranscript'),
    processTextBtn: document.getElementById('processTextBtn'),
    demoBtn: document.getElementById('demoBtn'),
    // Transcript Editor elements
    transcriptSection: document.getElementById('transcriptSection'),
    transcriptEditor: document.getElementById('transcriptEditor'),
    confirmTranscriptBtn: document.getElementById('confirmTranscriptBtn'),
    cancelTranscriptBtn: document.getElementById('cancelTranscriptBtn'),
    videoTitlePreview: document.getElementById('videoTitlePreview'),
    charCount: document.getElementById('charCount'),
    wordCount: document.getElementById('wordCount')
};

// ─────────────────────────────────────────────────────────────────────────────
// State
// ─────────────────────────────────────────────────────────────────────────────
let state = {
    concepts: [],
    copy: null,
    currentSlide: 0,
    isProcessing: false,
    generatedImages: [],
    videoTitle: '',
    videoId: '',
    showImages: false,
    // Transcript editor state
    rawTranscript: '',
    pendingUrl: ''
};

// Demo images (pre-generated with Nano Banana)
const DEMO_IMAGES = [
    '/generated/slide_01_cover_1769718951724.png',
    '/generated/slide_02_content_1769718987116.png',
    '/generated/slide_03_content_1769719006003.png',
    '/generated/slide_04_content_1769719025722.png'
];

// ─────────────────────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────────────────────
function showToast(message, type = 'success') {
    elements.toast.textContent = message;
    elements.toast.className = `toast ${type} show`;
    setTimeout(() => {
        elements.toast.classList.remove('show');
    }, 3000);
}

function validateYouTubeUrl(url) {
    if (!url) return false;
    const patterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([^&\n?#]+)/,
        /^([a-zA-Z0-9_-]{11})$/
    ];
    return patterns.some(pattern => pattern.test(url));
}

function setLoading(loading, text = 'Procesando...') {
    state.isProcessing = loading;
    elements.generateBtn.disabled = loading;
    elements.processTextBtn.disabled = loading;
    elements.demoBtn.disabled = loading;
    elements.loadingSection.classList.toggle('hidden', !loading);
    elements.loaderText.textContent = text;
}

function updateProgress(percent) {
    elements.progressFill.style.width = `${percent}%`;
}

// Clean title - remove emojis for professional look
function cleanTitle(title) {
    return title.replace(/[🎬🎯✨💡🔥⚡📌]/g, '').trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// Slide Rendering - Preview Mode (HTML/CSS)
// ─────────────────────────────────────────────────────────────────────────────
function renderSlidePreview(concept, index, total, videoTitle) {
    const isCover = index === 0;
    const slideNumber = concept.slideNumber;

    if (isCover) {
        return `
      <div class="slide slide--cover" data-index="${index}">
        <div class="slide__background"></div>
        <div class="slide__decoration slide__decoration--top"></div>
        <div class="slide__decoration slide__decoration--bottom"></div>
        
        <div class="slide__content">
          <h2 class="slide__main-title">${videoTitle || 'Ideas Clave'}</h2>
          <div class="slide__divider"></div>
          <p class="slide__subtitle">Desliza para explorar →</p>
        </div>
        
        <div class="slide__footer">
          <span class="slide__indicator">${slideNumber}/${total}</span>
        </div>
      </div>
    `;
    }

    const cleanedTitle = cleanTitle(concept.title);

    return `
    <div class="slide slide--content" data-index="${index}">
      <div class="slide__background"></div>
      <div class="slide__decoration slide__decoration--accent"></div>
      
      <div class="slide__header">
        <span class="slide__number">${String(slideNumber).padStart(2, '0')}</span>
      </div>
      
      <div class="slide__content">
        <h3 class="slide__title">${cleanedTitle}</h3>
        <div class="slide__text-divider"></div>
        <p class="slide__text">${concept.content}</p>
      </div>
      
      <div class="slide__footer">
        <div class="slide__progress">
          <div class="slide__progress-bar" style="width: ${(slideNumber / total) * 100}%"></div>
        </div>
        <span class="slide__indicator">${slideNumber}/${total}</span>
      </div>
    </div>
  `;
}

// ─────────────────────────────────────────────────────────────────────────────
// Slide Rendering - Image Mode (Generated Images)
// ─────────────────────────────────────────────────────────────────────────────
function renderSlideImage(imageSrc, index) {
    return `
    <div class="slide slide--image" data-index="${index}">
      <img src="${imageSrc}" alt="Diapositiva ${index + 1}" class="slide__image" loading="lazy" />
    </div>
  `;
}

// ─────────────────────────────────────────────────────────────────────────────
// Carousel Rendering
// ─────────────────────────────────────────────────────────────────────────────
function renderCarousel() {
    const total = state.concepts.length;
    const videoTitle = state.videoTitle || 'Ideas Clave';

    if (state.showImages && state.generatedImages.length > 0) {
        // Render generated images
        elements.carouselPreview.innerHTML = state.generatedImages.map((src, index) =>
            renderSlideImage(src, index)
        ).join('');
    } else {
        // Render preview slides
        elements.carouselPreview.innerHTML = state.concepts.map((concept, index) =>
            renderSlidePreview(concept, index, total, videoTitle)
        ).join('');
    }

    // Render dots
    const slideCount = state.showImages ? state.generatedImages.length : state.concepts.length;
    elements.carouselDots.innerHTML = Array(slideCount).fill(0).map((_, index) => `
    <div class="carousel-dot ${index === 0 ? 'active' : ''}" data-index="${index}"></div>
  `).join('');

    // Add dot click handlers
    document.querySelectorAll('.carousel-dot').forEach(dot => {
        dot.addEventListener('click', () => {
            const index = parseInt(dot.dataset.index);
            scrollToSlide(index);
        });
    });

    observeCarouselScroll();
}

function scrollToSlide(index) {
    const slides = elements.carouselPreview.querySelectorAll('.slide');
    if (slides[index]) {
        slides[index].scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        updateActiveDot(index);
    }
}

function updateActiveDot(index) {
    state.currentSlide = index;
    document.querySelectorAll('.carousel-dot').forEach((dot, i) => {
        dot.classList.toggle('active', i === index);
    });
}

function observeCarouselScroll() {
    const slides = elements.carouselPreview.querySelectorAll('.slide');
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const index = parseInt(entry.target.dataset.index);
                updateActiveDot(index);
            }
        });
    }, { root: elements.carouselPreview, threshold: 0.5 });

    slides.forEach(slide => observer.observe(slide));
}

// ─────────────────────────────────────────────────────────────────────────────
// Copy Rendering
// ─────────────────────────────────────────────────────────────────────────────
function renderCopy() {
    if (state.copy) {
        elements.captionText.textContent = state.copy.caption;
        elements.hashtagsText.textContent = state.copy.hashtags;
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Display Results
// ─────────────────────────────────────────────────────────────────────────────
function displayResults(result) {
    state.concepts = result.concepts;
    state.copy = result.copy;
    state.videoTitle = result.videoTitle || '';
    state.videoId = result.videoId || '';
    state.showImages = false;
    state.generatedImages = [];

    if (state.videoTitle) {
        elements.videoTitle.textContent = `📺 ${state.videoTitle}`;
        elements.videoTitleSection.classList.remove('hidden');
    } else {
        elements.videoTitleSection.classList.add('hidden');
    }

    renderCarousel();
    renderCopy();

    setLoading(false);
    elements.resultsSection.classList.remove('hidden');
    elements.resultsSection.scrollIntoView({ behavior: 'smooth' });

    const demoText = result.isDemo ? ' (Demo)' : '';
    showToast(`¡${result.concepts.length} diapositivas profesionales generadas!${demoText}`, 'success');
}

// ─────────────────────────────────────────────────────────────────────────────
// API Calls
// ─────────────────────────────────────────────────────────────────────────────
async function processVideo(url, slideCount, transcript = null) {
    const body = { slideCount };
    if (transcript) {
        body.transcript = transcript;
    } else if (url) {
        body.url = url;
    }

    const response = await fetch('/api/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed to process video');
    return data;
}

async function processText(text, slideCount) {
    const response = await fetch('/api/process-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, slideCount })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed to process text');
    return data;
}

async function loadDemo() {
    const response = await fetch('/api/demo');
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed to load demo');
    return data;
}

async function generateImagePrompts() {
    const response = await fetch('/api/generate-images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            concepts: state.concepts,
            videoId: state.videoId,
            videoTitle: state.videoTitle
        })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed to generate images');
    return data;
}

// ─────────────────────────────────────────────────────────────────────────────
// Event Handlers
// ─────────────────────────────────────────────────────────────────────────────

// Fetch only transcript (Step 1 of new flow)
async function fetchTranscript(url) {
    const response = await fetch('/api/transcript', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed to extract transcript');
    return data;
}

// Show transcript editor with the extracted text
function showTranscriptEditor(transcript, videoTitle, videoId) {
    state.rawTranscript = transcript.text;
    state.videoTitle = videoTitle;
    state.videoId = videoId;

    // Populate editor
    elements.transcriptEditor.value = transcript.text;
    elements.videoTitlePreview.textContent = videoTitle;
    updateTranscriptStats();

    // Show transcript section, hide others
    elements.loadingSection.classList.add('hidden');
    elements.resultsSection.classList.add('hidden');
    elements.transcriptSection.classList.remove('hidden');

    // Scroll to editor
    elements.transcriptSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Update character and word counts
function updateTranscriptStats() {
    const text = elements.transcriptEditor.value;
    const charCount = text.length;
    const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;

    elements.charCount.textContent = `${charCount.toLocaleString()} caracteres`;
    elements.wordCount.textContent = `${wordCount.toLocaleString()} palabras`;
}

// Handle confirm transcript (Step 2 - process with edited text)
async function handleConfirmTranscript() {
    const editedText = elements.transcriptEditor.value.trim();
    const slideCount = parseInt(elements.slideCountSelect.value);

    if (editedText.length < 50) {
        showToast('La transcripción debe tener al menos 50 caracteres', 'error');
        return;
    }

    try {
        elements.transcriptSection.classList.add('hidden');
        setLoading(true, 'Procesando transcripción con IA...');
        updateProgress(30);

        // Process with the edited transcript
        const result = await processVideo(null, slideCount, editedText);

        // Restore video metadata
        result.videoTitle = state.videoTitle || result.videoTitle;
        result.videoId = state.videoId || result.videoId;

        updateProgress(100);
        await new Promise(resolve => setTimeout(resolve, 300));
        displayResults(result);
        showToast('¡Carrusel generado exitosamente!', 'success');
    } catch (error) {
        setLoading(false);
        elements.transcriptSection.classList.remove('hidden');
        showToast(error.message, 'error');
    }
}

// Handle cancel transcript editing
function handleCancelTranscript() {
    elements.transcriptSection.classList.add('hidden');
    state.rawTranscript = '';
    state.pendingUrl = '';
    elements.transcriptEditor.value = '';
}

// Modified handleGenerate - now shows transcript editor first
async function handleGenerate() {
    const url = elements.urlInput.value.trim();

    if (!url) {
        elements.urlError.textContent = 'Por favor ingresa una URL de YouTube';
        return;
    }

    if (!validateYouTubeUrl(url)) {
        elements.urlError.textContent = 'Por favor ingresa una URL de YouTube válida';
        return;
    }

    elements.urlError.textContent = '';
    elements.resultsSection.classList.add('hidden');
    elements.transcriptSection.classList.add('hidden');
    state.pendingUrl = url;

    try {
        setLoading(true, 'Extrayendo transcripción...');
        updateProgress(20);
        setTimeout(() => updateProgress(50), 500);

        const result = await fetchTranscript(url);
        updateProgress(100);

        await new Promise(resolve => setTimeout(resolve, 300));

        // Show transcript editor instead of directly processing
        showTranscriptEditor(result.transcript, result.transcript.videoTitle || 'Video de YouTube', result.videoId);
        showToast('¡Transcripción extraída! Revisa y confirma.', 'success');
    } catch (error) {
        setLoading(false);
        elements.urlError.textContent = error.message;
        showToast(error.message, 'error');
        if (error.message.includes('transcript') || error.message.includes('captions')) {
            elements.manualInputSection.classList.remove('hidden');
        }
    }
}

async function handleProcessText() {
    const text = elements.manualTranscript.value.trim();
    const slideCount = parseInt(elements.slideCountSelect.value);

    if (text.length < 50) {
        showToast('Por favor ingresa al menos 50 caracteres', 'error');
        return;
    }

    elements.urlError.textContent = '';
    elements.resultsSection.classList.add('hidden');

    try {
        setLoading(true, 'Procesando transcripción...');
        updateProgress(30);
        setTimeout(() => updateProgress(70), 300);

        const result = await processText(text, slideCount);
        updateProgress(100);
        await new Promise(resolve => setTimeout(resolve, 300));
        displayResults(result);
    } catch (error) {
        setLoading(false);
        showToast(error.message, 'error');
    }
}

async function handleDemo() {
    elements.urlError.textContent = '';
    elements.resultsSection.classList.add('hidden');

    try {
        setLoading(true, 'Cargando demo...');
        updateProgress(50);

        const result = await loadDemo();
        updateProgress(100);
        await new Promise(resolve => setTimeout(resolve, 200));
        displayResults(result);

        // For demo, show pre-generated images
        state.generatedImages = DEMO_IMAGES.slice(0, Math.min(4, result.concepts.length));

    } catch (error) {
        setLoading(false);
        showToast(error.message, 'error');
    }
}

function handleClear() {
    elements.urlInput.value = '';
    elements.urlError.textContent = '';
    elements.urlInput.focus();
}

function handleToggleManual() {
    elements.manualInputSection.classList.toggle('hidden');
    const isVisible = !elements.manualInputSection.classList.contains('hidden');
    elements.toggleManualBtn.innerHTML = isVisible
        ? '<span>✖️</span> Ocultar entrada de transcripción'
        : '<span>📝</span> O pega la transcripción manualmente';
}

function handlePrevSlide() {
    const newIndex = Math.max(0, state.currentSlide - 1);
    scrollToSlide(newIndex);
}

function handleNextSlide() {
    const maxIndex = state.showImages ? state.generatedImages.length - 1 : state.concepts.length - 1;
    const newIndex = Math.min(maxIndex, state.currentSlide + 1);
    scrollToSlide(newIndex);
}

async function handleCopyCaption() {
    if (state.copy) {
        try {
            await navigator.clipboard.writeText(state.copy.fullPost);
            showToast('¡Descripción copiada al portapapeles!', 'success');
        } catch (error) {
            showToast('Error al copiar descripción', 'error');
        }
    }
}

async function handleGenerateImages() {
    // If already have images, toggle view
    if (state.generatedImages.length > 0) {
        state.showImages = !state.showImages;
        renderCarousel();
        showToast(state.showImages ? 'Mostrando imágenes generadas' : 'Mostrando vista previa', 'success');
        return;
    }

    // For demo content, use pre-generated images
    if (state.videoId === 'demo') {
        state.generatedImages = DEMO_IMAGES.slice(0, Math.min(4, state.concepts.length));
        state.showImages = true;
        renderCarousel();
        showToast('¡Mostrando diapositivas pre-generadas!', 'success');
        return;
    }

    // Get loading overlay elements
    const loadingOverlay = document.getElementById('aiLoadingOverlay');
    const progressFill = document.getElementById('aiProgressFill');
    const loadingStatus = document.getElementById('aiLoadingStatus');

    // Show loading overlay
    const showLoadingOverlay = () => {
        loadingOverlay.classList.add('active');
        progressFill.style.width = '0%';
        loadingStatus.textContent = 'Preparando diapositivas...';
    };

    // Hide loading overlay
    const hideLoadingOverlay = () => {
        loadingOverlay.classList.remove('active');
    };

    // Update progress
    const updateProgress = (current, total) => {
        const percent = Math.round((current / total) * 100);
        progressFill.style.width = `${percent}%`;
        loadingStatus.textContent = `Generando diapositiva ${current} de ${total}...`;
    };

    // Generate images using Imagen 4 API via backend
    try {
        elements.generateImagesBtn.disabled = true;
        elements.generateImagesBtn.innerHTML = '<span class="btn-icon">⏳</span><span>Generando con IA...</span>';

        // Show the premium loading overlay
        showLoadingOverlay();

        // Simulate progress updates (since backend doesn't stream progress)
        const totalSlides = state.concepts.length + 1; // +1 for CTA slide
        let simulatedProgress = 0;
        const progressInterval = setInterval(() => {
            simulatedProgress++;
            if (simulatedProgress <= totalSlides) {
                updateProgress(simulatedProgress, totalSlides);
            }
        }, 5000); // Approximate 5 seconds per slide

        // Call backend API
        const response = await fetch('/api/generate-images', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                concepts: state.concepts,
                videoId: state.videoId,
                videoTitle: state.videoTitle
            })
        });

        clearInterval(progressInterval);
        progressFill.style.width = '100%';
        loadingStatus.textContent = 'Finalizando...';

        const data = await response.json();

        // Hide loading overlay
        hideLoadingOverlay();

        if (!response.ok) {
            throw new Error(data.error || 'Failed to generate images');
        }

        if (data.promptsOnly) {
            // API key not configured, show message
            showToast('⚠️ Generación de imágenes no configurada. Usando modo vista previa.', 'error');
            elements.generateImagesBtn.disabled = false;
            elements.generateImagesBtn.innerHTML = '<span class="btn-icon">🖼️</span><span>Generar Imágenes de Diapositivas</span>';
            return;
        }

        // Extract successful image URLs
        const successfulSlides = data.slides.filter(s => s.success);
        state.generatedImages = successfulSlides.map(s => s.url);

        if (state.generatedImages.length > 0) {
            state.showImages = true;
            renderCarousel();

            const stats = data.stats || { success: state.generatedImages.length, total: state.concepts.length };
            showToast(`✨ ¡${stats.success}/${stats.total} imágenes profesionales generadas!`, 'success');
        } else {
            showToast('❌ Error al generar imágenes. Por favor intenta de nuevo.', 'error');
        }

        elements.generateImagesBtn.disabled = false;
        elements.generateImagesBtn.innerHTML = '<span class="btn-icon">🖼️</span><span>Alternar Vista Previa/Imágenes</span>';

    } catch (error) {
        console.error('Error generating images:', error);
        hideLoadingOverlay();
        showToast('❌ Error: ' + error.message, 'error');
        elements.generateImagesBtn.disabled = false;
        elements.generateImagesBtn.innerHTML = '<span class="btn-icon">🖼️</span><span>Generar Imágenes de Diapositivas</span>';
    }
}

async function handleDownloadAll() {
    if (state.generatedImages.length === 0) {
        showToast('Genera las imágenes primero', 'error');
        return;
    }

    try {
        elements.downloadAllBtn.disabled = true;
        elements.downloadAllBtn.innerHTML = '<span>Preparando ZIP...</span><span class="btn-icon">⏳</span>';

        const zip = new JSZip();
        const folder = zip.folder('carrusel_instagram');

        // Fetch each image and add to ZIP
        for (let i = 0; i < state.generatedImages.length; i++) {
            showToast(`Procesando imagen ${i + 1} de ${state.generatedImages.length}...`, 'success');

            const response = await fetch(state.generatedImages[i]);
            const blob = await response.blob();
            const filename = `slide_${String(i + 1).padStart(2, '0')}.png`;
            folder.file(filename, blob);
        }

        // Generate ZIP file
        showToast('Generando archivo ZIP...', 'success');
        const zipBlob = await zip.generateAsync({ type: 'blob' });

        // Download ZIP
        const link = document.createElement('a');
        link.href = URL.createObjectURL(zipBlob);
        link.download = 'carrusel_instagram.zip';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);

        showToast(`¡${state.generatedImages.length} imágenes descargadas en ZIP!`, 'success');

    } catch (error) {
        console.error('Error creating ZIP:', error);
        showToast('Error al crear el ZIP: ' + error.message, 'error');
    } finally {
        elements.downloadAllBtn.disabled = false;
        elements.downloadAllBtn.innerHTML = '<span>Descargar Todo</span><span class="btn-icon">📥</span>';
    }
}

function handleInputChange() {
    const url = elements.urlInput.value.trim();
    elements.urlError.textContent = url && !validateYouTubeUrl(url)
        ? 'Por favor ingresa una URL de YouTube válida'
        : '';
}

function handleKeyDown(e) {
    if (e.key === 'Enter' && document.activeElement === elements.urlInput) {
        handleGenerate();
    }
    if (!elements.resultsSection.classList.contains('hidden')) {
        if (e.key === 'ArrowLeft') handlePrevSlide();
        if (e.key === 'ArrowRight') handleNextSlide();
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Initialize
// ─────────────────────────────────────────────────────────────────────────────
function init() {
    elements.generateBtn.addEventListener('click', handleGenerate);
    elements.clearBtn.addEventListener('click', handleClear);
    elements.urlInput.addEventListener('input', handleInputChange);
    elements.prevSlide.addEventListener('click', handlePrevSlide);
    elements.nextSlide.addEventListener('click', handleNextSlide);
    elements.copyCaptionBtn.addEventListener('click', handleCopyCaption);
    elements.generateImagesBtn.addEventListener('click', handleGenerateImages);
    elements.downloadAllBtn.addEventListener('click', handleDownloadAll);
    elements.toggleManualBtn.addEventListener('click', handleToggleManual);
    elements.processTextBtn.addEventListener('click', handleProcessText);
    elements.demoBtn.addEventListener('click', handleDemo);
    document.addEventListener('keydown', handleKeyDown);

    // Transcript editor event listeners
    elements.confirmTranscriptBtn.addEventListener('click', handleConfirmTranscript);
    elements.cancelTranscriptBtn.addEventListener('click', handleCancelTranscript);
    elements.transcriptEditor.addEventListener('input', updateTranscriptStats);

    elements.urlInput.focus();

    console.log('🎬 Generador de Carruseles de YouTube a Instagram - Edición Nano Banana');
}

document.addEventListener('DOMContentLoaded', init);
