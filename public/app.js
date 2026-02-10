// ===== STATE =====
const state = {
    transcript: '',
    title: '',
    thumbnail: '',
    videoId: '',
    slides: [],
    caption: null,
    images: [],
    currentSlide: 0,
    showImages: false,
};

// ===== DOM REFS =====
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const urlInput = $('#url-input');
const clearBtn = $('#clear-btn');
const generateBtn = $('#generate-btn');
const manualCheck = $('#manual-check');
const manualSection = $('#manual-input-section');
const manualTranscript = $('#manual-transcript');
const slideCountSelect = $('#slide-count');
const demoBtn = $('#demo-btn');
const videoTitleSection = $('#video-title-section');
const videoTitleText = $('#video-title-text');
const transcriptSection = $('#transcript-section');
const transcriptEditor = $('#transcript-editor');
const charCount = $('#char-count');
const wordCount = $('#word-count');
const backBtn = $('#back-to-input-btn');
const confirmTranscriptBtn = $('#confirm-transcript-btn');
const carouselSection = $('#carousel-section');
const carouselTrack = $('#carousel-track');
const carouselDots = $('#carousel-dots');
const prevBtn = $('#prev-btn');
const nextBtn = $('#next-btn');
const downloadBtn = $('#download-btn');
const toggleImagesBtn = $('#toggle-images-btn');
const captionSection = $('#caption-section');
const captionDescription = $('#caption-description');
const captionHashtags = $('#caption-hashtags');
const copyCaptionBtn = $('#copy-caption-btn');
const loadingOverlay = $('#loading-overlay');
const loadingText = $('#loading-text');
const loadingSub = $('#loading-sub');

// ===== TOAST =====
function showToast(message, type = 'info') {
    const container = $('#toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('fade-out');
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

// ===== LOADING =====
function showLoading(text = 'Procesando...', sub = 'Esto puede tomar unos segundos') {
    loadingText.textContent = text;
    loadingSub.textContent = sub;
    loadingOverlay.classList.remove('hidden');
}

function hideLoading() {
    loadingOverlay.classList.add('hidden');
}

// ===== URL VALIDATION =====
function isValidYouTubeUrl(url) {
    return /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|shorts\/)|youtu\.be\/)/.test(url);
}

// ===== CLEAR BUTTON =====
urlInput.addEventListener('input', () => {
    clearBtn.classList.toggle('hidden', !urlInput.value);
});
clearBtn.addEventListener('click', () => {
    urlInput.value = '';
    clearBtn.classList.add('hidden');
    urlInput.focus();
});

// ===== MANUAL TOGGLE =====
manualCheck.addEventListener('change', () => {
    manualSection.classList.toggle('hidden', !manualCheck.checked);
    if (manualCheck.checked) {
        generateBtn.textContent = 'Generar Carrusel ✨';
    }
});

// ===== TRANSCRIPT EDITOR STATS =====
transcriptEditor.addEventListener('input', updateTranscriptStats);

function updateTranscriptStats() {
    const text = transcriptEditor.value;
    charCount.textContent = `${text.length} caracteres`;
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    wordCount.textContent = `${words} palabras`;
}

