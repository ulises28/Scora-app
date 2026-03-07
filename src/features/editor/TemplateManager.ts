type OnChangeCallback = (template: string, color: string, showLogo: boolean) => void;

const TEMPLATES = ['minimal', 'route', 'data', 'dm', 'stats'];

export function initTemplateManager(onChange: OnChangeCallback) {
    let currentTemplate = 'minimal';
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

    // ── Dot click navigation ──────────────────────────────────────────────────
    document.querySelectorAll('.template-dot').forEach(dot => {
        dot.addEventListener('click', () => {
            const t = (dot as HTMLElement).dataset.template;
            if (t) applyTemplate(t);
        });
    });

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
        }
    };
}
