import { drawTemplate } from './CanvasPainter';
import { MOCK_ACTIVITIES } from '../../api/mocks';
import { formatActivityStats } from '../../api/strava';

// ─── Template Registry — single source of truth ──────────────────────────────
export interface TemplateFeatures {
    distance?: boolean;
    paceSpeed?: boolean;
    duration?: boolean;
    heartRate?: boolean;
    date?: boolean;
    startTime?: boolean;
    map?: boolean;
}

interface TemplateConfig {
    id: string;
    features: TemplateFeatures;
    category: 'distance' | 'workout' | 'all';
    supportsBlackText?: boolean;
    compact?: boolean;
    seasonal?: boolean;
    note?: string;
    preferredCase?: 'uppercase' | 'lowercase' | 'title';
}

export const TEMPLATE_REGISTRY: readonly TemplateConfig[] = [
    { id: 'editorial-strip', category: 'all', supportsBlackText: false, compact: true, features: { distance: true, duration: true, date: true } },
    { id: 'science-pro', category: 'all', supportsBlackText: false, features: { distance: true, paceSpeed: true, heartRate: true, date: true } },
    { id: 'narrative-highlight', category: 'all', supportsBlackText: true, preferredCase: 'lowercase', features: { distance: true, duration: true, paceSpeed: true, date: true } },
    { id: 'location-pill', category: 'all', supportsBlackText: true, compact: true, preferredCase: 'title', features: { distance: true, duration: true } },
    { id: 'dm', category: 'distance', supportsBlackText: false, features: { distance: true, paceSpeed: true, startTime: true } },
    { id: 'tiny-gps', category: 'all', supportsBlackText: true, compact: true, preferredCase: 'title', features: { distance: true, duration: true } },
    { id: 'pulse-row', category: 'all', supportsBlackText: false, features: { heartRate: true } },
    { id: 'thin-path', category: 'distance', supportsBlackText: true, features: { distance: true, paceSpeed: true, map: true } },
    { id: 'step-master', category: 'all', supportsBlackText: true, compact: true, features: { distance: true, duration: true } },
    { id: 'dual-pill', category: 'all', supportsBlackText: true, compact: true, features: { distance: true, duration: true } },
    { id: 'brutalist-letters', category: 'all', supportsBlackText: true, compact: true, features: { distance: true, duration: true } },
    { id: 'boxed-metric', category: 'distance', supportsBlackText: true, compact: true, features: { distance: true } },
    { id: 'condesa-stack', category: 'all', supportsBlackText: true, features: { distance: true, duration: true, paceSpeed: true, startTime: true, date: true } },
    { id: 'mono-minimal', category: 'all', supportsBlackText: true, compact: true, features: { distance: true, duration: true } },
    { id: 'split-badge', category: 'all', supportsBlackText: false, compact: true, features: { distance: true, paceSpeed: true } },
    { id: 'stacked-editorial', category: 'distance', supportsBlackText: true, features: { distance: true, paceSpeed: true, map: true } },
    { id: 'micro-serif', category: 'distance', supportsBlackText: true, features: { distance: true, paceSpeed: true, map: true } },
    { id: 'vhs-retro', category: 'distance', supportsBlackText: false, features: { distance: true, date: true, startTime: true } },
    { id: 'serif-float', category: 'distance', supportsBlackText: true, compact: true, features: { distance: true, duration: true } },
    { id: 'statement', category: 'distance', supportsBlackText: true, compact: true, features: { distance: true, duration: true, date: true } },
    { id: 'massive-serif', category: 'all', supportsBlackText: true, compact: true, features: { distance: true, duration: true } },
    { id: 'mag-cover', category: 'all', supportsBlackText: true, features: { date: true } },
    { id: 'mono-ghost', category: 'all', supportsBlackText: true, features: { duration: true, date: true } },
    { id: 'coords-v2', category: 'distance', supportsBlackText: true, compact: true, features: { distance: true, duration: true } },
    { id: 'marginalia', category: 'all', supportsBlackText: true, compact: true, features: { distance: true, duration: true } },
    { id: 'typewriter-mono', category: 'all', supportsBlackText: true, compact: true, features: { distance: true, duration: true, date: true } },
    { id: 'brutal-slash', category: 'all', supportsBlackText: true, features: { duration: true } },
    { id: 'swiss-minimal', category: 'distance', supportsBlackText: true, compact: true, features: { distance: true, duration: true } },
    { id: 'editorial-row', category: 'all', supportsBlackText: true, features: { distance: true, paceSpeed: true, heartRate: true } },
    { id: 'pure-map', category: 'distance', supportsBlackText: true, features: { map: true } },
    { id: 'pro-vertical', category: 'all', supportsBlackText: true, features: { distance: true, paceSpeed: true, startTime: true } },
    { id: 'mono-split', category: 'distance', supportsBlackText: false, features: { distance: true, paceSpeed: true } },
    { id: 'essential-italic', category: 'distance', supportsBlackText: true, features: { distance: true, paceSpeed: true } },
    { id: 'obsidian-bar', category: 'distance', supportsBlackText: false, features: { distance: true, paceSpeed: true } },

    { id: 'modern-pill', category: 'distance', supportsBlackText: false, preferredCase: 'title', features: { distance: true, paceSpeed: true } },
    { id: 'editorial-archive', category: 'distance', supportsBlackText: false, features: { distance: true, paceSpeed: true, duration: true, date: true } },
    { id: 'info-glass', category: 'all', supportsBlackText: false, features: { distance: true, paceSpeed: true, duration: true } },
    { id: 'workout-receipt', category: 'distance', supportsBlackText: false, features: { distance: true, paceSpeed: true, duration: true, date: true } },
    { id: 'brutalist-bold', category: 'distance', supportsBlackText: false, features: { distance: true, paceSpeed: true } },
    { id: 'data-modular', category: 'distance', supportsBlackText: false, features: { distance: true, paceSpeed: true } },
    { id: 'glass-slice', category: 'distance', supportsBlackText: false, features: { distance: true, paceSpeed: true } },
    { id: 'stealth-bar', category: 'distance', supportsBlackText: false, features: { distance: true, paceSpeed: true } },
    { id: 'track-record', category: 'distance', supportsBlackText: true, features: { distance: true } },
    { id: 'metric-thin', category: 'distance', supportsBlackText: true, features: { distance: true, paceSpeed: true } },
    { id: 'vertical-label', category: 'distance', supportsBlackText: false, features: { distance: true, paceSpeed: true, duration: true } },
    { id: 'stats', category: 'distance', supportsBlackText: true, features: { distance: true, paceSpeed: true } },
    { id: 'minimal', category: 'all', supportsBlackText: true, compact: true, preferredCase: 'title', features: { distance: true, duration: true } },
    { id: 'classic-stack', category: 'all', supportsBlackText: true, features: { distance: true, duration: true, date: true } },
    { id: 'neon-slanted', category: 'all', supportsBlackText: true, features: { distance: true, duration: true } },
    { id: 'aesthetic-medal', category: 'workout', supportsBlackText: true, features: { distance: false, paceSpeed: true, date: true } },
    // Seasonal artifacts (excluded by default)
    { id: 'scora-stealth', category: 'distance', features: { distance: true, paceSpeed: true, duration: true, heartRate: true, map: true }, seasonal: true },
    { id: 'neon-capsule', category: 'distance', features: { distance: true, paceSpeed: true }, seasonal: true },
    { id: 'tech-hud', category: 'distance', features: { distance: true, paceSpeed: true, duration: true }, seasonal: true },
    { id: 'award-badge', category: 'workout', features: { distance: true, duration: true }, seasonal: true },
    { id: 'data-matrix', category: 'distance', features: { distance: true, paceSpeed: true, duration: true }, seasonal: true },
    { id: 'frosted-minimal', category: 'workout', features: { duration: true }, seasonal: true },
    { id: 'pure-map', category: 'distance', features: { map: true }, seasonal: true },
    { id: 'mag-cover', category: 'workout', features: { date: true }, seasonal: true },
    { id: 'mono-ghost', category: 'workout', features: { date: true }, seasonal: true },
    { id: 'typewriter-mono', category: 'all', features: { distance: true, duration: true, date: true }, seasonal: true },
    { id: 'brutal-slash', category: 'workout', features: { duration: true }, seasonal: true },
    { id: 'performance-bars', category: 'distance', supportsBlackText: true, features: { distance: true, paceSpeed: true, duration: true }, seasonal: true },
    { id: 'minimal-vertical', category: 'distance', features: { distance: true, paceSpeed: true, map: true }, seasonal: true },
    { id: '8m2', category: 'distance', features: { distance: true, paceSpeed: true, duration: true, map: true }, seasonal: true },
];

