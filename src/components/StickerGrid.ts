import { drawTemplate } from '../features/editor/CanvasPainter';
import { STICKER_REGISTRY, STICKER_LIST } from '../features/editor/StickerRegistry';
import { copyCanvasToClipboard, flashFeedback } from '../features/editor/StickerActions';
import { isDebugLabelsHost } from '../utils/debugHost';

const LONG_PRESS_MS = 480;

/** Instant catalog thumbnail — no template pipeline (Safari P0). */
function paintDesignCard(canvas: HTMLCanvasElement, id: string) {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    // Soft stage
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, 'rgba(255,255,255,0.06)');
    g.addColorStop(1, 'rgba(255,255,255,0.02)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    // Decorative card shape so it reads as a sticker design
    const cx = w / 2;
    const cy = h * 0.42;
    if (id.includes('glass') || id.includes('digital')) {
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = `700 ${id.includes('digital') ? 28 : 36}px sans-serif`;
        ctx.fillText(id.includes('digital') ? '12.34' : '10.05', cx, cy);
        ctx.font = '500 14px sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.fillText(id.includes('digital') ? '08/24/26' : 'km', cx, cy + 36);
    } else if (id.includes('map') || id.includes('path') || id.includes('route')) {
        ctx.strokeStyle = 'rgba(255,255,255,0.65)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(cx - 50, cy + 30);
        ctx.lineTo(cx - 10, cy - 20);
        ctx.lineTo(cx + 20, cy + 10);
        ctx.lineTo(cx + 55, cy - 35);
        ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.font = '700 16px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('8.42 km', cx, cy + 60);
    } else if (id.includes('music') || id.includes('player') || id.includes('social') || id.includes('note')) {
        ctx.fillStyle = 'rgba(20,24,40,0.92)';
        ctx.beginPath();
        ctx.roundRect(cx - 62, cy - 40, 124, 80, 14);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.15)';
        ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.75)';
        ctx.font = '600 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('ACTIVITY', cx, cy - 12);
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.fillRect(cx - 40, cy + 8, 80, 3);
        ctx.beginPath();
        ctx.arc(cx + 8, cy + 9.5, 4, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.fill();
    } else if (id.includes('chrome')) {
        ctx.font = '800 26px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const w = ctx.measureText('10.05').width;
        const metal = ctx.createLinearGradient(cx - w / 2, cy - 16, cx + w / 2, cy + 16);
        metal.addColorStop(0, '#ffffff');
        metal.addColorStop(0.4, '#c0c0c8');
        metal.addColorStop(0.55, '#ffffff');
        metal.addColorStop(1, '#a0a0a8');
        ctx.fillStyle = metal;
        ctx.fillText('10.05', cx, cy);
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.font = '600 12px sans-serif';
        ctx.fillText('CHROME', cx, cy + 28);
    } else {
        // Generic type card
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.font = '800 28px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('10.05', cx, cy - 8);
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.font = '500 13px sans-serif';
        ctx.fillText('km', cx, cy + 24);
    }

    // Name
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    ctx.font = '700 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(id.replace(/-/g, ' ').toUpperCase().slice(0, 18), w / 2, h - 16);
}

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

        templates.forEach((id) => {
            const cell = document.createElement('button');
            cell.type = 'button';
            cell.className = 'sticker-grid-cell';
            cell.dataset.template = id;
            cell.setAttribute('aria-label', `Open editor for ${id}`);

            // Instant design card — NEVER drawTemplate here (Safari P0)
            const stage = document.createElement('div');
            stage.className = 'sticker-card-stage';

            const canvas = document.createElement('canvas');
            canvas.width = 180;
            canvas.height = 320;
            paintDesignCard(canvas, id);
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
            // No drawTemplate — design card only
        });
    }

    return {
        render,
        get templates() {
            return [...templates];
        },
    };
}
