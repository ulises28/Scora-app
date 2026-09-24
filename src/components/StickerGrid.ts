import { drawTemplate } from '../features/editor/CanvasPainter';
import { STICKER_REGISTRY, STICKER_LIST } from '../features/editor/StickerRegistry';
import { copyCanvasToClipboard, flashFeedback } from '../features/editor/StickerActions';
import { isDebugLabelsHost } from '../utils/debugHost';

const LONG_PRESS_MS = 480;

type OnOpenEditor = (templateId: string) => void;

/**
 * Sticker grid — browse every template for the open activity.
 * Tap → open editor for that sticker · Long-press → copy 1080×1920 PNG (no editor).
 */
export function initStickerGrid(onOpenEditor: OnOpenEditor) {
    const container = document.getElementById('sticker-grid');
    if (!container) {
        return {
            render: (_stats: any) => { /* no-op */ },
            get templates() { return [] as string[]; },
        };
    }

    let stats: any = null;
    let templates: string[] = STICKER_LIST.filter(t => !t.seasonal).map(t => t.id);

    function colorFor(id: string): { color: string; showLogo: boolean } {
        const config = STICKER_REGISTRY[id];
        // Default grid previews: white ink, logo on — editor can customize after open
        if (id.startsWith('chrome')) return { color: 'rosegold', showLogo: true };
        if (config?.supportsCustomColor) return { color: '#ffffff', showLogo: true };
        return { color: 'white', showLogo: true };
    }

    /** Render at full story resolution offscreen and copy to clipboard. */
    async function copyFullRes(templateId: string, host: HTMLElement): Promise<boolean> {
        if (!stats) return false;
        const off = document.createElement('canvas');
        off.width = 1080;
        off.height = 1920;
        off.id = `grid-export-${templateId}`;
        const holder = document.createElement('div');
        holder.style.cssText = 'position:fixed;left:-9999px;top:0;pointer-events:none;';
        holder.appendChild(off);
        document.body.appendChild(holder);
        try {
            const { color, showLogo } = colorFor(templateId);
            await drawTemplate(off.id, stats, templateId, color, showLogo, false);
            await new Promise((r) => requestAnimationFrame(() => r(null)));
            const ok = await copyCanvasToClipboard(off);
            if (ok) flashFeedback(host, 'copied', 1200);
            return ok;
        } finally {
            holder.remove();
        }
    }

    function render(nextStats: any) {
        stats = nextStats;
        // Same filter rules as TemplateManager.filterByActivity
        const hasMap = !!stats?.polyline;
        const hasDistance = !!stats?.hasDistance;
        templates = STICKER_LIST
            .filter((t) => !t.seasonal)
            .map((t) => t.id)
            .filter((id) => {
                const config = STICKER_REGISTRY[id];
                if (!config) return false;
                if (config.features?.map && !hasMap) return false;
                const needsDistance = config.features?.distance;
                const supportsOthers =
                    config.features?.duration ||
                    config.features?.heartRate ||
                    config.features?.title ||
                    config.features?.location ||
                    config.features?.date ||
                    config.features?.map;
                if (needsDistance && !hasDistance && !supportsOthers) return false;
                return true;
            });

        container.innerHTML = '';

        templates.forEach((id, i) => {
            const cell = document.createElement('button');
            cell.type = 'button';
            cell.className = 'sticker-grid-cell';
            cell.dataset.template = id;
            cell.setAttribute('aria-label', `Open editor for ${id}`);

            // Uniform catalog card: stage (sticker) + label bar — competitor parity
            const stage = document.createElement('div');
            stage.className = 'sticker-card-stage';

            const canvas = document.createElement('canvas');
            canvas.id = `grid-canvas-${id}`;
            canvas.width = 360;
            canvas.height = 640;
            stage.appendChild(canvas);
            cell.appendChild(stage);

            const label = document.createElement('div');
            label.className = 'sticker-card-label';
            label.textContent = id.replace(/-/g, ' ');
            // Names are debug-only (local/staging) — prod grid stays clean (no UI noise)
            if (isDebugLabelsHost()) {
                cell.appendChild(label);
            }

            // Long-press → copy (do NOT open editor)
            let pressTimer: number | null = null;
            let longFired = false;
            let startX = 0;
            let startY = 0;

            const clearPress = () => {
                if (pressTimer !== null) {
                    clearTimeout(pressTimer);
                    pressTimer = null;
                }
            };

            cell.addEventListener('pointerdown', (e) => {
                longFired = false;
                startX = e.clientX;
                startY = e.clientY;
                cell.classList.add('pressing');
                pressTimer = window.setTimeout(() => {
                    longFired = true;
                    cell.classList.remove('pressing');
                    void copyFullRes(id, cell);
                }, LONG_PRESS_MS);
            });
            cell.addEventListener('pointermove', (e) => {
                if (pressTimer === null) return;
                if (Math.abs(e.clientX - startX) > 12 || Math.abs(e.clientY - startY) > 12) {
                    clearPress();
                    cell.classList.remove('pressing');
                }
            });
            const endPress = () => {
                clearPress();
                cell.classList.remove('pressing');
            };
            cell.addEventListener('pointerup', endPress);
            cell.addEventListener('pointercancel', endPress);
            cell.addEventListener('pointerleave', endPress);

            cell.addEventListener('click', () => {
                if (longFired) {
                    longFired = false;
                    return;
                }
                onOpenEditor(id);
            });

            container.appendChild(cell);

            const { color, showLogo } = colorFor(id);
            // Stagger renders so low-end phones don't choke
            requestAnimationFrame(() => {
                setTimeout(() => {
                    void drawTemplate(canvas.id, stats, id, color, showLogo, false);
                }, Math.min(i * 30, 450));
            });
        });
    }

    return {
        render,
        get templates() {
            return [...templates];
        },
    };
}
