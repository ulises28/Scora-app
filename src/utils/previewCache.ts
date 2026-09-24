/**
 * Design snapshot cache — grid + gallery use STATIC images only.
 * Each sticker is rendered ONCE (mock stats) into a data URL, then reused.
 * Live drawTemplate runs only on the main editor/export canvas (Safari P0).
 */
import { drawTemplate } from '../features/editor/CanvasPainter';
import { MOCK_STATS_RUN } from './catalogMocks';

const cache = new Map<string, string>();
let generating: Promise<void> | null = null;

async function renderOne(id: string): Promise<string> {
    const existing = cache.get(id);
    if (existing) return existing;

    const off = document.createElement('canvas');
    // Must use grid-canvas-* so drawTemplate takes the THUMB path
    // (180×320, chrome letterforms, no async WebGL — otherwise toDataURL is empty)
    off.id = `grid-canvas-snap-${id}`;
    off.width = 180;
    off.height = 320;
    const holder = document.createElement('div');
    holder.style.cssText = 'position:fixed;left:-9999px;top:0;';
    holder.appendChild(off);
    document.body.appendChild(holder);

    try {
        await drawTemplate(off.id, { ...MOCK_STATS_RUN }, id, id.startsWith('chrome') ? 'rosegold' : '#ffffff', true, false);
        // Yield so any rAF settle work can finish before we snapshot
        await new Promise(r => requestAnimationFrame(() => setTimeout(r, 0)));
        const url = off.toDataURL('image/png');
        cache.set(id, url);
        return url;
    } finally {
        holder.remove();
    }
}

/** Generate snapshots for a list of template ids (serialized, idle-friendly). */
export function warmPreviewCache(ids: string[]): Promise<void> {
    if (generating) return generating;
    generating = (async () => {
        for (const id of ids) {
            try {
                await renderOne(id);
            } catch { /* skip broken id */ }
            await new Promise(r => setTimeout(r, 0));
        }
    })();
    return generating;
}

export function getPreview(id: string): string | null {
    return cache.get(id) || null;
}

export function ensurePreview(id: string): Promise<string> {
    return renderOne(id);
}
