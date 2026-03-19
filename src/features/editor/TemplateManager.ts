// ─── Template Registry — single source of truth ──────────────────────────────
// To add a template: add an entry here and implement its renderer in CanvasPainter.ts
// To disable temporarily: set `seasonal: true` (excluded from TEMPLATES by default)
// To re-enable a seasonal template: remove the `seasonal` flag or set it to false
interface TemplateConfig {
    id: string;
    seasonal?: boolean; // seasonal templates are inactive outside their event window
    note?: string;      // human-readable context (why it exists, when to re-enable)
}

export const TEMPLATE_REGISTRY: readonly TemplateConfig[] = [
    // ── ACTIVE & REORDERED ──────────────────────────────────────────────────
    { id: 'social-float' },         // #1 spot
    { id: 'dm' },                   // Moved to #2
    { id: 'mono-split' },           
    { id: 'essential-italic' },     
    { id: 'obsidian-bar' },         
    { id: 'data' },
    { id: 'modern-pill' },
    { id: 'editorial-archive' },    
    { id: 'info-glass' },           
    { id: 'split-badge' },
    { id: 'workout-receipt' },
    { id: 'brutalist-bold' },
    { id: 'data-modular' },
    { id: 'glass-slice' },
    { id: 'vhs-retro' },
    { id: 'stealth-bar' },
    { id: 'track-record' },
    { id: 'metric-thin' },          
    { id: 'vertical-label' },       
    { id: 'stats' },                
    { id: 'minimal' },              // Moved to the end

    // ── INACTIVE / ARCHIVED ─────────────────────────────────────────────────
    { id: 'route', seasonal: true },
    { id: 'scora-stealth', seasonal: true },
    { id: 'neon-capsule', seasonal: true },
    { id: 'tech-hud', seasonal: true },
    { id: 'award-badge', seasonal: true },
    { id: 'data-matrix', seasonal: true },
    { id: 'frosted-minimal', seasonal: true },
    
    // ── SEASONAL ───────────────────────────────────────────────────────────
    { id: '8m', seasonal: true, note: "International Women's Day — 8M (March 8)" },
    { id: '8m2', seasonal: true, note: "International Women's Day — 8M (March 8)" },
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
