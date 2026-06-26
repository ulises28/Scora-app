import { drawTemplate } from './CanvasPainter';
import { MOCK_ACTIVITIES } from '../../api/mocks';
import { formatActivityStats } from '../../api/strava';
import { normalizeSport } from './CanvasUtils';

import { STICKER_LIST, STICKER_REGISTRY } from './StickerRegistry';
import { TemplateFeatures } from './types';

// ─── Template Registry — single source of truth ──────────────────────────────
// Now imported from StickerRegistry.ts to prevent drift.
export const TEMPLATE_REGISTRY = STICKER_LIST;

export const TEMPLATES = TEMPLATE_REGISTRY.filter(t => !t.seasonal).map(t => t.id);

// Variety for gallery previews
const GALLERY_MOCKS = MOCK_ACTIVITIES.map(m => formatActivityStats(m));

type OnChangeCallback = (template: string, color: string, showLogo: boolean) => void;

/**
 * Handle visual sticker selection and synchronized navigation.
 */
export function initTemplateManager(onChange: OnChangeCallback) {
    let currentTemplates = [...TEMPLATES];
    let currentTemplate = currentTemplates[0] || 'note-minimal';
    let currentTextColor = 'white';
    let currentMapColor = '#ffffff';
    let currentShowLogo = true;
    let currentActiveColor = 'white';

    const galleryContainer = document.getElementById('sticker-gallery');
    const dotsContainer = document.getElementById('template-dots');
    const btnPrev = document.getElementById('btn-template-prev') as HTMLButtonElement | null;
    const btnNext = document.getElementById('btn-template-next') as HTMLButtonElement | null;

    function renderGallery() {
        if (!galleryContainer) return;
        galleryContainer.innerHTML = '';

        currentTemplates.forEach((id, i) => {
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

            // 🛡️ Studio Performance: Use requestAnimationFrame to throttle background renders
            // This prevents the main thread from saturating during gallery initialization.
            requestAnimationFrame(async () => {
                await drawTemplate(canvas.id, previewStats, id, 'white', false);
            });
        });
    }

    function updateDots() {
        if (!dotsContainer) return;
        dotsContainer.innerHTML = '';
        currentTemplates.forEach(id => {
            const dot = document.createElement('span');
            dot.className = `template-dot ${id === currentTemplate ? 'active' : ''}`;
            dot.dataset.template = id;
            dot.onclick = () => setTemplate(id);
            dotsContainer.appendChild(dot);
        });
    }

    function setTemplate(id: string) {
        if (!currentTemplates.includes(id)) {
            // Fallback to first available if not found in current filtered set
            id = currentTemplates[0] || 'note-minimal';
        }
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
        const idx = currentTemplates.indexOf(id);
        if (btnPrev) btnPrev.disabled = idx <= 0;
        if (btnNext) btnNext.disabled = idx === currentTemplates.length - 1 || idx === -1;

        // Auto-scroll gallery
        const activeThumb = galleryContainer?.querySelector(`.sticker-thumb[data-template="${id}"]`);
        if (activeThumb) {
            activeThumb.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }

        // Show/Hide Color Controls
        const config = STICKER_REGISTRY[id];
        const colorToggleGroup = document.getElementById('color-toggle')?.parentElement;
        const mapColorGroup = document.getElementById('map-color-group');
        const chromeMaterialGroup = document.getElementById('chrome-material-group');
        const chromeMaterialSelect = document.getElementById('chrome-material-select') as HTMLSelectElement;

        let activeColor = currentTextColor;

        if (id.startsWith('chrome')) {
            colorToggleGroup?.classList.add('hidden');
            mapColorGroup?.classList.add('hidden');
            chromeMaterialGroup?.classList.remove('hidden');
            activeColor = chromeMaterialSelect ? chromeMaterialSelect.value : 'rosegold';
        } else if (config?.supportsCustomColor) {
            colorToggleGroup?.classList.add('hidden');
            mapColorGroup?.classList.remove('hidden');
            chromeMaterialGroup?.classList.add('hidden');
            activeColor = currentMapColor;
            updateMapColorUI(currentMapColor, true);
        } else {
            colorToggleGroup?.classList.remove('hidden');
            mapColorGroup?.classList.add('hidden');
            chromeMaterialGroup?.classList.add('hidden');
        }

        const activeShowLogo = config?.supportsCustomColor ? currentShowLogo : currentShowLogo; // Keep logic consistent
        currentActiveColor = activeColor;
        onChange(currentTemplate, currentActiveColor, currentShowLogo);
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
        const idx = currentTemplates.indexOf(currentTemplate);
        if (idx > 0) setTemplate(currentTemplates[idx - 1]);
    });
    btnNext?.addEventListener('click', () => {
        const idx = currentTemplates.indexOf(currentTemplate);
        if (idx < currentTemplates.length - 1 && idx !== -1) setTemplate(currentTemplates[idx + 1]);
    });

    window.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowRight') {
            const idx = currentTemplates.indexOf(currentTemplate);
            if (idx < currentTemplates.length - 1 && idx !== -1) setTemplate(currentTemplates[idx + 1]);
        }
        if (e.key === 'ArrowLeft') {
            const idx = currentTemplates.indexOf(currentTemplate);
            if (idx > 0) setTemplate(currentTemplates[idx - 1]);
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
            const idx = currentTemplates.indexOf(currentTemplate);
            if (delta < 0 && idx < currentTemplates.length - 1 && idx !== -1) setTemplate(currentTemplates[idx + 1]);
            else if (delta > 0 && idx > 0) setTemplate(currentTemplates[idx - 1]);
        }, { passive: true });
    }

    initToggle('color-toggle', (isBlack) => {
        currentTextColor = isBlack ? 'black' : 'white';
        currentActiveColor = currentTextColor;
        onChange(currentTemplate, currentActiveColor, currentShowLogo);
    });

    initToggle('logo-toggle', (isOff) => {
        currentShowLogo = !isOff;
        onChange(currentTemplate, currentActiveColor, currentShowLogo);
    });

    const mapColorPicker = document.getElementById('map-color-picker') as HTMLInputElement | null;
    const mapColorSwatch = document.getElementById('map-color-swatch');
    const mapColorValue = document.getElementById('map-color-value');

    function updateMapColorUI(color: string, skipChange = false) {
        currentMapColor = color;
        if (mapColorSwatch) mapColorSwatch.style.background = color;
        const mapColorPicker = document.getElementById('map-color-picker') as HTMLInputElement;
        const chromeMaterialSelect = document.getElementById('chrome-material-select') as HTMLSelectElement;

        if (mapColorPicker) {
            mapColorPicker.value = color;
        }

        if (mapColorValue) mapColorValue.innerText = color.toUpperCase();

        const config = STICKER_REGISTRY[currentTemplate];
        if (!skipChange && config?.supportsCustomColor) {
            currentActiveColor = currentMapColor;
            onChange(currentTemplate, currentActiveColor, currentShowLogo);
        }
    }

    if (mapColorPicker) {
        mapColorPicker.addEventListener('input', (e) => {
            const val = (e.target as HTMLInputElement).value;
            currentMapColor = val;
            updateMapColorUI(val, false);
            onChange(currentTemplate, currentActiveColor, currentShowLogo);
        });
    }

    const chromeMaterialSelect = document.getElementById('chrome-material-select') as HTMLSelectElement;
    if (chromeMaterialSelect) {
        chromeMaterialSelect.addEventListener('change', (e) => {
            const val = (e.target as HTMLSelectElement).value;
            currentActiveColor = val;
            onChange(currentTemplate, val, currentShowLogo);
        });
    }

    // Initial State
    renderGallery();
    updateDots();
    setTemplate(currentTemplate);

    return {
        get template() { return currentTemplate; },
        get color() { return currentActiveColor; },
        get showLogo() { return currentShowLogo; },
        setTemplate,
        filterByActivity: (stats: any) => {
            // Studio Grade Classification: Expand "Gym" types to ensure proper sticker filtering
            const isGym = ['Workout', 'WeightTraining', 'Yoga', 'FunctionalStrength', 'Crossfit'].includes(stats.type);
            const isTraining = normalizeSport(stats.type) === 'Training' || isGym;
            
            currentTemplates = TEMPLATES.filter(id => {
                const config = STICKER_REGISTRY[id];
                const needsMap = config?.features?.map;
                const hasMap = !!stats.polyline;

                // 🛡️ Studio Rule 1: Hide map-based stickers if no polyline data is present
                if (needsMap && !hasMap) return false;

                // 🛡️ Studio Rule 2: Hide distance-specific stickers for stationary activities
                const needsDistance = config?.features?.distance;
                const hasDistance = stats.hasDistance;
                const supportsOthers = config?.features?.duration || 
                                     config?.features?.heartRate || 
                                     config?.features?.title || 
                                     config?.features?.location || 
                                     config?.features?.date || 
                                     config?.features?.map;

                if (needsDistance && !hasDistance && !supportsOthers) return false;
                
                return true;
            });

            renderGallery();
            updateDots();
            
            // Always reset to the FIRST sticker in the list when switching activities.
            // This ensures a fresh "Studio Gallery" experience.
            setTemplate(currentTemplates[0] || 'note-minimal');
        }
    };
}