// ===== GENERATE BUTTON =====
generateBtn.addEventListener('click', async () => {
    if (manualCheck.checked) {
        // Manual transcript mode
        const text = manualTranscript.value.trim();
        if (!text) {
            showToast('Pega una transcripción primero', 'error');
            return;
        }
        state.transcript = text;
        state.title = 'Carrusel Manual';
        state.thumbnail = '';
        showTranscriptEditor();
        return;
    }

    const url = urlInput.value.trim();
    if (!url) {
        showToast('Ingresa una URL de YouTube', 'error');
        return;
    }
    if (!isValidYouTubeUrl(url)) {
        showToast('URL de YouTube no válida', 'error');
        return;
    }

    showLoading('Extrayendo transcripción...', 'Conectando con YouTube via Apify');
    generateBtn.disabled = true;

    try {
        const res = await fetch('/api/transcript', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Error al obtener transcripción');

        state.transcript = data.transcript;
        state.title = data.title || '';
        state.thumbnail = data.thumbnail || '';
        state.videoId = data.videoId || '';

        hideLoading();
        showToast('Transcripción extraída correctamente', 'success');
        showTranscriptEditor();
    } catch (err) {
        hideLoading();
        showToast(err.message, 'error');
    } finally {
        generateBtn.disabled = false;
    }
});

// ===== SHOW TRANSCRIPT EDITOR =====
function showTranscriptEditor() {
    if (state.title) {
        videoTitleSection.classList.remove('hidden');
        videoTitleText.textContent = state.title;
    }
    transcriptEditor.value = state.transcript;
    updateTranscriptStats();
    transcriptSection.classList.remove('hidden');
    transcriptSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ===== BACK BUTTON =====
backBtn.addEventListener('click', () => {
    transcriptSection.classList.add('hidden');
    videoTitleSection.classList.add('hidden');
    carouselSection.classList.add('hidden');
    captionSection.classList.add('hidden');
});

// ===== CONFIRM TRANSCRIPT & GENERATE =====
confirmTranscriptBtn.addEventListener('click', async () => {
    const editedTranscript = transcriptEditor.value.trim();
    if (!editedTranscript) {
        showToast('La transcripción no puede estar vacía', 'error');
        return;
    }

    state.transcript = editedTranscript;
    const slideCount = parseInt(slideCountSelect.value) || 7;

    showLoading('Generando carrusel con IA...', 'Analizando contenido y creando conceptos clave');
    confirmTranscriptBtn.disabled = true;

    try {
        const res = await fetch('/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                transcript: state.transcript,
                slideCount,
                title: state.title,
            }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Error al generar contenido');

        state.slides = data.slides;
        state.caption = data.caption;
        state.showImages = false;
        state.images = [];

        hideLoading();
        showToast('Carrusel generado exitosamente', 'success');
        renderCarousel();
        renderCaption();

        carouselSection.classList.remove('hidden');
        captionSection.classList.remove('hidden');
        carouselSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (err) {
        hideLoading();
        showToast(err.message, 'error');
    } finally {
        confirmTranscriptBtn.disabled = false;
    }
});

// ===== RENDER CAROUSEL PREVIEW =====
function renderCarousel() {
    carouselTrack.innerHTML = '';
    const totalSlides = state.slides.length + 1;

    // Cover slide
    const coverEl = document.createElement('div');
    coverEl.className = 'carousel-slide preview-slide cover';

    if (state.thumbnail) {
        coverEl.innerHTML = `
      <img class="cover-thumb" src="${state.thumbnail}" alt="thumbnail" onerror="this.style.display='none'">
      <div class="cover-gradient"></div>
      <div class="cover-content">
        <div class="cover-title-text">${escapeHtml(state.title || 'Tu Carrusel')}</div>
        <div class="cover-divider"></div>
        <div class="cover-cta">Desliza para explorar →</div>
      </div>
    `;
    } else {
        coverEl.innerHTML = `
      <div class="cover-content">
        <div class="cover-title-text">${escapeHtml(state.title || 'Tu Carrusel')}</div>
        <div class="cover-divider"></div>
        <div class="cover-cta">Desliza para explorar →</div>
      </div>
    `;
    }
    carouselTrack.appendChild(coverEl);

    // Content slides
    state.slides.forEach((slide, i) => {
        const slideEl = document.createElement('div');
        slideEl.className = 'carousel-slide preview-slide';
        const progress = ((i + 1) / (totalSlides - 1)) * 100;
        slideEl.innerHTML = `
      <div class="slide-num">${String(slide.number || i + 2).padStart(2, '0')}</div>
      <div class="slide-title-text">${escapeHtml(slide.title)}</div>
      <div class="slide-divider"></div>
      <div class="slide-content-text">${escapeHtml(slide.content)}</div>
      <div class="slide-progress">
        <div class="progress-track">
          <div class="progress-fill" style="width: ${progress}%"></div>
        </div>
        <div class="progress-label">${slide.number || i + 2} / ${totalSlides}</div>
      </div>
    `;
        carouselTrack.appendChild(slideEl);
    });

    renderDots();
    state.currentSlide = 0;
    updateCarouselPosition();
}

// ===== RENDER IMAGE CAROUSEL =====
function renderImageCarousel() {
    carouselTrack.innerHTML = '';

    state.images.forEach((img, i) => {
        const slideEl = document.createElement('div');
        slideEl.className = 'carousel-slide image-slide';
        slideEl.innerHTML = `<img src="data:image/png;base64,${img.data}" alt="${img.name}">`;
        carouselTrack.appendChild(slideEl);
    });

    renderDots();
    state.currentSlide = 0;
    updateCarouselPosition();
}

// ===== DOTS =====
function renderDots() {
    const slides = carouselTrack.children;
    carouselDots.innerHTML = '';

    // Calculate pages (3 slides visible at a time on desktop)
    const slidesPerView = window.innerWidth <= 640 ? 2 : 4;
    const pages = Math.max(1, Math.ceil(slides.length - slidesPerView + 1));

    for (let i = 0; i < Math.min(pages, slides.length); i++) {
        const dot = document.createElement('div');
        dot.className = 'carousel-dot';
        if (i === 0) dot.classList.add('active');
        dot.addEventListener('click', () => {
            state.currentSlide = i;
            updateCarouselPosition();
        });
        carouselDots.appendChild(dot);
    }
}

function updateCarouselPosition() {
    const slides = carouselTrack.children;
    if (!slides.length) return;

    const slideWidth = slides[0].offsetWidth + 12; // + gap
    carouselTrack.style.transform = `translateX(-${state.currentSlide * slideWidth}px)`;

    // Update dots
    const dots = carouselDots.children;
    for (let i = 0; i < dots.length; i++) {
        dots[i].classList.toggle('active', i === state.currentSlide);
    }
}

// ===== CAROUSEL NAVIGATION =====
prevBtn.addEventListener('click', () => {
    if (state.currentSlide > 0) {
        state.currentSlide--;
        updateCarouselPosition();
    }
});

nextBtn.addEventListener('click', () => {
    const slides = carouselTrack.children;
    const slidesPerView = window.innerWidth <= 640 ? 2 : 4;
    const maxSlide = Math.max(0, slides.length - slidesPerView);
    if (state.currentSlide < maxSlide) {
        state.currentSlide++;
        updateCarouselPosition();
    }
});

// ===== TOGGLE PREVIEW / IMAGES =====
toggleImagesBtn.addEventListener('click', async () => {
    if (state.showImages && state.images.length > 0) {
        // Switch back to preview
        state.showImages = false;
        renderCarousel();
        toggleImagesBtn.innerHTML = '<span>🖼️</span> Alternar Vista Previa/Imágenes';
        return;
    }

    if (state.images.length > 0) {
        // Show cached images
        state.showImages = true;
        renderImageCarousel();
        toggleImagesBtn.innerHTML = '<span>👁️</span> Ver Vista Previa';
        return;
    }

    // Generate images
    showLoading('Generando imágenes profesionales...', 'Renderizando slides en alta resolución (1080×1350)');

    try {
        const res = await fetch('/api/generate-images', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                slides: state.slides,
                title: state.title,
                thumbnail: state.thumbnail,
                videoTitle: state.title,
            }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Error al generar imágenes');

        state.images = data.images;
        state.showImages = true;

        hideLoading();
        showToast('Imágenes generadas correctamente', 'success');
        renderImageCarousel();
        toggleImagesBtn.innerHTML = '<span>👁️</span> Ver Vista Previa';
    } catch (err) {
        hideLoading();
        showToast(err.message, 'error');
    }
});

// ===== RENDER CAPTION =====
function renderCaption() {
    if (!state.caption) return;
    captionDescription.textContent = state.caption.description || '';
    captionHashtags.textContent = state.caption.hashtags || '';
}

// ===== COPY CAPTION =====
copyCaptionBtn.addEventListener('click', async () => {
    const text = `${state.caption.description}\n\n${state.caption.hashtags}`;
    try {
        await navigator.clipboard.writeText(text);
        showToast('Texto copiado al portapapeles', 'success');
        copyCaptionBtn.innerHTML = 'Copiado! <span>✅</span>';
        setTimeout(() => {
            copyCaptionBtn.innerHTML = 'Copiar <span>📋</span>';
        }, 2000);
    } catch (err) {
        // Fallback
        const textarea = document.createElement('textarea');
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        showToast('Texto copiado al portapapeles', 'success');
    }
});

// ===== DOWNLOAD ZIP =====
downloadBtn.addEventListener('click', async () => {
    if (state.images.length === 0) {
        showToast('Primero genera las imágenes con el botón de abajo', 'info');
        return;
    }

    showToast('Preparando ZIP...', 'info');

    try {
        const zip = new JSZip();

        // Add images
        state.images.forEach((img) => {
            zip.file(img.name, img.data, { base64: true });
        });

        // Add caption
        if (state.caption) {
            const captionText = `${state.caption.description}\n\n${state.caption.hashtags}`;
            zip.file('caption.txt', captionText);
        }

        const blob = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `carousel_${state.videoId || 'slides'}.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        showToast('ZIP descargado correctamente', 'success');
    } catch (err) {
        showToast('Error al crear el ZIP: ' + err.message, 'error');
    }
});

// ===== DEMO DATA =====
const DEMO_DATA = {
    title: 'MoltBot (Clawdbot) en VPS: Instalación Segura con Hostinger y Conexión a Telegram',
    thumbnail: 'https://img.youtube.com/vi/VyZqEHiO6x0/maxresdefault.jpg',
    videoId: 'VyZqEHiO6x0',
    slides: [
        { number: 2, title: 'Crea tu VPS Hostinger', content: 'Accede al link de Agentes en Acción para un 15% de descuento en planes anuales de Hostinger VPS. Elige KBM2 y Ubuntu 2404 como sistema operativo.' },
        { number: 3, title: 'Aísla la IA por seguridad', content: 'Crea un nuevo usuario (ej: "Molt") en tu VPS para instalar Moltbot. Evita riesgos al separar la IA del usuario "root" con privilegios.' },
        { number: 4, title: 'Instala CloudBot fácilmente', content: 'Copia y pega el código desde la página de descargas en la terminal de tu VPS. Aparente, ¡sigue tras planes!' },
        { number: 5, title: 'Conecta con Telegram', content: 'Configura tu bot de Telegram con BotFather, obtén el token y conéctalo con MoltBot para empezar a automatizar.' },
        { number: 6, title: 'Personaliza tu asistente', content: 'Ajusta el comportamiento, personalidad y respuestas de tu IA personal según tus necesidades específicas.' },
        { number: 7, title: 'Automatiza tu día a día', content: 'Programa tareas recurrentes, gestiona recordatorios y deja que tu asistente virtual trabaje por ti las 24 horas.' },
        { number: 8, title: 'Escala sin límites', content: 'Un VPS dedicado te permite crecer sin restricciones. Añade más bots, más funciones y más integraciones cuando lo necesites.' },
    ],
    caption: {
        description: '¿Cansado de tareas repetitivas? 🤖 Descubre Moltbot (o Clopbot), tu asistente de IA personal TODO EN UNO. 🚀 En este carrusel te mostramos cómo instalarlo en un VPS y automatizar tu día a día. ¡No te lo pierdas! Guarda, comparte y comenta qué te parece! 👇',
        hashtags: '#IA #InteligenciaArtificial #Automatización #VPS #Hostinger #Moltbot #Clopbot #Cloudbot #Productividad #AsistenteVirtual #DevOps #Programación #Coding #AgentesEnAccion #AIAutomation',
    },
};

demoBtn.addEventListener('click', () => {
    state.title = DEMO_DATA.title;
    state.thumbnail = DEMO_DATA.thumbnail;
    state.videoId = DEMO_DATA.videoId;
    state.slides = DEMO_DATA.slides;
    state.caption = DEMO_DATA.caption;
    state.images = [];
    state.showImages = false;

    videoTitleSection.classList.remove('hidden');
    videoTitleText.textContent = state.title;

    // Hide transcript editor for demo
    transcriptSection.classList.add('hidden');

    renderCarousel();
    renderCaption();

    carouselSection.classList.remove('hidden');
    captionSection.classList.remove('hidden');
    carouselSection.scrollIntoView({ behavior: 'smooth', block: 'start' });

    showToast('Demo cargado correctamente', 'success');
});

// ===== HELPERS =====
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ===== RESIZE HANDLER =====
window.addEventListener('resize', () => {
    if (carouselTrack.children.length > 0) {
        updateCarouselPosition();
    }
});
