// ─── Template Registry — single source of truth ──────────────────────────────
// To add a template: add an entry here and implement its renderer in CanvasPainter.ts
// To disable temporarily: set `seasonal: true` (excluded from TEMPLATES by default)
// To re-enable a seasonal template: remove the `seasonal` flag or set it to false
export interface TemplateFeatures {
    distance?: boolean;      // e.g. "9.64 km"
    paceSpeed?: boolean;     // e.g. "5:00 /km" or "16.9 km/h"
    duration?: boolean;      // e.g. "1h 11m"
    heartRate?: boolean;     // e.g. "122 bpm"
    date?: boolean;          // e.g. "FRIDAY 18"
    startTime?: boolean;     // e.g. "9:31 AM"
    map?: boolean;           // template renders a map polyline
}

interface TemplateConfig {
    id: string;
    features: TemplateFeatures;
    category: 'distance' | 'workout' | 'all'; // test hint: which mock activity type provides the best coverage
    supportsBlackText?: boolean; // Whether template logic responds to the black/white toggle
    seasonal?: boolean; // seasonal templates are inactive outside their event window
    note?: string;      // human-readable context (why it exists, when to re-enable)
}

export const TEMPLATE_REGISTRY: readonly TemplateConfig[] = [
    { 
        id: 'location-pill', 
        category: 'all',
        supportsBlackText: true,
        features: { distance: true, duration: true } 
    },
    // ── ACTIVE & REORDERED ──────────────────────────────────────────────────
    { 
        id: 'dm', 
        category: 'distance',
        supportsBlackText: false,
        features: { distance: true, paceSpeed: true, duration: true, startTime: true } 
    },
    { 
        id: 'tiny-gps', 
        category: 'all',
        supportsBlackText: true,
        features: { distance: true, duration: true } 
    },
    { 
        id: 'pulse-row', 
        category: 'all',
        supportsBlackText: false,
        features: { heartRate: true } 
    },
    { 
        id: 'thin-path', 
        category: 'distance',
        supportsBlackText: true,
        features: { distance: true, paceSpeed: true, duration: true, map: true } 
    },
    { 
        id: 'step-master', 
        category: 'all',
        supportsBlackText: true,
        features: { distance: true, duration: true } 
    },
    { 
        id: 'dual-pill', 
        category: 'all',
        supportsBlackText: true,
        features: { distance: true, duration: true } 
    },
    { 
        id: 'brutalist-letters', 
        category: 'all',
        supportsBlackText: true,
        features: { distance: true, duration: true } 
    },
    { 
        id: 'boxed-metric', 
        category: 'distance',
        supportsBlackText: true,
        features: { distance: true, duration: true } 
    },
    { 
        id: 'mono-minimal', 
        category: 'all',
        supportsBlackText: true,
        features: { distance: true, duration: true } 
    },
    { 
        id: 'split-badge', 
        category: 'all',
        supportsBlackText: false,
        features: { distance: true, paceSpeed: true, duration: true, heartRate: true } 
    },
    { 
        id: 'stacked-editorial', 
        category: 'distance',
        supportsBlackText: true,
        features: { distance: true, paceSpeed: true, duration: true, map: true } 
    },
    { 
        id: 'micro-serif', 
        category: 'distance',
        supportsBlackText: true,
        features: { distance: true, paceSpeed: true, duration: true, map: true } 
    },
    { 
        id: 'vhs-retro', 
        category: 'distance',
        supportsBlackText: false,
        features: { distance: true, duration: true, date: true, startTime: true } 
    },

    // ── REST OF TEMPLATES ──
    { 
        id: 'social-float', 
        category: 'distance',
        supportsBlackText: true,
        features: { distance: true, paceSpeed: true, duration: true, date: true, startTime: true } 
    },
    { 
        id: 'statement', 
        category: 'distance',
        supportsBlackText: true,
        features: { distance: true, duration: true } 
    },
    { 
        id: 'massive-serif', 
        category: 'all',
        supportsBlackText: true,
        features: { distance: true, duration: true } 
    },
    { 
        id: 'mag-cover', 
        category: 'all',
        supportsBlackText: true,
        features: { duration: true, date: true } 
    },
    { 
        id: 'mono-ghost', 
        category: 'all',
        supportsBlackText: true,
        features: { duration: true, date: true } 
    },
    { 
        id: 'coords-v2', 
        category: 'distance',
        supportsBlackText: true,
        features: { distance: true, duration: true } 
    },
    { 
        id: 'marginalia', 
        category: 'all',
        supportsBlackText: true,
        features: { distance: true, duration: true } 
    },
    { 
        id: 'typewriter-mono', 
        category: 'all',
        supportsBlackText: true,
        features: { distance: true, duration: true, date: true } 
    },
    { 
        id: 'brutal-slash', 
        category: 'all',
        supportsBlackText: true,
        features: { duration: true } 
    },
    { 
        id: 'swiss-minimal', 
        category: 'distance',
        supportsBlackText: true,
        features: { distance: true, duration: true } 
    },
    { 
        id: 'editorial-row', 
        category: 'all',
        supportsBlackText: true,
        features: { distance: true, paceSpeed: true, duration: true, heartRate: true } 
    },
    { 
        id: 'pure-map', 
        category: 'distance',
        supportsBlackText: true,
        features: { map: true } 
    },
    { 
        id: 'pro-vertical', 
        category: 'all',
        supportsBlackText: true,
        features: { distance: true, paceSpeed: true, duration: true, startTime: true } 
    },
    { 
        id: 'mono-split', 
        category: 'distance',
        supportsBlackText: true,
        features: { distance: true, paceSpeed: true, duration: true } 
    },
    { 
        id: 'essential-italic', 
        category: 'distance',
        supportsBlackText: true,
        features: { distance: true, paceSpeed: true, duration: true } 
    },
    { 
        id: 'obsidian-bar', 
        category: 'distance',
        supportsBlackText: true,
        features: { distance: true, paceSpeed: true, duration: true } 
    },
    { 
        id: 'data', 
        category: 'distance',
        supportsBlackText: true,
        features: { distance: true, paceSpeed: true, duration: true, heartRate: true } 
    },
    { 
        id: 'modern-pill', 
        category: 'distance',
        supportsBlackText: false,
        features: { distance: true, paceSpeed: true, duration: true, heartRate: true } 
    },
    { 
        id: 'editorial-archive', 
        category: 'distance',
        supportsBlackText: true,
        features: { distance: true, paceSpeed: true, duration: true } 
    },
    { 
        id: 'info-glass', 
        category: 'all',
        supportsBlackText: false,
        features: { distance: true, paceSpeed: true, duration: true, heartRate: true } 
    },
    { 
        id: 'workout-receipt', 
        category: 'distance',
        supportsBlackText: false,
        features: { distance: true, paceSpeed: true, duration: true, date: true } 
    },
    { 
        id: 'brutalist-bold', 
        category: 'distance',
        supportsBlackText: true,
        features: { distance: true, paceSpeed: true, duration: true } 
    },
    { 
        id: 'data-modular', 
        category: 'distance',
        supportsBlackText: true,
        features: { distance: true, paceSpeed: true, duration: true } 
    },
    { 
        id: 'glass-slice', 
        category: 'distance',
        supportsBlackText: false,
        features: { distance: true, map: true } 
    },
    { 
        id: 'stealth-bar', 
        category: 'distance',
        supportsBlackText: false,
        features: { distance: true, paceSpeed: true, duration: true } 
    },
    { id: 'track-record', category: 'distance', supportsBlackText: true, features: { distance: true } },
    { 
        id: 'metric-thin', 
        category: 'distance',
        supportsBlackText: true,
        features: { distance: true, paceSpeed: true, duration: true } 
    },
    { 
        id: 'vertical-label', 
        category: 'distance',
        supportsBlackText: false,
        features: { distance: true, paceSpeed: true, duration: true } 
    },
    { 
        id: 'stats', 
        category: 'all',
        supportsBlackText: true,
        features: { distance: true, paceSpeed: true, duration: true, heartRate: true } 
    },
    { 
        id: 'minimal', 
        category: 'all',
        supportsBlackText: true,
        features: { distance: true, duration: true } 
    },
    { id: 'scora-stealth', category: 'distance', features: { distance: true, paceSpeed: true, duration: true, heartRate: true, map: true }, seasonal: true },
    { id: 'neon-capsule', category: 'distance', features: { distance: true, paceSpeed: true }, seasonal: true },
    { id: 'tech-hud', category: 'distance', features: { distance: true, paceSpeed: true, duration: true }, seasonal: true },
    { id: 'award-badge', category: 'workout', features: { distance: true, duration: true }, seasonal: true },
    { id: 'data-matrix', category: 'distance', features: { distance: true, paceSpeed: true, duration: true }, seasonal: true },
    { id: 'frosted-minimal', category: 'workout', features: { duration: true }, seasonal: true },
    { 
        id: 'performance-bars', 
        category: 'distance',
        supportsBlackText: true,
        features: { distance: true, paceSpeed: true, duration: true },
        seasonal: true,
        note: "In development - splits data flow refinement pending"
    },
    { 
        id: 'script-serif', 
        category: 'distance',
        supportsBlackText: true,
        features: { distance: true, paceSpeed: true, map: true }, 
        seasonal: true,
        note: "Archived per user request - Mar 2026"
    },
    { id: '8m2', category: 'distance', features: { distance: true, paceSpeed: true, duration: true, map: true }, seasonal: true, note: "International Women's Day — 8M (March 8)" },
];