export const TEMPLATES = TEMPLATE_REGISTRY.filter(t => !t.seasonal).map(t => t.id);

// Variety for gallery previews
const GALLERY_MOCKS = MOCK_ACTIVITIES.map(m => formatActivityStats(m));

type OnChangeCallback = (template: string, color: string, showLogo: boolean) => void;

/**
 * Handle visual sticker selection and synchronized navigation.
 */
export function initTemplateManager(onChange: OnChangeCallback) {
    let currentTemplate = TEMPLATES[0] || 'minimal';
    let currentTextColor = 'white';
    let currentShowLogo = true;

    const galleryContainer = document.getElementById('sticker-gallery');
    const dotsContainer = document.getElementById('template-dots');
    const btnPrev = document.getElementById('btn-template-prev') as HTMLButtonElement | null;
    const btnNext = document.getElementById('btn-template-next') as HTMLButtonElement | null;

    function renderGallery() {
        if (!galleryContainer) return;
        galleryContainer.innerHTML = '';

        TEMPLATES.forEach((id, i) => {
            const thumb = document.createElement('div');
            thumb.className = `sticker-thumb transparency-grid ${id === currentTemplate ? 'active' : ''}`;
            thumb.dataset.template = id;


            const canvas = document.createElement('canvas');
            canvas.id = `gallery-canvas-${id}`;
            canvas.width = 360;  // 2x scale for Retina feel
            canvas.height = 640; // 2x scale for Retina feel
            thumb.appendChild(canvas);


            // 🛡️ DEV-ONLY: Debug IDs (localhost only)
            if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
                const label = document.createElement('span');
                label.className = 'sticker-label';
                label.innerText = id;
                thumb.appendChild(label);
            }

            thumb.onclick = () => setTemplate(id);
            galleryContainer.appendChild(thumb);

            // Thumbnail Variety
            const mockIndex = i % GALLERY_MOCKS.length;
            const previewStats = GALLERY_MOCKS[mockIndex];

            setTimeout(() => {
                drawTemplate(canvas.id, previewStats, id, 'white', false);
            }, 0);
        });
    }

    function updateDots() {
        if (!dotsContainer) return;
        dotsContainer.innerHTML = '';
        TEMPLATES.forEach(id => {
            const dot = document.createElement('span');
            dot.className = `template-dot ${id === currentTemplate ? 'active' : ''}`;
            dot.dataset.template = id;
            dot.onclick = () => setTemplate(id);
            dotsContainer.appendChild(dot);
        });
    }

    function setTemplate(id: string) {
        if (!TEMPLATES.includes(id)) return;
        currentTemplate = id;

        // Sync Gallery Active State
        document.querySelectorAll('.sticker-thumb').forEach(el => {
            el.classList.toggle('active', (el as HTMLElement).dataset.template === id);
        });
        
        // Sync Dots (for E2E)
        document.querySelectorAll('.template-dot').forEach(el => {
            el.classList.toggle('active', (el as HTMLElement).dataset.template === id);
        });

        // Sync Arrows
        const idx = TEMPLATES.indexOf(id);
        if (btnPrev) btnPrev.disabled = idx === 0;
        if (btnNext) btnNext.disabled = idx === TEMPLATES.length - 1;

        // Auto-scroll gallery
        const activeThumb = galleryContainer?.querySelector(`.sticker-thumb[data-template="${id}"]`);
        if (activeThumb) {
            activeThumb.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }

        onChange(currentTemplate, currentTextColor, currentShowLogo);
    }

    function initToggle(id: string, onToggle: (isRight: boolean) => void) {
        const el = document.getElementById(id);
        if (!el) return;
        const opts = el.querySelectorAll<HTMLElement>('.toggle-opt');
        function activate(isRight: boolean) {
            el.classList.toggle('right', isRight);
            opts.forEach((opt, i) => opt.classList.toggle('active', i === (isRight ? 1 : 0)));
            onToggle(isRight);
        }
        el.addEventListener('click', () => activate(!el.classList.contains('right')));
        opts.forEach((opt, i) => opt.addEventListener('click', (e) => { e.stopPropagation(); activate(i === 1); }));
    }

    // Navigation Listeners
    btnPrev?.addEventListener('click', () => {
        const idx = TEMPLATES.indexOf(currentTemplate);
        if (idx > 0) setTemplate(TEMPLATES[idx - 1]);
    });
    btnNext?.addEventListener('click', () => {
        const idx = TEMPLATES.indexOf(currentTemplate);
        if (idx < TEMPLATES.length - 1) setTemplate(TEMPLATES[idx + 1]);
    });

    window.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowRight') {
            const idx = TEMPLATES.indexOf(currentTemplate);
            if (idx < TEMPLATES.length - 1) setTemplate(TEMPLATES[idx + 1]);
        }
        if (e.key === 'ArrowLeft') {
            const idx = TEMPLATES.indexOf(currentTemplate);
            if (idx > 0) setTemplate(TEMPLATES[idx - 1]);
        }
    });

    // Swipe Support (E2E)
    const wrapper = document.getElementById('canvas-wrapper');
    if (wrapper) {
        let startX = 0;
        wrapper.addEventListener('touchstart', (e) => { startX = e.touches[0].clientX; }, { passive: true });
        wrapper.addEventListener('touchend', (e) => {
            const delta = e.changedTouches[0].clientX - startX;
            if (Math.abs(delta) < 50) return;
            const idx = TEMPLATES.indexOf(currentTemplate);
            if (delta < 0 && idx < TEMPLATES.length - 1) setTemplate(TEMPLATES[idx + 1]);
            else if (delta > 0 && idx > 0) setTemplate(TEMPLATES[idx - 1]);
        }, { passive: true });
    }

    initToggle('color-toggle', (isBlack) => {
        currentTextColor = isBlack ? 'black' : 'white';
        onChange(currentTemplate, currentTextColor, currentShowLogo);
    });

    initToggle('logo-toggle', (isOff) => {
        currentShowLogo = !isOff;
        onChange(currentTemplate, currentTextColor, currentShowLogo);
    });

    // Initial State
    renderGallery();
    updateDots();
    setTemplate(currentTemplate);

    return {
        get template() { return currentTemplate; },
        get color() { return currentTextColor; },
        get showLogo() { return currentShowLogo; },
        setTemplate
    };
}
