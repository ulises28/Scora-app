/**
 * Debug-only sticker name labels. Production stays visual-only (no UI noise).
 * True on: localhost, 127.0.0.1, ::1, any hostname containing "staging",
 * Vite dev, or VITE_SHOW_STICKER_LABELS=true.
 */
export function isDebugLabelsHost(): boolean {
    if (import.meta.env.VITE_SHOW_STICKER_LABELS === 'true') return true;
    if (import.meta.env.DEV) return true;
    const host = typeof window !== 'undefined' ? window.location.hostname : '';
    return (
        host === 'localhost' ||
        host === '127.0.0.1' ||
        host === '::1' ||
        host === '[::1]' ||
        host.includes('staging')
    );
}
