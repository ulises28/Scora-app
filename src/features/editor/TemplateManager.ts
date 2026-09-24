import { drawTemplate } from './CanvasPainter';
import { MOCK_ACTIVITIES } from '../../api/mocks';
import { formatActivityStats } from '../../api/strava';
import { normalizeSport } from './CanvasUtils';
import { isDebugLabelsHost } from '../../utils/debugHost';

import { STICKER_LIST, STICKER_REGISTRY } from './StickerRegistry';
import { TemplateFeatures } from './types';

// ─── Template Registry — single source of truth ──────────────────────────────
export const TEMPLATE_REGISTRY = STICKER_LIST;

export const TEMPLATES = TEMPLATE_REGISTRY.filter(t => !t.seasonal).map(t => t.id);

// Variety for gallery previews (used when no activity is selected yet)
const GALLERY_MOCKS = MOCK_ACTIVITIES.map(m => formatActivityStats(m));

type OnChangeCallback = (template: string, color: string, showLogo: boolean) => void;

/**
 * Editor template strip: tap a thumb to switch the active sticker.
 * Selection / browsing of the full catalog lives on the sticker grid screen.
 * Live preview: main canvas + active thumb re-render when controls change.
 */
export function initTemplateManager(onChange: OnChangeCallback) {
    let currentTemplates = [...TEMPLATES];
    let currentTemplate = currentTemplates[0] || 'note-minimal';
    let currentTextColor = 'white';
    let currentMapColor = '#ffffff';
    let currentShowLogo = true;
    let currentActiveColor = 'white';
    let currentActivityStats: any = null;

    const galleryContainer = document.getElementById('sticker-gallery');
    const dotsContainer = document.getElementById('template-dots');
    const btnPrev = document.getElementById('btn-template-prev') as HTMLButtonElement | null;
    const btnNext = document.getElementById('btn-template-next') as HTMLButtonElement | null;

    function statsForGallery(index: number) {
        if (currentActivityStats) return currentActivityStats;
        return GALLERY_MOCKS[index % GALLERY_MOCKS.length];
    }

    let previewRaf: number | null = null;
    function refreshGalleryPreviews() {
        if (previewRaf !== null) return;
        previewRaf = requestAnimationFrame(() => {
            previewRaf = null;
            const canvas = document.getElementById(`gallery-canvas-${currentTemplate}`) as HTMLCanvasElement | null;
            if (!canvas) return;
            const idx = currentTemplates.indexOf(currentTemplate);
            const previewStats = statsForGallery(idx >= 0 ? idx : 0);
            const config = STICKER_REGISTRY[currentTemplate];
            let color = currentActiveColor;
            if (currentTemplate.startsWith('chrome')) {
                color = currentActiveColor;
            } else if (config?.supportsCustomColor) {
                color = currentMapColor;
            } else {
                color = currentTextColor;
            }
            drawTemplate(canvas.id, previewStats, currentTemplate, color, currentShowLogo, false);
        });
    }

    function renderGallery() {
        if (!galleryContainer) return;
        galleryContainer.innerHTML = '';

        // One unified strip — all stickers together (no Mini | Full split).
        // Name chips are debug-only (local/staging) — prod strip stays clean.
        const showDebugLabels = isDebugLabelsHost();

        currentTemplates.forEach((id, i) => {
            const thumb = document.createElement('div');
            thumb.className = `sticker-thumb transparency-grid ${id === currentTemplate ? 'active' : ''}`;
            thumb.dataset.template = id;
            thumb.setAttribute('role', 'button');
            thumb.setAttribute('tabindex', '0');
            thumb.setAttribute('aria-label', `Template ${id}`);

            const canvas = document.createElement('canvas');
            canvas.id = `gallery-canvas-${id}`;
            canvas.width = 180;
            canvas.height = 320;
            thumb.appendChild(canvas);

            if (showDebugLabels) {
                const label = document.createElement('span');
                label.className = 'sticker-label';
                label.innerText = id;
                thumb.appendChild(label);
            }

            thumb.onclick = () => setTemplate(id);
            thumb.onkeydown = (e: KeyboardEvent) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setTemplate(id);
                }
            };

            galleryContainer.appendChild(thumb);

            // Lightweight visual preview for every thumb
            const config = STICKER_REGISTRY[id];
            const previewStats = statsForGallery(i);
            let color = 'white';
            if (id.startsWith('chrome')) color = currentActiveColor;
            else if (config?.supportsCustomColor) color = currentMapColor;
            else color = currentTextColor;
            thumbPaintQueue.push({ canvasId: canvas.id, stats: previewStats, id, color, el: thumb });
        });
        pumpThumbQueue();
    }

    // ── Serialized lightweight thumb previews ──
    const thumbPaintQueue: { canvasId: string; stats: any; id: string; color: string; el: HTMLElement }[] = [];
    let thumbPainting = false;
    async function pumpThumbQueue() {
        if (thumbPainting) return;
        thumbPainting = true;
        while (thumbPaintQueue.length) {
            const job = thumbPaintQueue.shift()!;
            try {
                await drawTemplate(job.canvasId, job.stats, job.id, job.color, currentShowLogo, false);
            } catch { /* keep queue alive */ }
            await new Promise(r => setTimeout(r, 0));
        }
        thumbPainting = false;
    }

    function paintThumb(id: string) {
        // Thumb previews are painted once on open — switching only updates main canvas
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
            id = currentTemplates[0] || 'note-minimal';
        }
        currentTemplate = id;

        document.querySelectorAll('.sticker-thumb').forEach(el => {
            el.classList.toggle('active', (el as HTMLElement).dataset.template === id);
        });
        paintThumb(id);

        document.querySelectorAll('.template-dot').forEach(el => {
            el.classList.toggle('active', (el as HTMLElement).dataset.template === id);
        });

        const idx = currentTemplates.indexOf(id);
        if (btnPrev) btnPrev.disabled = idx <= 0;
        if (btnNext) btnNext.disabled = idx === currentTemplates.length - 1 || idx === -1;

        const activeThumb = galleryContainer?.querySelector(`.sticker-thumb[data-template="${id}"]`);
        if (activeThumb) {
            activeThumb.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }

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

    btnPrev?.addEventListener('click', () => {
        const idx = currentTemplates.indexOf(currentTemplate);
        if (idx > 0) setTemplate(currentTemplates[idx - 1]);
    });
    btnNext?.addEventListener('click', () => {
        const idx = currentTemplates.indexOf(currentTemplate);
        if (idx < currentTemplates.length - 1 && idx !== -1) setTemplate(currentTemplates[idx + 1]);
    });

    window.addEventListener('keydown', (e) => {
        // Only when editor is the active screen
        const editor = document.getElementById('screen-editor');
        if (!editor?.classList.contains('active')) return;
        if (e.key === 'ArrowRight') {
            const idx = currentTemplates.indexOf(currentTemplate);
            if (idx < currentTemplates.length - 1 && idx !== -1) setTemplate(currentTemplates[idx + 1]);
        }
        if (e.key === 'ArrowLeft') {
            const idx = currentTemplates.indexOf(currentTemplate);
            if (idx > 0) setTemplate(currentTemplates[idx - 1]);
        }
    });

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
        refreshGalleryPreviews();
    });

    initToggle('logo-toggle', (isOff) => {
        currentShowLogo = !isOff;
        onChange(currentTemplate, currentActiveColor, currentShowLogo);
        refreshGalleryPreviews();
    });

    const mapColorPicker = document.getElementById('map-color-picker') as HTMLInputElement | null;
    const mapColorSwatch = document.getElementById('map-color-swatch');
    const mapColorValue = document.getElementById('map-color-value');

    function updateMapColorUI(color: string, skipChange = false) {
        currentMapColor = color;
        if (mapColorSwatch) mapColorSwatch.style.background = color;
        const picker = document.getElementById('map-color-picker') as HTMLInputElement;

        if (picker) {
            picker.value = color;
        }

        if (mapColorValue) mapColorValue.innerText = color.toUpperCase();

        const config = STICKER_REGISTRY[currentTemplate];
        if (!skipChange && config?.supportsCustomColor) {
            currentActiveColor = currentMapColor;
            onChange(currentTemplate, currentActiveColor, currentShowLogo);
            refreshGalleryPreviews();
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
            refreshGalleryPreviews();
        });
    }

    renderGallery();
    updateDots();
    setTemplate(currentTemplate);

    return {
        get template() { return currentTemplate; },
        get color() { return currentActiveColor; },
        get showLogo() { return currentShowLogo; },
        setTemplate,
        /** Filter templates for an activity without forcing a reset (used by grid → editor). */
        prepareForActivity: (actStats: any, preferredTemplate?: string) => {
            currentActivityStats = actStats;
            const isGym = ['Workout', 'WeightTraining', 'Yoga', 'FunctionalStrength', 'Crossfit'].includes(actStats.type);
            const isTraining = normalizeSport(actStats.type) === 'Training' || isGym;

            currentTemplates = TEMPLATES.filter(id => {
                const config = STICKER_REGISTRY[id];
                const needsMap = config?.features?.map;
                const hasMap = !!actStats.polyline;
                if (needsMap && !hasMap) return false;

                const needsDistance = config?.features?.distance;
                const hasDistance = actStats.hasDistance;
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

            const pick =
                preferredTemplate && currentTemplates.includes(preferredTemplate)
                    ? preferredTemplate
                    : currentTemplates[0] || 'note-minimal';
            setTemplate(pick);
        },
        filterByActivity: (actStats: any) => {
            currentActivityStats = actStats;
            const isGym = ['Workout', 'WeightTraining', 'Yoga', 'FunctionalStrength', 'Crossfit'].includes(actStats.type);
            const isTraining = normalizeSport(actStats.type) === 'Training' || isGym;

            currentTemplates = TEMPLATES.filter(id => {
                const config = STICKER_REGISTRY[id];
                const needsMap = config?.features?.map;
                const hasMap = !!actStats.polyline;
                if (needsMap && !hasMap) return false;

                const needsDistance = config?.features?.distance;
                const hasDistance = actStats.hasDistance;
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
            setTemplate(currentTemplates[0] || 'note-minimal');
        }
    };
}