// Active template list — the only thing all consumers (UI, unit tests, e2e) should use.
// Adding/removing templates: edit TEMPLATE_REGISTRY above. Do not touch this line.
export const TEMPLATES = TEMPLATE_REGISTRY
    .filter(t => !t.seasonal)
    .map(t => t.id);

type OnChangeCallback = (template: string, color: string, showLogo: boolean) => void;

export function initTemplateManager(onChange: OnChangeCallback) {
    let currentTemplate = TEMPLATES[0] || 'minimal';
    let currentTextColor = 'white';
    let currentShowLogo = true;

    // ── Template index helpers ────────────────────────────────────────────────
    function currentIndex() {
        return TEMPLATES.indexOf(currentTemplate);
    }

    function goToIndex(idx: number) {
        const clamped = Math.max(0, Math.min(TEMPLATES.length - 1, idx));
        applyTemplate(TEMPLATES[clamped]);
    }

    function applyTemplate(template: string) {
        currentTemplate = template;
        updateDots();
        updateArrows();
        onChange(currentTemplate, currentTextColor, currentShowLogo);
    }

    function updateDots() {
        document.querySelectorAll('.template-dot').forEach(dot => {
            const isActive = (dot as HTMLElement).dataset.template === currentTemplate;
            dot.classList.toggle('active', isActive);
        });
    }

    // ── Dynamic dot generation ────────────────────────────────────────────────
    // Dots are built from TEMPLATES so adding/removing a template here is enough.
    const dotsContainer = document.getElementById('template-dots');
    if (dotsContainer) {
        dotsContainer.innerHTML = '';
        TEMPLATES.forEach((t, i) => {
            const span = document.createElement('span');
            span.className = 'template-dot' + (i === 0 ? ' active' : '');
            span.dataset.template = t;
            span.addEventListener('click', () => applyTemplate(t));
            dotsContainer.appendChild(span);
        });
    }

    // ── Swipe gesture on canvas wrapper ──────────────────────────────────────
    const canvasWrapper = document.getElementById('canvas-wrapper');
    if (canvasWrapper) {
        let touchStartX = 0;
        const SWIPE_THRESHOLD = 50; // px

        canvasWrapper.addEventListener('touchstart', (e: TouchEvent) => {
            touchStartX = e.touches[0].clientX;
        }, { passive: true });

        canvasWrapper.addEventListener('touchend', (e: TouchEvent) => {
            const delta = e.changedTouches[0].clientX - touchStartX;
            if (Math.abs(delta) < SWIPE_THRESHOLD) return;
            goToIndex(currentIndex() + (delta < 0 ? 1 : -1));
        }, { passive: true });

        // Also support keyboard arrows (accessibility)
        canvasWrapper.addEventListener('keydown', (e: KeyboardEvent) => {
            if (e.key === 'ArrowRight') goToIndex(currentIndex() + 1);
            if (e.key === 'ArrowLeft') goToIndex(currentIndex() - 1);
        });
        canvasWrapper.setAttribute('tabindex', '0');
        canvasWrapper.setAttribute('role', 'region');
        canvasWrapper.setAttribute('aria-label', 'Swipe to change template');
    }

    // ── Desktop prev/next arrows ──────────────────────────────────────────────
    const btnPrev = document.getElementById('btn-template-prev') as HTMLButtonElement | null;
    const btnNext = document.getElementById('btn-template-next') as HTMLButtonElement | null;

    function updateArrows() {
        const idx = currentIndex();
        if (btnPrev) btnPrev.disabled = idx === 0;
        if (btnNext) btnNext.disabled = idx === TEMPLATES.length - 1;
    }

    btnPrev?.addEventListener('click', () => goToIndex(currentIndex() - 1));
    btnNext?.addEventListener('click', () => goToIndex(currentIndex() + 1));
    updateArrows(); // set correct initial disabled state

    // ── Helper: wire up a two-option pill toggle ──────────────────────────────
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
        opts.forEach((opt, i) => {
            opt.addEventListener('click', (e) => { e.stopPropagation(); activate(i === 1); });
        });
    }

    // ── B/W toggle ───────────────────────────────────────────────────────────
    initToggle('color-toggle', (isBlack) => {
        currentTextColor = isBlack ? 'black' : 'white';
        onChange(currentTemplate, currentTextColor, currentShowLogo);
    });

    // ── Logo toggle ──────────────────────────────────────────────────────────
    initToggle('logo-toggle', (isOff) => {
        currentShowLogo = !isOff;
        onChange(currentTemplate, currentTextColor, currentShowLogo);
    });

    return {
        get template() { return currentTemplate; },
        get color() { return currentTextColor; },
        get showLogo() { return currentShowLogo; },

        /** Programmatically jump to a template (used when opening a new activity) */
        setTemplate(template: string) {
            currentTemplate = template;
            updateDots();
            updateArrows();
        }
    };
}
