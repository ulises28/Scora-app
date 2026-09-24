/**
 * StickerActions — clipboard + save primitives for the sticker sheet.
 * Tap = copy · long-press = save · pack = batch export.
 */

export type FeedbackHost = HTMLElement | null;

function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
    return new Promise((resolve, reject) => {
        canvas.toBlob((blob) => {
            if (blob) resolve(blob);
            else reject(new Error('Canvas toBlob failed'));
        }, 'image/png');
    });
}

/** Copy a canvas image to the system clipboard (Safari-compatible ClipboardItem). */
export async function copyCanvasToClipboard(canvas: HTMLCanvasElement | null): Promise<boolean> {
    if (!canvas) return false;
    if (typeof window.ClipboardItem === 'undefined' || !navigator.clipboard?.write) {
        console.warn('[Sticker] Clipboard API not available.');
        return false;
    }
    try {
        const imagePromise = canvasToPngBlob(canvas);
        const item = new window.ClipboardItem({ 'image/png': imagePromise });
        await navigator.clipboard.write([item]);
        console.log('[Sticker] Copied to clipboard.');
        return true;
    } catch (err) {
        console.error('[Sticker] Clipboard write failed:', err);
        return false;
    }
}

/** Save/share a canvas as PNG (iOS share sheet → Photos; elsewhere download). */
export async function saveCanvasAsPng(
    canvas: HTMLCanvasElement | null,
    nameBase = 'scora'
): Promise<void> {
    if (!canvas) return;
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = [now.getHours(), now.getMinutes(), now.getSeconds()]
        .map((v) => String(v).padStart(2, '0'))
        .join('');
    const fileName = `${nameBase}-${dateStr}-${timeStr}.png`;

    const isIOS =
        /iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (/Macintosh/i.test(navigator.userAgent) && navigator.maxTouchPoints > 1) ||
        /Mobile/i.test(navigator.userAgent);

    if (isIOS && navigator.share && navigator.canShare) {
        try {
            const blob = await canvasToPngBlob(canvas);
            const file = new File([blob], fileName, { type: 'image/png' });
            if (navigator.canShare({ files: [file] })) {
                await navigator.share({
                    files: [file],
                    title: 'Scora Sticker',
                    text: 'Created with Scora',
                });
                return;
            }
        } catch (err) {
            console.warn('[Sticker] Web Share failed, falling back to download:', err);
        }
    }

    const link = document.createElement('a');
    link.download = fileName;
    link.href = canvas.toDataURL('image/png');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

/** Brief visual feedback on a host element (e.g. "copied" flash). */
export function flashFeedback(host: FeedbackHost, className: string, ms = 1500): void {
    if (!host) return;
    host.classList.add(className);
    window.setTimeout(() => host.classList.remove(className), ms);
}

export interface PackItem {
    templateId: string;
    canvasId: string;
}

/**
 * Batch export: render each pack item offscreen and download sequentially.
 * Web clipboard holds one image at a time — sequential PNG downloads are
 * the practical multi-sticker equivalent of Aura Clipboard.
 */
export async function exportStickerPack(
    items: PackItem[],
    render: (canvasId: string, templateId: string) => Promise<void>,
    onProgress?: (done: number, total: number, templateId: string) => void
): Promise<number> {
    let saved = 0;
    const total = items.length;
    // Offscreen host so we don't thrash visible gallery canvases
    const host = document.createElement('div');
    host.style.cssText = 'position:fixed;left:-9999px;top:0;pointer-events:none;';
    document.body.appendChild(host);

    try {
        for (let i = 0; i < total; i++) {
            const item = items[i];
            const canvas = document.createElement('canvas');
            canvas.id = `pack-canvas-${item.templateId}`;
            canvas.width = 1080;
            canvas.height = 1920;
            host.appendChild(canvas);

            await render(canvas.id, item.templateId);
            // Allow paint / font raster
            await new Promise((r) => requestAnimationFrame(() => r(null)));
            await saveCanvasAsPng(canvas, `scora-${item.templateId}`);
            saved++;
            onProgress?.(saved, total, item.templateId);
            canvas.remove();
        }
    } finally {
        host.remove();
    }
    return saved;
}
