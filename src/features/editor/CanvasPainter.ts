/**
 * CanvasPainter.ts — Scora rendering engine
 * 
 * Conventions:
 *  - All label strings: Title Case English
 *  - All number values: semi-transparent (0.45 alpha)
 *  - All unit strings:  fully solid
 *  - textColor: 'white' | 'black'
 *  - showLogo:  controls whether the SCORA. branding is drawn
 */

import { getThemeColors, drawStatWithUnit, setLetterSpacing, drawRoutePath, decodePolyline, getDynamicStats, drawMetricBlock, parseDurationParts, drawDurationSequence, normalizeSport } from './CanvasUtils';
import { applyLiquidMetalEffect } from './LiquidMetalRenderer';
import { StickerStats } from '../../api/strava';
import { STICKER_REGISTRY } from './StickerRegistry';

// ─── Polyfills (Safari iOS < 16 Compatibility) ──────────────────────────────
if (typeof CanvasRenderingContext2D !== 'undefined' && !CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function (x: number, y: number, w: number, h: number, radii?: number | number[]) {
        let r: any = radii;
        if (typeof r === 'undefined') r = 0;
        if (typeof r === 'number') r = { tl: r, tr: r, br: r, bl: r };
        else if (Array.isArray(r)) {
            if (r.length === 1) r = { tl: r[0], tr: r[0], br: r[0], bl: r[0] };
            else if (r.length === 2) r = { tl: r[0], tr: r[1], br: r[0], bl: r[1] };
            else if (r.length === 3) r = { tl: r[0], tr: r[1], br: r[2], bl: r[1] };
            else if (r.length === 4) r = { tl: r[0], tr: r[1], br: r[2], bl: r[3] };
        }

        if (w < 0) { x += w; w = Math.abs(w); }
        if (h < 0) { y += h; h = Math.abs(h); }

        this.moveTo(x + r.tl, y);
        this.lineTo(x + w - r.tr, y);
        this.quadraticCurveTo(x + w, y, x + w, y + r.tr);
        this.lineTo(x + w, y + h - r.br);
        this.quadraticCurveTo(x + w, y + h, x + w - r.br, y + h);
        this.lineTo(x + r.bl, y + h);
        this.quadraticCurveTo(x, y + h, x, y + h - r.bl);
        this.lineTo(x, y + r.tl);
        this.quadraticCurveTo(x, y, x + r.tl, y);
        this.closePath();
    };
}

// ─── Asset Pre-loading (Node-safe) ──────────────────────────────────────────
// We check for 'Image' existence to prevent crashes during Node-based analysis/tests.
const paperTexture = typeof Image !== 'undefined' ? new Image() : null;
if (paperTexture) paperTexture.src = '/assets/paper-texture.jpg';


// ─── Shared colour helpers ───────────────────────────────────────────────────

/**
 * Applies the design-compliant casing to an activity label based on template metadata.
 */
function applyActivityCasing(label: string, templateId?: string): string {
    const config = templateId ? STICKER_REGISTRY[templateId] : null;
    const casing = config?.preferredCase || 'uppercase'; // Default to Studio Bold

    if (casing === 'uppercase') return label.toUpperCase();
    if (casing === 'lowercase') return label.toLowerCase();
    if (casing === 'title') return label.charAt(0).toUpperCase() + label.slice(1).toLowerCase();
    return label;
}

function hexToRgb(hex: string) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : '255, 255, 255';
}

function isColorDark(hex: string) {
    if (!hex.startsWith('#')) return hex === 'black';
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b; // ITU-R BT.709
    return luma < 128;
}

function buildColors(textColor: string) {
    const alphaValue = 0.9;
    let base = '255, 255, 255';
    if (textColor === 'black') base = '0, 0, 0';
    else if (textColor.startsWith('#')) base = hexToRgb(textColor);

    const isDark = isColorDark(textColor.startsWith('#') ? textColor : (textColor === 'black' ? '#000000' : '#ffffff'));

    const accent = textColor.startsWith('#') ? textColor : (textColor === 'black' ? '#000000' : '#ffffff');

    return {
        solid: `rgb(${base})`,
        trans: `rgba(${base}, ${alphaValue})`,
        label: isDark ? 'rgba(255,255,255,0.75)' : 'rgba(0,0,0,0.75)',
        accent: accent,
    };
}

export function applyAntiGhostingShadow(ctx: CanvasRenderingContext2D, textColor: string) {
    const isDark = isColorDark(textColor.startsWith('#') ? textColor : (textColor === 'black' ? '#000000' : '#ffffff'));
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 6;
    ctx.shadowBlur = 25;
    ctx.shadowColor = isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.45)';
}



/**
 * Draws the Scora Activity Icons (Run, Bike, Workout) using Canvas Paths.
 * Optimized for high-fidelity rendering within stickers.
 */

export function drawScoraActivityIcon(ctx: CanvasRenderingContext2D, type: string, size = 24, color = "white", x?: number, y?: number) {
    ctx.save();
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const lowerType = type.toLowerCase();
    const s = size / 24;

    // If x/y not provided, fall back to default sticker center-bottom logic
    const drawX = x !== undefined ? x : (540 - size / 2);
    const drawY = y !== undefined ? y : 1450;

    ctx.translate(drawX, drawY);

    if (lowerType.includes('run')) {
        // SCORA V15 "ABSOLUTE PERFECTION" RUNNER (Definitive Dreamstime Match)
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';

        // Head (Properly scaled)
        ctx.beginPath(); ctx.arc(17.5 * s, 4.5 * s, 3 * s, 0, Math.PI * 2); ctx.fill();

        ctx.lineWidth = 4 * s; // Bold professional weight
        ctx.beginPath();

        // Torso
        ctx.moveTo(15 * s, 8.5 * s); ctx.lineTo(11.5 * s, 15 * s);

        // Back Leg (Precise Hook)
        ctx.moveTo(11.5 * s, 15 * s); ctx.lineTo(5 * s, 18.5 * s); ctx.lineTo(1.5 * s, 14 * s);

        // Lead Leg (Power Strike)
        ctx.moveTo(11.5 * s, 15 * s); ctx.lineTo(19 * s, 20 * s); ctx.lineTo(16 * s, 24 * s);

        // Lead Arm (Pumping Forward)
        ctx.moveTo(15 * s, 9 * s); ctx.lineTo(21 * s, 12 * s); ctx.lineTo(17.5 * s, 16.5 * s);

        // Back Arm (Trailing)
        ctx.moveTo(15 * s, 9 * s); ctx.lineTo(9.5 * s, 12 * s); ctx.lineTo(12.5 * s, 16 * s);

        ctx.stroke();
    } else if (lowerType.includes('bike') || lowerType.includes('ride')) {
        // SCORA V3 BIKE ICON
        ctx.lineWidth = 1.8 * s;
        ctx.beginPath(); ctx.arc(6.5 * s, 17 * s, 4 * s, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.arc(17.5 * s, 17 * s, 4 * s, 0, Math.PI * 2); ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(6.5 * s, 17 * s);
        ctx.lineTo(10 * s, 10 * s);
        ctx.quadraticCurveTo(11 * s, 7 * s, 14 * s, 7 * s);
        ctx.quadraticCurveTo(17 * s, 7 * s, 16 * s, 11 * s);
        ctx.lineTo(12 * s, 11 * s);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(17.5 * s, 17 * s);
        ctx.lineTo(14 * s, 8.5 * s);
        ctx.lineTo(16 * s, 6.5 * s);
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(15.5 * s, 4 * s, 1.5 * s, 0, Math.PI * 2);
        ctx.fill();
    } else {
        // SCORA V3 GYM ICON
        ctx.lineWidth = 2.2 * s;
        ctx.beginPath(); ctx.moveTo(5 * s, 8 * s); ctx.lineTo(5 * s, 16 * s); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(8 * s, 6 * s); ctx.lineTo(8 * s, 18 * s); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(16 * s, 6 * s); ctx.lineTo(16 * s, 18 * s); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(19 * s, 8 * s); ctx.lineTo(19 * s, 16 * s); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(8 * s, 12 * s); ctx.lineTo(16 * s, 12 * s); ctx.stroke();
    }

    ctx.restore();
}


// ─── Modular Dispatchers ──────────────────────────────────────────────────────
// These helpers allow the Sticker Data Agent to trace complex multi-sport logic.

export function drawStatsModular(ctx, stats, textColor) {
    const isGym = stats.type === 'Workout';
    if (isGym) drawGymStats(ctx, stats, textColor);
    else drawStatsTemplate(ctx, stats, textColor);
}

export function drawMinimalModular(ctx, stats, textColor) {
    const isGym = stats.type === 'Workout';
    if (isGym) drawGymMinimal(ctx, stats, textColor);
    else drawRunningMinimal(ctx, stats, textColor);
}

export function drawRouteModular(ctx, stats, textColor) {
    const isGym = stats.type === 'Workout';
    if (isGym) drawGymEffort(ctx, stats, textColor);
    else drawRunningRoute(ctx, stats, textColor);
}

export function draw8MModular(ctx, stats, textColor) {
    draw8MTemplate(ctx, stats, '8m', true);
}

export function draw8M2Modular(ctx, stats, textColor) {
    draw8MTemplate(ctx, stats, '8m2', true);
}

export function drawDMModular(ctx, stats, textColor) {
    drawDMBubble(ctx, stats);
}

// ─── Public API ───────────────────────────────────────────────────────────────

// ─── Sticker Registry Architecture ───────────────────────────────────────────

/**
 * StickerRenderer type for all template drawing functions.
 */
type StickerRenderer = (ctx: CanvasRenderingContext2D, stats: any, textColor: string) => void;

/**
 * Registry mapping template IDs to their renderers.
 * Supports category-specific overrides (running/gym).
 */

/**
 * Main Public API — Draws a template based on type and stats.
 */
export async function drawTemplate(
    canvasId: string,
    stats: any,
    templateType = 'minimal',
    textColor = 'white',
    showLogo = true,
    isMain = false // 🚀 Studio Grade: Only main canvas triggers E2E signals
) {
    if (typeof document !== 'undefined' && 'fonts' in document) {
        try {
            await Promise.race([
                Promise.all([
                    document.fonts.load("500 12px 'Plus Jakarta Sans'"),
                    document.fonts.load("700 12px 'Plus Jakarta Sans'"),
                    document.fonts.load("800 12px 'Plus Jakarta Sans'"),
                    document.fonts.load("500 12px 'Elms Sans'")
                ]),
                new Promise(resolve => setTimeout(resolve, 500))
            ]);
        } catch (e) {
            console.warn("[Canvas] Font preloading failed:", e);
        }
    }
    const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
    const ctx = canvas?.getContext('2d');
    if (isMain) {
        (window as any)._scoraIsSettled = false;
        (window as any)._scoraLastDrawId = ((window as any)._scoraLastDrawId || 0) + 1;
    }

    if (!ctx) {
        if (isMain) {
            (window as any)._scoraSettledId = (window as any)._scoraLastDrawId;
            (window as any)._scoraIsSettled = true;
        }
        return;
    }

    // Standard Story resolution (1080 × 1920)
    const TARGET_W = 1080;
    const TARGET_H = 1920;

    // Only set width/height if they aren't already proportionally set (avoids memory bombs on gallery)
    if (canvas.width === 300 || canvas.width === 0) {
        canvas.width = TARGET_W;
        canvas.height = TARGET_H;
    }

    const scaleX = canvas.width / TARGET_W;
    const scaleY = canvas.height / TARGET_H;

    ctx.save();
    ctx.scale(scaleX, scaleY);
    ctx.clearRect(0, 0, TARGET_W, TARGET_H);

    // ── Optional SCORA branding ──────────────────────────────────────────────
    if (showLogo && !templateType.startsWith('chrome')) {
        ctx.textAlign = 'left';
        ctx.fillStyle = '#80cbc4';
        ctx.beginPath();
        ctx.arc(80, 100, 10, 0, Math.PI * 2);
        ctx.fill();

        ctx.font = "700 42px 'Plus Jakarta Sans'";
        ctx.fillStyle = textColor; // Direct match to user preference
        ctx.fillText('SCORA.', 110, 115);
    }

    // ── Unified Registry Lookup ──────────────────────────────────────────────
    const sticker = STICKER_REGISTRY[templateType] || STICKER_REGISTRY['minimal'];
    sticker.render(ctx, stats, textColor, showLogo);

    ctx.restore();

    // ARCHITECT NOTE: Deterministic synchronization signal for E2E tests
    if (isMain) {
        const currentId = (window as any)._scoraLastDrawId;

        requestAnimationFrame(() => {
            (window as any)._scoraIsSettled = true;
            (window as any)._scoraSettledId = currentId;
            (window as any)._scoraDrawCount = ((window as any)._scoraDrawCount || 0) + 1;
        });
    }
}


// ─── 8M Special Templates ─────────────────────────────────────────────────────
// Feminist running stickers for International Women's Day (8M)

export function draw8MTemplate(ctx, stats, templateType, showLogo) {
    // Determine colors based on standard dark/light mode toggle
    const alphaValue = 0.45;
    const c = {
        solid: `rgb(255, 255, 255)`,
        trans: `rgba(255, 255, 255, ${alphaValue})`,
        label: 'rgba(255,255,255,0.75)',
        // Color #800080 is exactly rgb(128, 0, 128). Setting to 80% opacity requested.
        purpleText: 'rgba(128, 0, 128, 0.8)',
        purpleMap: 'rgba(128, 0, 128, 0.8)'
    };

    // ── 8M — Prominent top header ───────────────────────────────────────────
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = c.purpleText;

    // 8M massive and centered
    ctx.font = "800 520px 'Plus Jakarta Sans'";
    ctx.fillText('8M', 540, 480);

    // ── Route / Map ───────────────────────────────────────────────────────────
    const hasDistance = stats.distanceVal && parseFloat(stats.distanceVal) > 0;

    if (stats.polyline) {
        const coords = decodePolyline(stats.polyline);
        // Centered perfectly. Existing width was 900. Reducing size by ~15% means max width/height ~765.
        // We ensure it remains centered by adjusting x and y offsets accordingly.
        // New Box: Size 765, center remains at (540, 800). 
        // 540 - (765/2) = 157.5 (x).  800 - (765/2) = 417.5 (y).
        draw8MRoute(ctx, coords, { x: 157, y: 417, w: 765, h: 765 }, c.purpleMap);
    }

    // ── Tagline ───────────────────────────────────────────────────────────────
    const tagline = templateType === '8m2' ? 'Corremos juntas! ✊' : 'Run like a girl! ';
    ctx.textAlign = 'center';

    // Tagline at the very bottom, white with 80% opacity
    ctx.font = "500 58px 'Plus Jakarta Sans'";
    ctx.fillStyle = 'rgba(255,255,255,0.8)';

    if (typeof ctx.letterSpacing !== 'undefined') {
        ctx.letterSpacing = "6px";
    }

    // Moved to the absolute bottom of the sticker so it doesn't overlap distance/pace/time stats
    const tagY = stats.polyline ? 1860 : 1860;
    ctx.fillText(tagline, 540, tagY);

    if (typeof ctx.letterSpacing !== 'undefined') {
        ctx.letterSpacing = "0px";
    }

    // ── Stats (Distance / Pace / Time) ────────────────────────────────────────
    if (hasDistance) {
        // Distance
        const distNum = stats.distanceVal || '0.00';
        const distUnit = 'km';

        ctx.font = "800 200px 'Plus Jakarta Sans'";
        const dW = ctx.measureText(distNum).width;
        ctx.font = "700 85px 'Plus Jakarta Sans'";
        const duW = ctx.measureText(distUnit).width;

        const gap = 14;
        const totalW = dW + gap + duW;
        const startX = 540 - totalW / 2;

        ctx.textAlign = 'left';
        ctx.font = "800 200px 'Plus Jakarta Sans'";
        ctx.fillStyle = c.trans;
        ctx.fillText(distNum, startX, 1400);

        ctx.font = "700 85px 'Plus Jakarta Sans'";
        ctx.fillStyle = c.solid;
        ctx.fillText(distUnit, startX + dW + gap, 1400);

        ctx.textAlign = 'center';
        ctx.font = "500 32px 'Plus Jakarta Sans'";
        ctx.fillStyle = c.label;
        ctx.fillText(stats.mainLabel || 'Distance', 540, 1470);

        // Pace & Time (split design like in the demo)
        const paceStr = stats.subValue || stats.maxPace || '0:00';
        const [paceNum, paceU] = paceStr.split(' ');

        const timeStr = stats.timeStr || '0m';
        const timeParts = parseDurationParts(timeStr);

        // Draw Pace (Left)
        ctx.textAlign = 'center';
        ctx.font = "800 95px 'Plus Jakarta Sans'";
        const pNumW = ctx.measureText(paceNum).width;
        ctx.font = "700 65px 'Plus Jakarta Sans'";
        const pUW = ctx.measureText(paceU || '').width;

        let pSetStart = 300 - ((pNumW + gap + pUW) / 2);

        ctx.textAlign = 'left';
        ctx.font = "800 95px 'Plus Jakarta Sans'";
        ctx.fillStyle = c.trans;
        ctx.fillText(paceNum, pSetStart, 1680);
        ctx.font = "700 65px 'Plus Jakarta Sans'";
        ctx.fillStyle = c.solid;
        ctx.fillText(paceU || '', pSetStart + pNumW + gap, 1680);

        ctx.textAlign = 'center';
        ctx.font = "500 28px 'Plus Jakarta Sans'";
        ctx.fillStyle = c.label;
        ctx.fillText(stats.subLabel || 'Pace', 300, 1740);

        // Measure Time total width
        ctx.font = "800 95px 'Plus Jakarta Sans'";
        let tTotalW = 0;
        const sGap = 6;
        timeParts.forEach((p, i) => {
            ctx.font = "800 95px 'Plus Jakarta Sans'";
            const vW = ctx.measureText(p.val).width;
            ctx.font = "700 65px 'Plus Jakarta Sans'";
            const uW = p.unit ? ctx.measureText(p.unit).width : 0;
            tTotalW += vW + (p.unit ? sGap + uW : 0) + (i < timeParts.length - 1 ? sGap * 2 : 0);
        });

        drawDurationSequence(ctx, 780 - tTotalW / 2, 1680, timeParts, {
            valFont: "800 95px 'Plus Jakarta Sans'",
            unitFont: "700 65px 'Plus Jakarta Sans'",
            valColor: c.trans,
            unitColor: c.solid,
            gap: sGap * 2,
            unitGap: sGap
        });

        ctx.textAlign = 'center';
        ctx.font = "500 28px 'Plus Jakarta Sans'";
        ctx.fillStyle = c.label;
        ctx.fillText('Time', 780, 1740);

    } else {
        // Gym fallback
        ctx.font = "800 200px 'Plus Jakarta Sans'";
        ctx.fillStyle = c.trans;
        ctx.textAlign = 'center';
        ctx.fillText(stats.timeStr || '0m', 540, 1050);

        ctx.font = "500 40px 'Plus Jakarta Sans'";
        ctx.fillStyle = c.label;
        ctx.fillText('Duration', 540, 1120);

        if (stats.maxHeartrate) {
            ctx.font = "700 110px 'Plus Jakarta Sans'";
            ctx.fillStyle = c.trans;
            ctx.fillText(String(stats.maxHeartrate), 540, 1370);
            ctx.font = "500 40px 'Plus Jakarta Sans'";
            ctx.fillStyle = c.label;
            ctx.fillText('Max Heartrate', 540, 1440);
        }
    }
}

// Purple route line for 8M templates with glow
export function draw8MRoute(ctx, coords, mapBox, color) {
    if (!coords || coords.length === 0) return;
    let minLat = coords[0][0], maxLat = minLat, minLng = coords[0][1], maxLng = minLng;
    coords.forEach(p => {
        if (p[0] < minLat) minLat = p[0]; if (p[0] > maxLat) maxLat = p[0];
        if (p[1] < minLng) minLng = p[1]; if (p[1] > maxLng) maxLng = p[1];
    });

    const scale = Math.min(mapBox.w / (maxLng - minLng), mapBox.h / (maxLat - minLat));

    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 12; // increased to match route map thickness
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.shadowColor = 'rgba(168, 85, 247, 0.4)';
    ctx.shadowBlur = 20;

    coords.forEach((p, i) => {
        const x = mapBox.x + (p[1] - minLng) * scale + (mapBox.w - ((maxLng - minLng) * scale)) / 2;
        const y = mapBox.y + mapBox.h - ((p[0] - minLat) * scale) - (mapBox.h - ((maxLat - minLat) * scale)) / 2;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.shadowBlur = 0;
}




// ─── Running templates ────────────────────────────────────────────────────────


export function drawRunningMinimal(ctx, stats, textColor = 'white') {
    const c = buildColors(textColor);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';

    // Activity title
    ctx.font = "600 50px 'Plus Jakarta Sans'";
    ctx.fillStyle = c.accent;
    ctx.fillText(stats.title || 'Workout', 540, 700);

    // Split value / unit for the transparent-number effect
    const numText = stats.distanceVal || '0.00';
    const unitText = 'km';

    ctx.font = "800 240px 'Plus Jakarta Sans'";
    const numW = ctx.measureText(numText).width;

    ctx.font = "700 110px 'Plus Jakarta Sans'";
    const unitW = ctx.measureText(unitText).width;

    const gap = 12;
    const totalW = numW + gap + unitW;
    const startX = 540 - totalW / 2;

    ctx.textAlign = 'left';

    ctx.font = "800 240px 'Plus Jakarta Sans'";
    ctx.fillStyle = c.trans;
    ctx.fillText(numText, startX, 1010);

    ctx.font = "700 110px 'Plus Jakarta Sans'";
    ctx.fillStyle = c.solid;
    ctx.fillText(unitText, startX + numW + gap, 1010);

    // Label
    ctx.textAlign = 'center';
    ctx.font = "500 40px 'Plus Jakarta Sans'";
    ctx.fillStyle = c.label;
    ctx.fillText(stats.mainLabel || 'Distance', 540, 1090);
}

export function drawRunningRoute(ctx, stats, textColor = 'white') {
    const c = buildColors(textColor);
    const coords = decodePolyline(stats.polyline);
    drawMap(ctx, coords, { x: 90, y: 350, w: 900, h: 900 });

    const numText = stats.distanceVal || '0.00';
    const unitText = 'km';

    ctx.textBaseline = 'alphabetic';
    ctx.font = "800 150px 'Plus Jakarta Sans'";
    const numW = ctx.measureText(numText).width;

    ctx.font = "700 75px 'Plus Jakarta Sans'";
    const unitW = ctx.measureText(unitText).width;

    const gap = 10;
    const totalW = numW + gap + unitW;
    const startX = 540 - totalW / 2;

    ctx.textAlign = 'left';

    ctx.font = "800 150px 'Plus Jakarta Sans'";
    ctx.fillStyle = c.trans;
    ctx.fillText(numText, startX, 1510);

    ctx.font = "700 75px 'Plus Jakarta Sans'";
    ctx.fillStyle = c.solid;
    ctx.fillText(unitText, startX + numW + gap, 1510);

    ctx.textAlign = 'center';
    ctx.font = "500 35px 'Plus Jakarta Sans'";
    ctx.fillStyle = c.label;
    ctx.fillText(stats.mainLabel || 'Distance', 540, 1570);
}

export function drawRunningData(ctx, stats, textColor = 'white') {
    const c = buildColors(textColor);
    const coords = decodePolyline(stats.polyline);
    drawMap(ctx, coords, { x: 140, y: 350, w: 800, h: 800 });

    // ── Main value (distance) ────────────────────────────────────────────────
    const numText = stats.distanceVal || '0.00';
    const unitText = 'km';

    ctx.textBaseline = 'alphabetic';
    ctx.font = "800 180px 'Plus Jakarta Sans'";
    const numW = ctx.measureText(numText).width;

    ctx.font = "700 85px 'Plus Jakarta Sans'";
    const unitW = ctx.measureText(unitText).width;

    const gap = 10;
    const totalW = numW + gap + unitW;
    const startX = 540 - totalW / 2;

    ctx.textAlign = 'left';

    ctx.font = "800 180px 'Plus Jakarta Sans'";
    ctx.fillStyle = c.trans;
    ctx.fillText(numText, startX, 1400);

    ctx.font = "700 85px 'Plus Jakarta Sans'";
    ctx.fillStyle = c.solid;
    ctx.fillText(unitText, startX + numW + gap, 1400);

    ctx.textAlign = 'center';
    ctx.font = "500 35px 'Plus Jakarta Sans'";
    ctx.fillStyle = c.label;
    ctx.fillText(stats.mainLabel || 'Distance', 540, 1460);

    // ── Sub stats (pace + time) ──────────────────────────────────────────────
    ctx.font = "600 80px 'Plus Jakarta Sans'";
    ctx.fillStyle = c.trans;
    ctx.textAlign = 'center';
    ctx.fillText(stats.subValue, 300, 1650);
    ctx.fillText(stats.timeStr, 750, 1650);

    ctx.font = "400 30px 'Plus Jakarta Sans'";
    ctx.fillStyle = c.label;
    ctx.fillText(stats.subLabel || 'Pace', 300, 1700);
    ctx.fillText('Time', 750, 1700);
}

// ─── Map renderer ─────────────────────────────────────────────────────────────

export function drawMap(ctx, coords, mapBox) {
    if (!coords || coords.length === 0) return;
    let minLat = coords[0][0], maxLat = minLat, minLng = coords[0][1], maxLng = minLng;
    coords.forEach(p => {
        if (p[0] < minLat) minLat = p[0]; if (p[0] > maxLat) maxLat = p[0];
        if (p[1] < minLng) minLng = p[1]; if (p[1] > maxLng) maxLng = p[1];
    });

    const scale = Math.min(mapBox.w / (maxLng - minLng), mapBox.h / (maxLat - minLat));

    ctx.beginPath();
    ctx.strokeStyle = '#80cbc4';
    ctx.lineWidth = 12;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.shadowColor = 'rgba(128, 203, 196, 0.4)';
    ctx.shadowBlur = 20;

    coords.forEach((p, i) => {
        const x = mapBox.x + (p[1] - minLng) * scale + (mapBox.w - ((maxLng - minLng) * scale)) / 2;
        const y = mapBox.y + mapBox.h - ((p[0] - minLat) * scale) - (mapBox.h - ((maxLat - minLat) * scale)) / 2;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.shadowBlur = 0;
}

// ─── Chrome Map Variations ──────────────────────────────────────────────────

export function drawChromeHighContrastSticker(ctx, stats, textColor, showLogo = true) {
    const coords = decodePolyline(stats.polyline);
    const w = 1080;
    const h = 1920;
    
    // Create an off-screen canvas to draw the raw flat shapes
    const maskCanvas = document.createElement('canvas');
    maskCanvas.width = w;
    maskCanvas.height = h;
    const mctx = maskCanvas.getContext('2d');
    
    if (!mctx) return;

    // 1. Draw Map on Mask
    mctx.beginPath();
    mctx.strokeStyle = '#ffffff'; // Pure white mask for Poisson solver
    mctx.lineWidth = 40; // Base thickness of the chrome tube
    mctx.lineCap = 'round';
    mctx.lineJoin = 'round';
    
    let minLat = coords[0][0], maxLat = minLat, minLng = coords[0][1], maxLng = minLng;
    coords.forEach(p => {
        if (p[0] < minLat) minLat = p[0]; if (p[0] > maxLat) maxLat = p[0];
        if (p[1] < minLng) minLng = p[1]; if (p[1] > maxLng) maxLng = p[1];
    });

    const mapBox = { x: 50, y: 550, w: 980, h: 1000 };
    const scale = Math.min(mapBox.w / (maxLng - minLng), mapBox.h / (maxLat - minLat));

    coords.forEach((p, i) => {
        const px = mapBox.x + (p[1] - minLng) * scale + (mapBox.w - ((maxLng - minLng) * scale)) / 2;
        // Top-align the map to always start exactly at mapBox.y, instead of centering it in the vertical space
        const py = mapBox.y + ((maxLat - p[0]) * scale);
        if (i === 0) mctx.moveTo(px, py); else mctx.lineTo(px, py);
    });
    mctx.stroke();

    // 2. Draw Scora Logo on Mask (will become Liquid Metal)
    if (showLogo) {
        const logoY = 200;
        mctx.fillStyle = '#ffffff';
        mctx.beginPath();
        mctx.arc(100, logoY - 10, 10, 0, Math.PI * 2);
        mctx.fill();
        mctx.textAlign = 'left';
        mctx.font = "900 40px 'Plus Jakarta Sans'";
        mctx.fillText("SCORA", 130, logoY);
    }
    
    // 3. Draw Distance Text on Mask (will become Liquid Metal)
    const distText = stats.distanceVal || '0.00';
    const text = `${distText} KM`;
    const targetWidth = 980; // Make the numbers massively huge horizontally
    const baseFontSize = 100;
    mctx.font = `400 ${baseFontSize}px 'Sekuya', sans-serif`;
    const metrics = mctx.measureText(text);
    const fontSize = (targetWidth / metrics.width) * baseFontSize;
    
    mctx.textBaseline = 'middle';
    mctx.font = `400 ${fontSize}px 'Sekuya', sans-serif`;
    mctx.fillText(text, 50, 420);

    // Run the WebGL Pipeline asynchronously
    const runWebGL = async () => {
        try {
            // SYNC DRAW: Instantly draw the flat white mask to the screen to prevent a blank flash/jump!
            // This acts as a cool loading state (flat -> 3D pop)
            ctx.save();
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            const maskScaleX = ctx.canvas.width / w;
            const maskScaleY = ctx.canvas.height / h;
            ctx.scale(maskScaleX, maskScaleY);
            ctx.drawImage(maskCanvas, 0, 0, w, h);
            ctx.restore();

            const dataUrl = maskCanvas.toDataURL('image/png');
            const theme = textColor; // Contains 'silver', 'gold', 'rosegold', etc.
            const glCanvas = await applyLiquidMetalEffect(dataUrl, w, h, theme as any);
            
            // Clear the canvas and draw the WebGL output
            ctx.clearRect(0, 0, w, h);
            
            // Restore context scale to 1:1 before drawing full size WebGL canvas
            ctx.save();
            ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset transform to default
            
            // If the canvas is 1080x1920, we just draw. If it's a thumbnail (300px), we scale it down.
            const scaleX = ctx.canvas.width / w;
            const scaleY = ctx.canvas.height / h;
            ctx.scale(scaleX, scaleY);
            
            ctx.drawImage(glCanvas, 0, 0, w, h);

            ctx.restore();
        } catch (e: any) {
            alert("WebGL Error: " + (e?.message || e));
            console.error("Failed to render liquid metal:", e);
        }
    };

    runWebGL();
}

// V1: High-Contrast Chrome (Balloon-like reflection)
export function drawChromeMapHighContrast(ctx, coords, mapBox) {
    if (!coords || coords.length === 0) return;
    let minLat = coords[0][0], maxLat = minLat, minLng = coords[0][1], maxLng = minLng;
    coords.forEach(p => {
        if (p[0] < minLat) minLat = p[0]; if (p[0] > maxLat) maxLat = p[0];
        if (p[1] < minLng) minLng = p[1]; if (p[1] > maxLng) maxLng = p[1];
    });

    const scale = Math.min(mapBox.w / (maxLng - minLng), mapBox.h / (maxLat - minLat));

    const drawPath = (offsetX = 0, offsetY = 0) => {
        ctx.beginPath();
        coords.forEach((p, i) => {
            const x = mapBox.x + (p[1] - minLng) * scale + (mapBox.w - ((maxLng - minLng) * scale)) / 2 + offsetX;
            const y = mapBox.y + mapBox.h - ((p[0] - minLat) * scale) - (mapBox.h - ((maxLat - minLat) * scale)) / 2 + offsetY;
            if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        });
        ctx.stroke();
    };

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // 1. Heavy Drop Shadow (Pop off the screen)
    ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
    ctx.shadowBlur = 40;
    ctx.shadowOffsetY = 25;
    ctx.strokeStyle = '#111111';
    ctx.lineWidth = 60; // MASSIVELY THICK
    drawPath();

    // Reset shadow for inner layers
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    ctx.shadowColor = 'transparent';

    // 2. Base Dark Edge (Thick)
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 60;
    drawPath();

    // 3. Dark mid-tone (gives depth to the edge)
    ctx.strokeStyle = '#444444';
    ctx.lineWidth = 46;
    drawPath();

    // 4. Silver core
    ctx.strokeStyle = '#999999';
    ctx.lineWidth = 32;
    drawPath();

    // 5. Bright Silver center
    ctx.strokeStyle = '#e0e0e0';
    ctx.lineWidth = 18;
    drawPath();

    // 6. Specular Highlight (Pure White, offset up-left for lighting direction)
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 6;
    drawPath(-5, -6);

    // 7. Environment Reflection (Soft gray, offset down-right to look like ground bounce)
    ctx.strokeStyle = '#888888';
    ctx.lineWidth = 4;
    drawPath(6, 6);
}





// ── Template 1: Minimal — Duration as hero ────────────────────────────────────
export function drawGymMinimal(ctx, stats, textColor = 'white') {
    const c = buildColors(textColor);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';

    ctx.font = "600 50px 'Plus Jakarta Sans'";
    ctx.fillStyle = c.accent;
    ctx.fillText(stats.title || 'Workout', 540, 750);

    // Duration value split: "1h 11m" -> "1" (trans), "h " (solid), "11" (trans), "m" (solid)
    const rawDur = stats.mainValue || '0m';
    const parts = parseDurationParts(rawDur);

    // Measure total width
    let totalW = 0;
    const sGap = 8;
    parts.forEach((p, i) => {
        ctx.font = "800 200px 'Plus Jakarta Sans'";
        const vW = ctx.measureText(p.val).width;
        ctx.font = "700 100px 'Plus Jakarta Sans'";
        const uW = p.unit ? ctx.measureText(p.unit).width : 0;
        totalW += vW + (p.unit ? sGap + uW : 0) + (i < parts.length - 1 ? sGap * 2 : 0);
    });

    drawDurationSequence(ctx, 540 - totalW / 2, 1020, parts, {
        valFont: "800 200px 'Plus Jakarta Sans'",
        unitFont: "700 100px 'Plus Jakarta Sans'",
        valColor: c.trans,
        unitColor: c.solid,
        gap: sGap * 2,
        unitGap: sGap
    });

    ctx.textAlign = 'center';
    ctx.font = "500 40px 'Plus Jakarta Sans'";
    ctx.fillStyle = c.label;
    ctx.fillText(stats.mainLabel || 'Duration', 540, 1100);
}

// ── Template 2: Effort — Max Heartrate as hero ────────────────────────────────
export function drawGymEffort(ctx, stats, textColor = 'white') {
    const c = buildColors(textColor);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';

    ctx.font = "600 50px 'Plus Jakarta Sans'";
    ctx.fillStyle = c.accent;
    ctx.fillText(stats.title || 'Workout', 540, 750);

    // Max HR as hero, or fall back to duration
    const hrVal = stats.maxHeartrate ? String(stats.maxHeartrate) : stats.mainValue;
    const hrUnit = stats.maxHeartrate ? 'bpm' : '';

    ctx.font = "800 230px 'Plus Jakarta Sans'";
    const numW = ctx.measureText(hrVal).width;

    ctx.font = "700 80px 'Plus Jakarta Sans'";
    const unitW = ctx.measureText(hrUnit).width;

    const gap = 10;
    const totalW = numW + (hrUnit ? gap + unitW : 0);
    const startX = 540 - totalW / 2;

    ctx.textAlign = 'left';

    ctx.font = "800 230px 'Plus Jakarta Sans'";
    ctx.fillStyle = c.trans;
    ctx.fillText(hrVal, startX, 1020);

    if (hrUnit) {
        ctx.font = "700 80px 'Plus Jakarta Sans'";
        ctx.fillStyle = c.solid;
        ctx.fillText(hrUnit, startX + numW + gap, 1020);
    }

    ctx.textAlign = 'center';
    ctx.font = "500 40px 'Plus Jakarta Sans'";
    ctx.fillStyle = c.label;
    ctx.fillText(stats.maxHeartrate ? 'Max Heartrate' : 'Duration', 540, 1100);

    // Sub: duration as context (only if not already the hero)
    if (stats.maxHeartrate) {
        ctx.font = "500 55px 'Plus Jakarta Sans'";
        ctx.fillStyle = c.trans;
        ctx.fillText(stats.timeStr, 540, 1250);

        ctx.font = "400 32px 'Plus Jakarta Sans'";
        ctx.fillStyle = c.label;
        ctx.fillText('Duration', 540, 1300);
    } else {
        // Hero is duration, show date or type as sub to avoid duplication
        const subSub = stats.date || normalizeSport(stats.type) || 'Gym';
        ctx.font = "500 55px 'Plus Jakarta Sans'";
        ctx.fillStyle = c.trans;
        ctx.fillText(subSub, 540, 1250);

        ctx.font = "400 32px 'Plus Jakarta Sans'";
        ctx.fillStyle = c.label;
        ctx.fillText('Activity', 540, 1300);
    }
}

// ── Template 3: Data — Duration + side-by-side HR ────────────────────────────
export function drawGymData(ctx, stats, textColor = 'white') {
    const c = buildColors(textColor);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';

    ctx.font = "600 50px 'Plus Jakarta Sans'";
    ctx.fillStyle = c.accent;
    ctx.fillText(stats.title || 'Workout', 540, 650);

    // ── Duration ─────────────────────────────────────────────────────────────
    const durY = 980;
    const rawDur = stats.mainValue || '0m';
    const durMatch = rawDur.match(/^([\dh ]+?)(m)?$/);
    const durNum = durMatch ? durMatch[1].trimEnd() : rawDur;
    const durUnit = 'm';

    ctx.font = "800 220px 'Plus Jakarta Sans'";
    const dW = ctx.measureText(durNum).width;

    ctx.font = "700 110px 'Plus Jakarta Sans'";
    const duW = ctx.measureText(durUnit).width;

    const gap = 8;
    const durTotalW = dW + gap + duW;
    const durStartX = 540 - durTotalW / 2;

    ctx.textAlign = 'left';

    ctx.font = "800 220px 'Plus Jakarta Sans'";
    ctx.fillStyle = c.trans;
    ctx.fillText(durNum, durStartX, durY);

    ctx.font = "700 110px 'Plus Jakarta Sans'";
    ctx.fillStyle = c.solid;
    ctx.fillText(durUnit, durStartX + dW + gap, durY);

    ctx.textAlign = 'center';
    ctx.font = "500 40px 'Plus Jakarta Sans'";
    ctx.fillStyle = c.label;
    ctx.fillText('Duration', 540, durY + 65);

    // ── Avg HR (left) + Max HR (right) ───────────────────────────────────────
    const hrY = 1380;
    const hasHR = stats.avgHeartrate || stats.maxHeartrate;

    if (hasHR) {
        // Left block: Avg HR
        const avgStr = stats.avgHeartrate ? String(stats.avgHeartrate) : '—';
        ctx.font = "700 100px 'Plus Jakarta Sans'";
        ctx.fillStyle = c.trans;
        ctx.textAlign = 'center';
        ctx.fillText(avgStr, 300, hrY);

        ctx.font = "500 55px 'Plus Jakarta Sans'";
        ctx.fillStyle = c.solid;
        ctx.fillText('bpm', 300, hrY + 65);

        ctx.font = "400 32px 'Plus Jakarta Sans'";
        ctx.fillStyle = c.label;
        ctx.fillText(stats.subLabel || 'Avg HR', 300, hrY + 115);

        // Divider
        ctx.strokeStyle = c.label;
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.3;
        ctx.beginPath();
        ctx.moveTo(540, hrY - 80);
        ctx.lineTo(540, hrY + 120);
        ctx.stroke();
        ctx.globalAlpha = 1;

        // Right block: Max HR
        const maxStr = stats.maxHeartrate ? String(stats.maxHeartrate) : '—';
        ctx.font = "700 100px 'Plus Jakarta Sans'";
        ctx.fillStyle = c.trans;
        ctx.textAlign = 'center';
        ctx.fillText(maxStr, 780, hrY);

        ctx.font = "500 55px 'Plus Jakarta Sans'";
        ctx.fillStyle = c.solid;
        ctx.fillText('bpm', 780, hrY + 65);

        ctx.font = "400 32px 'Plus Jakarta Sans'";
        ctx.fillStyle = c.label;
        ctx.fillText('Max HR', 780, hrY + 115);
    } else {
        ctx.font = "500 55px 'Plus Jakarta Sans'";
        ctx.fillStyle = c.label;
        ctx.fillText('No HR data', 540, hrY);
    }
}

// ── Template 4: Stats — Avg HR + Max HR as two-block hero ────────────────────
export function drawGymStats(ctx, stats, textColor = 'white') {
    const c = buildColors(textColor);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';

    ctx.font = "600 50px 'Plus Jakarta Sans'";
    ctx.fillStyle = c.accent;
    ctx.fillText(stats.title || 'Workout', 540, 550);

    //  Block 1: Avg HR
    const avgHR = stats.avgHeartrate ? String(stats.avgHeartrate) : '—';
    const bpmW1 = (() => {
        ctx.font = "800 260px 'Plus Jakarta Sans'"; return ctx.measureText(avgHR).width;
    })();
    const bpmLabel1W = (() => {
        ctx.font = "700 130px 'Plus Jakarta Sans'"; return ctx.measureText('bpm').width;
    })();
    const gap1 = 12;
    const total1 = bpmW1 + gap1 + bpmLabel1W;
    const startX1 = 540 - total1 / 2;

    ctx.textAlign = 'left';
    ctx.font = "800 260px 'Plus Jakarta Sans'";
    ctx.fillStyle = c.trans;
    ctx.fillText(avgHR, startX1, 800);

    ctx.font = "700 130px 'Plus Jakarta Sans'";
    ctx.fillStyle = c.solid;
    ctx.fillText('bpm', startX1 + bpmW1 + gap1, 800);

    ctx.textAlign = 'center';
    ctx.font = "600 45px 'Plus Jakarta Sans'";
    ctx.fillStyle = c.label;
    ctx.fillText(stats.subLabel || 'Avg Heartrate', 540, 870);

    // Divider
    ctx.strokeStyle = c.label;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.2;
    ctx.beginPath();
    ctx.moveTo(160, 950);
    ctx.lineTo(920, 950);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Block 2: Max HR
    const maxHR = stats.maxHeartrate ? String(stats.maxHeartrate) : '—';
    const bpmW2 = (() => {
        ctx.font = "800 130px 'Plus Jakarta Sans'"; return ctx.measureText(maxHR).width;
    })();
    const bpmLabel2W = (() => {
        ctx.font = "700 65px 'Plus Jakarta Sans'"; return ctx.measureText('bpm').width;
    })();
    const gap2 = 8;
    const total2 = bpmW2 + gap2 + bpmLabel2W;
    const startX2 = 540 - total2 / 2;

    ctx.textAlign = 'left';
    ctx.font = "800 130px 'Plus Jakarta Sans'";
    ctx.fillStyle = c.trans;
    ctx.fillText(maxHR, startX2, 1110);

    ctx.font = "700 65px 'Plus Jakarta Sans'";
    ctx.fillStyle = c.solid;
    ctx.fillText('bpm', startX2 + bpmW2 + gap2, 1110);

    ctx.textAlign = 'center';
    ctx.font = "600 38px 'Plus Jakarta Sans'";
    ctx.fillStyle = c.label;
    ctx.fillText('Max Heartrate', 540, 1175);

    // Duration footer
    ctx.font = "500 55px 'Plus Jakarta Sans'";
    ctx.fillStyle = c.trans;
    ctx.fillText(stats.timeStr || '0m', 540, 1370);

    ctx.font = "400 32px 'Plus Jakarta Sans'";
    ctx.fillStyle = c.label;
    ctx.fillText('Duration', 540, 1420);
}

// ─── Stats template (running) ─────────────────────────────────────────────────

export function drawStatsTemplate(ctx, stats, textColor = 'white') {
    const c = buildColors(textColor);

    // ── Distance (top half) ──────────────────────────────────────────────────
    const distY = 700;
    const distText = stats.distanceVal || '0.00';
    const unitText = 'km';

    ctx.textBaseline = 'alphabetic';

    ctx.font = "800 280px 'Plus Jakarta Sans'";
    const distW = ctx.measureText(distText).width;

    ctx.font = "700 220px 'Plus Jakarta Sans'";
    const unitW = ctx.measureText(unitText).width;

    const gap = 15;
    const totalW = distW + gap + unitW;
    const startX = 540 - totalW / 2;

    ctx.textAlign = 'left';

    ctx.font = "800 280px 'Plus Jakarta Sans'";
    ctx.fillStyle = c.trans;
    ctx.fillText(distText, startX, distY);

    ctx.font = "700 220px 'Plus Jakarta Sans'";
    ctx.fillStyle = c.solid;
    ctx.fillText(unitText, startX + distW + gap, distY);

    ctx.textAlign = 'center';
    ctx.font = "600 50px 'Plus Jakarta Sans'";
    ctx.fillStyle = c.label;
    ctx.fillText(stats.mainLabel || 'Distance', 540, distY + 70);

    // ── Max Pace / Max Speed (sport-aware) ───────────────────────────────────
    const paceY = 1050;
    const paceParts = (stats.subValue || '').trim().split(' ');
    const paceText = paceParts[0] || (stats.maxPace || '0:00');
    const paceUnit = paceParts[1] || stats.maxPaceUnit || (stats.type === 'Ride' ? 'km/h' : '/km');
    const paceLabel = (stats.subLabel || stats.maxPaceLabel || 'Pace').toUpperCase();

    ctx.font = "800 120px 'Plus Jakarta Sans'";
    const paceW = ctx.measureText(paceText).width;

    ctx.font = "700 60px 'Plus Jakarta Sans'";
    const paceUnitW = ctx.measureText(paceUnit).width;

    const paceGap = 10;
    const paceTotalW = paceW + paceGap + paceUnitW;
    const paceStartX = 540 - paceTotalW / 2;

    ctx.textAlign = 'left';

    ctx.font = "800 120px 'Plus Jakarta Sans'";
    ctx.fillStyle = c.trans;
    ctx.fillText(paceText, paceStartX, paceY);

    ctx.font = "700 60px 'Plus Jakarta Sans'";
    ctx.fillStyle = c.solid;
    ctx.fillText(paceUnit, paceStartX + paceW + paceGap, paceY);

    ctx.textAlign = 'center';
    ctx.font = "600 35px 'Plus Jakarta Sans'";
    ctx.fillStyle = c.label;
    ctx.fillText(paceLabel, 540, paceY + 60);
}

// ─── DM (iMessage) template ───────────────────────────────────────────────────

/**
 * Draws an iOS-style iMessage bubble with a properly connected right-side tail.
 * All tail control points lie on the same Y baseline (y + height) so the
 * bottom edge is perfectly straight and the tail flows cleanly.
 */
export function drawIOSBubble(ctx, x: number, y: number, width: number, height: number) {
    const r = Math.min(height * 0.42, 42);
    const tipX = x + width + 16;   // How far right the tail tip extends
    const reentryX = x + width - 20;

    ctx.beginPath();
    ctx.moveTo(x + r, y);

    // Top edge → top-right corner
    ctx.lineTo(x + width - r, y);
    ctx.arcTo(x + width, y, x + width, y + r, r);

    // Right edge down to tail root
    ctx.lineTo(x + width, y + height - 18);

    // Tail outer curve (sweeps right to the tip)
    ctx.bezierCurveTo(
        x + width, y + height - 4,
        tipX, y + height,
        tipX, y + height
    );

    // Tail inner curve (sweeps back left into the bubble)
    ctx.bezierCurveTo(
        tipX - 8, y + height,
        reentryX + 4, y + height,
        reentryX, y + height
    );

    // Bottom edge → bottom-left corner → left edge → top-left corner
    ctx.lineTo(x + r, y + height);
    ctx.arcTo(x, y + height, x, y + height - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);

    ctx.closePath();
    ctx.fill();
}

export function drawDMBubble(ctx, stats) {
    let subStr = stats.subValue ? stats.subValue.replace(' /', '/') : '';
    const msgText = `${stats.mainValue}, ${subStr}`;
    const captionText = stats.startTime ? `Started ${stats.startTime}` : '';

    const sysFont = "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `normal 70px ${sysFont}`;

    const textW = ctx.measureText(msgText).width;
    const padX = 45;
    const bubW = textW + padX * 2;
    const bubH = 135;

    const centerX = 540;
    const centerY = 300;
    const bubX = centerX - bubW / 2;
    const bubY = centerY - bubH / 2;

    // Blue bubble
    ctx.fillStyle = '#0a7cff';
    drawIOSBubble(ctx, bubX, bubY, bubW, bubH);

    // Message text
    ctx.fillStyle = 'white';
    ctx.font = `normal 70px ${sysFont}`;
    ctx.fillText(msgText, centerX, centerY + 3);

    // Caption below
    ctx.textAlign = 'right';
    ctx.font = `500 35px ${sysFont}`;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.fillText(captionText, bubX + bubW - 5, centerY + bubH / 2 + 40);
}

// ─── New Overlay Templates ────────────────────────────────────────────────────

export function drawDM(ctx: CanvasRenderingContext2D, stats: any, textColor: string) {
    const sysFont = "'Plus Jakarta Sans', sans-serif";
    const p = stats.dataPoints || [];
    const p1 = p[0] || { value: '0.00', label: 'Dist', unit: 'km' };
    const p2 = p[1] || { value: '0:00', label: 'Pace', unit: '' };

    const cx = 540;
    const cy = 300;

    // Blue bubble background (DM style)
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const text = `${p1.value}, ${p2.value}${p2.unit || ''}`;
    ctx.font = `500 70px ${sysFont}`;
    const textW = ctx.measureText(text).width;
    const bubW = textW + 80;
    const bubH = 140;

    ctx.fillStyle = '#118afa';
    ctx.beginPath();
    ctx.roundRect(cx - bubW / 2, cy - bubH / 2, bubW, bubH, 70);
    ctx.fill();

    ctx.fillStyle = 'white';
    ctx.fillText(text, cx, cy);
    ctx.restore();
}


export function drawScoraStealth(ctx, stats, textColor) {
    const c = buildColors(textColor);
    ctx.textBaseline = 'alphabetic';
    const sysFont = "'Plus Jakarta Sans', sans-serif";

    // Handle Gym/Running fallbacks
    const distText = stats.hasMap ? (stats.distanceVal || '0.00') : (stats.timeStr || '0:00');
    const distUnit = stats.hasMap ? 'km' : '';

    // Fallback to average heartrate or duration for right column
    const paceParts = (stats.subValue || '').trim().split(' ');
    let paceText = paceParts[0] || (stats.avgHeartrate ? String(stats.avgHeartrate) : '0');
    let paceUnit = paceParts[1] || (stats.hasDistance ? (stats.type === 'Ride' ? 'km/h' : '/km') : 'bpm');
    if (paceUnit === 'min/km') paceUnit = '/km';

    const rightLabel = (stats.subLabel || (stats.hasDistance ? (stats.type === 'Ride' ? "Avg Speed" : "Pace") : "Avg HR")).toUpperCase();

    const bottomY = 1750;
    const leftX = 80;
    const rightX = 1000;

    // SCORA.LIVE Logo
    ctx.textAlign = 'left';
    ctx.fillStyle = '#34d399';
    ctx.beginPath();
    ctx.arc(leftX + 10, bottomY - 140, 8, 0, Math.PI * 2);
    ctx.fill();

    ctx.font = `900 24px ${sysFont}`;
    ctx.letterSpacing = "4px";
    ctx.fillText("SCORA.LIVE", leftX + 35, bottomY - 132);
    ctx.letterSpacing = "0px";

    // LEFT BUNDLE (Distance / Calories)
    ctx.font = `normal 900 130px ${sysFont}`;
    ctx.fillStyle = textColor.startsWith('#') ? textColor : (textColor.startsWith('#') ? textColor : (textColor === 'black' ? 'black' : 'white'));
    ctx.fillText(distText, leftX, bottomY);
    const dW = ctx.measureText(distText).width;

    ctx.font = `normal 600 40px ${sysFont}`;
    ctx.fillStyle = textColor === 'black' ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.7)';
    ctx.fillText(` ${distUnit}`.toUpperCase(), leftX + dW, bottomY);

    // RIGHT BUNDLE (Pace / HR)
    ctx.textAlign = 'right';
    ctx.font = `800 28px ${sysFont}`;
    ctx.letterSpacing = "2px";
    ctx.fillText(rightLabel, rightX, bottomY - 110);
    ctx.letterSpacing = "0px";

    ctx.font = `500 40px ${sysFont}`;
    ctx.fillStyle = textColor === 'black' ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.7)';
    const pUnitW = ctx.measureText(` ${paceUnit}`).width;
    ctx.fillText(` ${paceUnit}`, rightX, bottomY);

    ctx.font = `800 80px ${sysFont}`;
    ctx.fillStyle = textColor.startsWith('#') ? textColor : (textColor.startsWith('#') ? textColor : (textColor === 'black' ? 'black' : 'white'));
    ctx.fillText(paceText, rightX - pUnitW, bottomY);
}

export function drawInfoGlass(ctx: CanvasRenderingContext2D, stats: any, textColor: string) {
    const { solid, trans, label: labelColor, accent: accentColor } = buildColors(textColor);
    ctx.textBaseline = 'middle';
    const sysFont = "'Outfit', sans-serif";

    // Fallbacks
    const distLabel = stats.hasDistance ? "DISTANCE" : "DURATION";
    const distText = stats.hasDistance ? (stats.distanceVal || '0.00') : (stats.timeStr || '0:00');

    const paceLabel = (stats.subLabel || (stats.hasDistance ? (stats.type === 'Ride' ? "Avg Speed" : "Pace") : "Avg HR")).toUpperCase();
    const paceParts = (stats.subValue || '').trim().split(' ');
    const paceText = paceParts[0] || (stats.avgHeartrate ? String(stats.avgHeartrate) : '0');

    // For InfoGlass: slot 3 is Duration for runs/rides, or Max HR for workouts
    const timeLabel = stats.hasDistance ? "DURATION" : (stats.maxPaceLabel || "MAX HR");
    const timeText = stats.hasDistance ? (stats.timeStr || '0:00') : (stats.maxHeartrate ? String(stats.maxHeartrate) : '0');

    const w = 920;
    const h = 200;
    const startX = (1080 - w) / 2;
    const centerY = 300;

    ctx.save();
    applyAntiGhostingShadow(ctx, textColor);

    // Dynamic glassmorphic container with custom accent highlights
    ctx.beginPath();
    ctx.roundRect(startX, centerY - h / 2, w, h, 24);
    ctx.fillStyle = textColor === 'black' ? 'rgba(255, 255, 255, 0.8)' : 'rgba(28, 28, 30, 0.7)';
    ctx.fill();
    ctx.strokeStyle = textColor === 'black' ? 'rgba(0, 0, 0, 0.12)' : 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    const col1 = startX + w / 6;
    const col2 = startX + w / 2;
    const col3 = startX + 5 * w / 6;

    ctx.textAlign = 'center';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    // Divider columns
    ctx.beginPath();
    ctx.moveTo(startX + w / 3, centerY - 50);
    ctx.lineTo(startX + w / 3, centerY + 50);
    ctx.moveTo(startX + 2 * w / 3, centerY - 50);
    ctx.lineTo(startX + 2 * w / 3, centerY + 50);
    ctx.strokeStyle = textColor === 'black' ? 'rgba(0, 0, 0, 0.08)' : 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Column 1
    ctx.font = `800 13px ${sysFont}`;
    ctx.fillStyle = accentColor;
    setLetterSpacing(ctx, '2px');
    ctx.fillText(distLabel, col1, centerY - 30);
    setLetterSpacing(ctx, '0px');

    ctx.font = `900 44px ${sysFont}`;
    ctx.fillStyle = textColor;
    const distWithUnit = stats.hasDistance ? `${distText} KM` : distText;
    ctx.fillText(distWithUnit, col1, centerY + 20);

    // Column 2
    ctx.font = `800 13px ${sysFont}`;
    ctx.fillStyle = accentColor;
    setLetterSpacing(ctx, '2px');
    ctx.fillText(paceLabel, col2, centerY - 30);
    setLetterSpacing(ctx, '0px');

    ctx.font = `900 44px ${sysFont}`;
    ctx.fillStyle = textColor;
    const paceUnit = stats.hasDistance ? (stats.type === 'Ride' ? 'KM/H' : '/KM') : 'BPM';
    const paceWithUnit = `${paceText} ${paceUnit}`;
    ctx.fillText(paceWithUnit, col2, centerY + 20);

    // Column 3
    ctx.font = `800 13px ${sysFont}`;
    ctx.fillStyle = accentColor;
    setLetterSpacing(ctx, '2px');
    ctx.fillText(timeLabel, col3, centerY - 30);
    setLetterSpacing(ctx, '0px');

    ctx.font = `900 44px ${sysFont}`;
    ctx.fillStyle = textColor;
    const timeUnit = stats.hasDistance ? '' : 'BPM';
    const timeWithUnit = timeUnit ? `${timeText} ${timeUnit}` : timeText;
    ctx.fillText(timeWithUnit, col3, centerY + 20);

    ctx.restore();
}

export function drawSplitBadge(ctx, stats, textColor) {
    const sysFont = "'Plus Jakarta Sans', sans-serif";
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';

    const distLabel = stats.mainLabel || (stats.hasDistance ? "DISTANCE" : "DURATION");
    const distText = stats.hasDistance ? (stats.distanceVal || '0.00') : (stats.timeStr || '0:00');
    const distUnit = stats.hasDistance ? "KILOMETERS" : "";

    const paceLabel = (stats.subLabel || (stats.hasDistance ? (stats.type === 'Ride' ? "Avg Speed" : "Pace") : "Avg HR")).toUpperCase();
    const paceParts = (stats.subValue || '').trim().split(' ');
    const paceText = paceParts[0] || (stats.avgHeartrate ? String(stats.avgHeartrate) : '0');
    let paceUnit = paceParts[1] ? paceParts[1].toUpperCase() : (stats.hasDistance ? 'MIN / KM' : 'BPM');
    if (paceUnit === '/KM') paceUnit = 'MIN / KM';

    const centerY = 960;
    const centerX = 540;

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(-2 * Math.PI / 180);

    const w = 350;
    const h = 260;

    ctx.shadowColor = 'rgba(0,0,0,0.3)';
    ctx.shadowBlur = 40;
    ctx.shadowOffsetY = 20;

    ctx.beginPath();
    ctx.roundRect(-w, -h / 2, w, h, [40, 0, 0, 40]);
    ctx.fillStyle = '#f97316';
    ctx.fill();

    ctx.beginPath();
    ctx.roundRect(0, -h / 2, w, h, [0, 40, 40, 0]);
    ctx.fillStyle = 'white';
    ctx.fill();

    ctx.restore();

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(-2 * Math.PI / 180);

    ctx.fillStyle = 'black';
    ctx.font = `900 30px ${sysFont}`;
    ctx.fillText(distLabel, -w / 2, -60);
    ctx.font = `900 100px ${sysFont}`;
    ctx.fillText(distText, -w / 2, 10);
    ctx.font = `800 25px ${sysFont}`;
    ctx.fillText(distUnit, -w / 2, 80);

    ctx.fillStyle = '#ea580c';
    ctx.font = `900 30px ${sysFont}`;
    ctx.fillText(paceLabel, w / 2, -60);
    ctx.font = `900 100px ${sysFont}`;
    ctx.fillText(paceText, w / 2, 10);
    ctx.font = `800 25px ${sysFont}`;
    ctx.fillText(paceUnit, w / 2, 80);

    ctx.restore();
}


export function drawBrutalistBold(ctx: CanvasRenderingContext2D, stats: any, textColor: string) {
    const { solid, trans, label: labelColor, accent: accentColor } = buildColors(textColor);
    const sysFont = "'Outfit', sans-serif";

    const cx = 540;
    const cy = 1750;
    const w = 920;
    const h = 240;

    const isWorkout = stats.type?.toLowerCase().includes('workout') || stats.type?.toLowerCase().includes('training') || stats.type?.toLowerCase().includes('gym') || !stats.hasDistance;
    const isRide = stats.type === 'Ride' || stats.type === 'EBikeRide';

    const mainVal = (isWorkout ? (stats.timeStr || '0:00') : (stats.distanceVal || '0.00')).toUpperCase();
    const mainUnit = isWorkout ? 'DURATION' : 'KM';

    const paceLabel = isWorkout ? "HEART RATE" : (isRide ? "AVG SPEED" : "PACE");
    const paceVal = isWorkout ? (stats.avgHeartrate ? `${stats.avgHeartrate} BPM` : 'WORKOUT') : (stats.subValue || '0:00 /KM').toUpperCase();

    ctx.save();
    applyAntiGhostingShadow(ctx, textColor);

    // Main background with glass transparency
    ctx.fillStyle = textColor === 'black' ? 'rgba(255, 255, 255, 0.85)' : 'rgba(28, 28, 30, 0.75)';
    ctx.beginPath();
    ctx.roundRect(cx - w / 2, cy - h / 2, w, h, 16);
    ctx.fill();

    ctx.strokeStyle = textColor === 'black' ? 'rgba(0, 0, 0, 0.12)' : 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = accentColor;
    ctx.beginPath();
    ctx.roundRect(cx - w / 2 + 15, cy - h / 2 + 20, 10, h - 40, 5);
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = textColor;

    ctx.font = `normal 900 85px ${sysFont}`;
    ctx.fillText(mainVal, cx - w / 2 + 50, cy - 10);
    const mainW = ctx.measureText(mainVal).width;

    ctx.font = `800 20px ${sysFont}`;
    ctx.fillStyle = accentColor;
    setLetterSpacing(ctx, '2px');
    ctx.fillText(mainUnit, cx - w / 2 + 70 + mainW, cy + 10);
    setLetterSpacing(ctx, '0px');

    ctx.textAlign = 'right';
    ctx.fillStyle = textColor;
    ctx.font = `normal 900 56px ${sysFont}`;
    ctx.fillText(paceVal, w / 2 + cx - 50, cy - 10);

    ctx.font = `800 13px ${sysFont}`;
    ctx.fillStyle = accentColor;
    setLetterSpacing(ctx, '2px');
    ctx.fillText(paceLabel, w / 2 + cx - 50, cy + 35);
    setLetterSpacing(ctx, '0px');
    ctx.restore();
}


export function drawTechHUD(ctx, stats, textColor) {
    const sysFont = "'Plus Jakarta Sans', sans-serif";
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';

    const cx = 540;
    const cy = 1600;
    const r = 180;

    const distLabel = (stats.mainLabel || (stats.hasDistance ? "DISTANCE" : "DURATION")).toUpperCase();
    const distText = stats.hasDistance ? (stats.distanceVal || '0.00') : (stats.timeStr || '0:00');
    const hrText = stats.avgHeartrate ? `${stats.avgHeartrate} BPM` : (stats.hasDistance ? (stats.timeStr || '0:00') : '0 BPM');

    // Outer ring
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = textColor === 'black' ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Inner dashed ring (simulated with gaps)
    ctx.beginPath();
    ctx.arc(cx, cy, r - 15, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(34,211,238,0.2)'; // cyan
    ctx.setLineDash([10, 15]);
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.setLineDash([]); // reset

    ctx.fillStyle = '#22d3ee'; // cyan
    ctx.font = `900 20px ${sysFont}`;
    ctx.letterSpacing = "6px";
    ctx.fillText(distLabel, cx + 3, cy - 40); // manual kerning fix
    ctx.letterSpacing = "0px";

    ctx.fillStyle = textColor.startsWith('#') ? textColor : (textColor.startsWith('#') ? textColor : (textColor === 'black' ? 'black' : 'white'));
    ctx.font = `normal 900 70px ${sysFont}`;
    ctx.fillText(distText, cx, cy + 15);

    ctx.fillStyle = textColor === 'black' ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.4)';
    ctx.font = `700 20px ${sysFont}`;
    ctx.letterSpacing = "3px";
    ctx.fillText(hrText, cx + 1.5, cy + 70);
    ctx.letterSpacing = "0px";
}

export function drawDataModular(ctx: CanvasRenderingContext2D, stats: any, textColor: string) {
    const { solid, trans, label: labelColor, accent: accentColor } = buildColors(textColor);
    const sysFont = "'Outfit', sans-serif";
    ctx.textBaseline = 'alphabetic';

    const isWorkout = stats.type?.toLowerCase().includes('workout') || stats.type?.toLowerCase().includes('training') || stats.type?.toLowerCase().includes('gym') || !stats.hasDistance;
    const isRide = stats.type === 'Ride' || stats.type === 'EBikeRide';

    const distLabel = (isWorkout ? "DURATION" : "DISTANCE").toUpperCase();
    const distText = isWorkout ? (stats.timeStr || '0:00') : `${stats.distanceVal || '0.00'} KM`;

    const paceLabel = (isWorkout ? "HEART RATE" : (isRide ? "AVG SPEED" : "PACE")).toUpperCase();
    const paceVal = isWorkout ? (stats.avgHeartrate ? `${stats.avgHeartrate} BPM` : 'WORKOUT') : (stats.subValue || 'N/A').toUpperCase();

    const cx = 540;
    const cy = 1600;
    const w = 900;
    const h = 240;
    const r = 32;

    ctx.save();
    applyAntiGhostingShadow(ctx, textColor);

    // Main boundary path for clipping and border
    ctx.beginPath();
    ctx.roundRect(cx - w / 2, cy - h / 2, w, h, r);
    ctx.clip();

    // Grid lines background (gap-px)
    ctx.fillStyle = textColor === 'black' ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.15)';
    ctx.fillRect(cx - w / 2, cy - h / 2, w, h);

    const botH = 50; // bottom panel height
    const topH = h - botH - 1; // leaving exactly 1px for horizontal gap

    const startX = cx - w / 2;
    const startY = cy - h / 2;

    // Inner panel styles (Swiss Grid uses dark boxes inside a colored border/gap frame)
    const panelBg = textColor === 'black' ? 'rgba(255,255,255,0.8)' : 'rgba(28, 28, 30, 0.7)';
    const bottomBg = textColor === 'black' ? 'rgba(255,255,255,0.95)' : 'rgba(28, 28, 30, 0.9)';

    // Top Left Panel
    ctx.fillStyle = panelBg;
    ctx.fillRect(startX, startY, w / 2 - 0.5, topH);

    // Top Right Panel
    ctx.fillRect(startX + w / 2 + 0.5, startY, w / 2 - 0.5, topH);

    // Bottom Panel
    ctx.fillStyle = bottomBg;
    ctx.fillRect(startX, startY + topH + 1, w, botH);

    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    // Text for Top Left
    ctx.textAlign = 'left';
    ctx.fillStyle = accentColor;
    ctx.font = `800 13px ${sysFont}`;
    setLetterSpacing(ctx, "3px");
    ctx.fillText(distLabel, startX + 50, startY + 55);

    ctx.fillStyle = textColor;
    ctx.font = `normal 900 60px ${sysFont}`;
    setLetterSpacing(ctx, "0px");
    ctx.fillText(distText, startX + 50, startY + 130);

    // Text for Top Right
    ctx.fillStyle = accentColor;
    ctx.font = `800 13px ${sysFont}`;
    setLetterSpacing(ctx, "3px");
    ctx.fillText(paceLabel, startX + w / 2 + 50, startY + 55);

    ctx.fillStyle = textColor;
    ctx.font = `normal 900 60px ${sysFont}`;
    setLetterSpacing(ctx, "0px");
    ctx.fillText(paceVal, startX + w / 2 + 50, startY + 130);

    // Text for Bottom
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = textColor;
    ctx.font = `800 13px ${sysFont}`;
    setLetterSpacing(ctx, "4px");
    ctx.fillText("SCORA PERFORMANCE LOG", cx + 3, startY + topH + 1 + botH / 2);
    setLetterSpacing(ctx, "0px");

    ctx.restore();

    // Draw the outer border over everything
    ctx.beginPath();
    ctx.roundRect(cx - w / 2, cy - h / 2, w, h, r);
    ctx.lineWidth = 2;
    ctx.strokeStyle = textColor === 'black' ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.15)';
    ctx.stroke();
}

export function drawVHSRetro(ctx: CanvasRenderingContext2D, stats: any, textColor: string) {
    const margin = 80;
    const canvasW = 1080;
    const canvasH = 1920;
    const osdY = 220; // Shifted down to clear the SCORA logo at Y=115

    // 1. Data Processing
    const rawType = stats.activityType || 'RUN';
    const activity = applyActivityCasing(normalizeSport(stats.activityType || 'RUN'), 'vhs-retro');
    const distText = stats.hasDistance ? `${stats.distanceVal || '0.00'} KM` : `${stats.calories && stats.calories !== '0' ? stats.calories + ' KCAL' : (stats.timeStr || '0:00')}`;
    const paceUnit = stats.hasDistance ? '/KM' : 'BPM';
    // 🛡️ Timezone Fix: Treat the date string as literal local time 
    // to prevent 6-hour shifts in Mexico City / CST.
    const dateStrRaw = stats.rawDate || '';
    const rawDate = dateStrRaw ? new Date(dateStrRaw.replace('Z', '')) : new Date();

    const hours = rawDate.getHours();
    const mins = rawDate.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const timeStr = `${ampm}  ${hours % 12 || 12}:${mins}`;

    const month = new Intl.DateTimeFormat('en-US', { month: 'short' }).format(rawDate).toUpperCase();
    const day = rawDate.getDate().toString().padStart(2, '0');
    const year = rawDate.getFullYear();
    const dateStr = `${month}. ${day} ${year}`;
    const paceVal = (stats.subValue || '').split(' ')[0] || '0:00';

    // Helper for absolute scoped rendering
    const drawVCR = (text: string, x: number, y: number, align: CanvasTextAlign = 'left', baseline: CanvasTextBaseline = 'top', size = 32) => {
        ctx.save();
        ctx.textAlign = align;
        ctx.textBaseline = baseline;
        ctx.translate(x, y);

        ctx.shadowColor = 'rgba(0,0,0,0.9)';
        ctx.shadowOffsetX = 4;
        ctx.shadowOffsetY = 4;
        ctx.shadowBlur = 0; // Hardware-sharp shadows

        ctx.fillStyle = 'white';
        ctx.font = `${size}px 'Press Start 2P'`;
        (ctx as any).letterSpacing = "0.02em";

        ctx.fillText(text, 0, 0);
        ctx.restore();
    };

    // 2. Rendering
    ctx.save();

    // Reset and protect coordinate space
    const baseTransform = ctx.getTransform();
    ctx.setTransform(baseTransform.a, 0, 0, baseTransform.d, baseTransform.e, baseTransform.f);

    // --- TOP LEFT: REC Indicator ---
    ctx.save();
    ctx.beginPath();
    ctx.arc(margin + 20, osdY + 25, 18, 0, Math.PI * 2);
    ctx.fillStyle = '#ff0000';
    ctx.shadowColor = 'rgba(255,0,0,0.5)';
    ctx.shadowBlur = 15;
    ctx.fill();
    ctx.restore();

    drawVCR("REC", margin + 75, osdY, 'left', 'top', 40);
    drawVCR(activity, margin, osdY + 90, 'left', 'top', 40);

    // --- TOP RIGHT: PLAY Block (v26.0 Isolated Stack) ---
    const trX = canvasW - margin;
    const trY = osdY;

    // Line 1: PLAY + Triangle
    drawVCR("PLAY", trX - 60, trY, 'right', 'top', 40);

    ctx.save();
    ctx.translate(trX, trY);
    ctx.fillStyle = 'white';
    ctx.shadowColor = 'rgba(0,0,0,0.9)';
    ctx.shadowOffsetX = 4;
    ctx.shadowOffsetY = 4;
    ctx.beginPath();
    ctx.moveTo(-45, 5);
    ctx.lineTo(-45, 35);
    ctx.lineTo(-20, 20);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Line 2: SP
    drawVCR("SP", trX, trY + 60, 'right', 'top', 28);

    // Line 3: Distance
    drawVCR(distText, trX, trY + 110, 'right', 'top', 40);

    // --- BOTTOM LEFT: Timestamps ---
    drawVCR(timeStr, margin, canvasH - margin - 65, 'left', 'bottom', 36);
    drawVCR(dateStr, margin, canvasH - margin, 'left', 'bottom', 36);

    // --- BOTTOM RIGHT: Data ---
    drawVCR(`${paceVal} ${paceUnit}`, canvasW - margin, canvasH - margin - 65, 'right', 'bottom', 36);
    drawVCR("TRACKING", canvasW - margin, canvasH - margin, 'right', 'bottom', 36);

    ctx.restore();
}

export function drawGlassSlice(ctx, stats, textColor) {
    const sysFont = "'Plus Jakarta Sans', sans-serif";
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';

    const distText = stats.hasDistance ? (stats.distanceVal || '0.00') : (stats.timeStr || '0:00');
    // Ensure short units for the hero section
    const distUnit = stats.hasDistance ? 'KM' : 'TIME';

    const paceParts = (stats.subValue || '').trim().split(' ');
    const paceText = paceParts[0] || (stats.avgHeartrate ? String(stats.avgHeartrate) : '0');
    let paceUnit = paceParts[1] || (stats.hasDistance ? '/KM' : 'BPM');
    if (paceUnit.toLowerCase() === 'min/km') paceUnit = '/KM';

    const cx = 540;
    const cy = 1650;

    ctx.save();

    // Skew transform
    ctx.translate(cx, cy);
    ctx.transform(1, 0, -0.176, 1, 0, 0); // approx skewX(-10deg)

    const w = 700;
    const h = 180;

    // Glass backdrop
    const grad = ctx.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2);
    grad.addColorStop(0, textColor === 'black' ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.2)');
    grad.addColorStop(1, 'transparent');

    ctx.beginPath();
    ctx.roundRect(-w / 2, -h / 2, w, h, 40);
    ctx.fillStyle = grad;
    ctx.shadowColor = 'rgba(0,0,0,0.2)';
    ctx.shadowBlur = 50;
    ctx.shadowOffsetY = 20;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    ctx.lineWidth = 1;
    ctx.strokeStyle = textColor === 'black' ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.2)';
    ctx.stroke();

    // Reset skew for text rendering cleanly inside it?
    // Prototype skews text too, so we keep transform!

    // Left Section (Hero Value + Unit)
    ctx.fillStyle = textColor.startsWith('#') ? textColor : (textColor.startsWith('#') ? textColor : (textColor === 'black' ? 'black' : 'white'));

    // Strategy: Render Value, then Unit with a safer gap to avoid 'destruction'
    ctx.font = `normal 900 84px ${sysFont}`; // Increased slightly for punch
    const distValStr = String(distText);
    const valWidth = ctx.measureText(distValStr).width;

    // Centered but shifted left to make room for unit
    const startXVal = -w / 4 - 20;
    ctx.fillText(distValStr, startXVal, -15);

    // Unit (KM) - Studio Grade Alignment
    ctx.font = `normal 800 28px ${sysFont}`;
    ctx.fillStyle = textColor === 'black' ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.7)';
    ctx.fillText(distUnit, startXVal + valWidth / 2 + 35, -15);

    // DISTANCE Label (Below)
    ctx.fillStyle = textColor === 'black' ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.6)';
    ctx.font = `900 16px ${sysFont}`;
    if ((ctx as any).letterSpacing !== undefined) (ctx as any).letterSpacing = "0.2em";
    const mainLabelText = (stats.hasDistance ? 'DISTANCE' : (stats.mainLabel || 'DURATION')).toUpperCase();
    ctx.fillText(mainLabelText, startXVal, 35);
    if ((ctx as any).letterSpacing !== undefined) (ctx as any).letterSpacing = "0px";

    // Divider
    ctx.fillStyle = textColor === 'black' ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.2)';
    ctx.fillRect(0, -40, 2, 80);

    // Right Unit (Data + /KM) - Studio Grade Alignment
    const startXR = w / 4 + 20;
    ctx.fillStyle = textColor.startsWith('#') ? textColor : (textColor.startsWith('#') ? textColor : (textColor === 'black' ? 'black' : 'white'));
    ctx.font = `normal 900 84px ${sysFont}`; // Increased to match Left
    ctx.fillText(paceText, startXR, -15);

    const paceWidth = ctx.measureText(paceText).width;
    ctx.font = `normal 800 28px ${sysFont}`;
    ctx.fillStyle = textColor === 'black' ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.7)';
    ctx.fillText(paceUnit, startXR + paceWidth / 2 + 35, -15);

    // PACE Label (Below)
    ctx.fillStyle = textColor === 'black' ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.6)';
    ctx.font = `900 16px ${sysFont}`;
    if ((ctx as any).letterSpacing !== undefined) (ctx as any).letterSpacing = "0.2em";
    const subLabelText = (stats.subLabel || (stats.hasDistance ? (stats.type === 'Ride' ? "Avg Speed" : "Pace") : "Heart Rate")).toUpperCase();
    ctx.fillText(subLabelText, startXR, 35);
    if ((ctx as any).letterSpacing !== undefined) (ctx as any).letterSpacing = "0px";

    ctx.restore();
}



export function drawAwardBadge(ctx, stats, textColor) {
    const sysFont = "'Plus Jakarta Sans', sans-serif";
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';

    const distText = stats.hasDistance ? (stats.distanceVal || '0.00') : (stats.timeStr || '0:00');
    const distUnit = stats.hasDistance ? (stats.mainLabel || 'Distance') + ' Run' : (stats.mainLabel || 'Workout') + ' Duration';

    const cx = 540;
    const cy = 1650;
    const r = 160;

    // Outer Circle
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = textColor === 'black' ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)';
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = textColor === 'black' ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)';
    ctx.stroke();

    // Top pill (ATHLETE)
    const pillW = 160;
    const pillH = 40;
    ctx.beginPath();
    ctx.roundRect(cx - pillW / 2, cy - r - pillH / 2, pillW, pillH, 20);
    ctx.fillStyle = '#22d3ee';
    ctx.fill();

    ctx.fillStyle = 'black';
    ctx.font = `normal 900 16px ${sysFont}`;
    ctx.letterSpacing = "4px";
    ctx.fillText("ATHLETE", cx + 2, cy - r); // +2 kerning fix
    ctx.letterSpacing = "0px";

    ctx.fillStyle = textColor.startsWith('#') ? textColor : (textColor.startsWith('#') ? textColor : (textColor === 'black' ? 'black' : 'white'));
    ctx.font = `normal 900 80px ${sysFont}`;
    ctx.fillText(distText, cx, cy - 10);

    ctx.fillStyle = textColor === 'black' ? 'rgba(0,0,0,0.85)' : 'rgba(255,255,255,0.85)';
    ctx.font = `900 16px ${sysFont}`;
    ctx.letterSpacing = "2px";
    ctx.fillText(distUnit.toUpperCase(), cx, cy + 55);
    ctx.letterSpacing = "0px";
}

export function drawStealthBar(ctx: CanvasRenderingContext2D, stats: any, textColor: string) {
    const sysFont = "'Plus Jakarta Sans', sans-serif";
    const p = stats.dataPoints || [];
    const p1 = p[0] || { value: '0.00', label: 'Dist', unit: 'km' };
    const p2 = p[1] || { value: '0:00', label: 'Pace', unit: '' };
    const p3 = p[2] || { value: '0m', label: 'Time', unit: '' };

    const cx = 540;
    const cy = 1750;
    const w = 980;
    const h = 140;

    // Dark bar background
    ctx.save();
    ctx.translate(cx, cy);
    ctx.beginPath();
    ctx.roundRect(-w / 2, -h / 2, w, h, h / 2);
    ctx.fillStyle = 'rgba(0,0,0,0.85)';
    ctx.fill();

    // Data
    const drawCell = (data: any, x: number) => {
        ctx.save();
        ctx.translate(x, 0);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Unit (Bigger labels as requested)
        ctx.font = `800 24px ${sysFont}`;
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        if (typeof ctx.letterSpacing !== 'undefined') ctx.letterSpacing = "6px";
        const labelText = (data.unit || data.label).toUpperCase();
        ctx.fillText(labelText, 0, -35);
        ctx.letterSpacing = "0px";

        // Value
        ctx.font = `800 60px ${sysFont}`;
        ctx.fillStyle = 'white';
        ctx.fillText(data.value, 0, 25);
        ctx.restore();
    };

    drawCell(p1, -w / 2 + 200);
    drawCell(p2, 0);
    drawCell(p3, w / 2 - 200);

    ctx.restore();
}


export function drawNeonCapsule(ctx: CanvasRenderingContext2D, stats: any, textColor: string) {
    const sysFont = "'Space Mono', monospace";
    const p = stats.dataPoints || [];
    const main = p[0] || { value: '0.00', label: 'Dist', unit: 'km' };
    const sub = p[1] || { value: '0:00', label: 'Pace', unit: '/km' };

    const cx = 540;
    const cy = 1750;
    const w = 980;
    const h = 120;
    const radius = 60;

    // Outer capsule (glowing effect)
    ctx.beginPath();
    ctx.roundRect(cx - w / 2, cy - h / 2, w, h, radius);
    ctx.fillStyle = 'rgba(0,255,255,0.1)'; // Light cyan glow
    ctx.shadowColor = 'rgba(0,255,255,0.8)';
    ctx.shadowBlur = 30;
    ctx.shadowOffsetY = 0;
    ctx.fill();
    ctx.shadowBlur = 0;

    // Inner capsule (darker)
    ctx.beginPath();
    ctx.roundRect(cx - w / 2 + 5, cy - h / 2 + 5, w - 10, h - 10, radius - 5);
    ctx.fillStyle = 'rgba(0,0,0,0.8)';
    ctx.fill();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Main Value
    ctx.fillStyle = '#00ffff'; // Neon cyan
    ctx.font = `700 60px ${sysFont}`;
    ctx.fillText(main.value, cx - w / 4, cy - 10);

    // Main Unit
    ctx.font = `700 20px ${sysFont}`;
    ctx.globalAlpha = 0.8;
    ctx.fillText((main.unit || main.label).toUpperCase(), cx - w / 4, cy + 30);
    ctx.globalAlpha = 1.0;

    // Separator
    ctx.fillStyle = 'rgba(0,255,255,0.3)';
    ctx.fillRect(cx - 2, cy - h / 2 + 20, 4, h - 40);

    // Sub Value
    ctx.fillStyle = '#00ffff'; // Neon cyan
    ctx.font = `700 40px ${sysFont}`;
    ctx.fillText(sub.value, cx + w / 4, cy - 10);

    // Sub Unit
    ctx.font = `700 16px ${sysFont}`;
    ctx.globalAlpha = 0.8;
    ctx.fillText((sub.unit || sub.label).toUpperCase(), cx + w / 4, cy + 20);
    ctx.globalAlpha = 1.0;
}

// ─── Quiet Luxury / Editorial Templates ───────────────────────────────────────

export function drawTrackGraphic(ctx, x, y, w, h) {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 4; i++) {
        const inset = i * 25;
        ctx.beginPath();
        ctx.roundRect(x + inset, y + inset, w - inset * 2, h - inset * 2, (w - inset * 2) / 2);
        ctx.stroke();
    }
}

export function drawWorkoutReceipt(ctx: CanvasRenderingContext2D, stats: any, textColor: string) {
    const monoFont = "'Space Mono', monospace";

    const cx = 540;
    const cy = 1100;
    const w = 640;
    const h = 820;

    const isWorkout = stats.type?.toLowerCase().includes('workout') || stats.type?.toLowerCase().includes('training') || stats.type?.toLowerCase().includes('gym') || !stats.hasDistance;
    const isRide = stats.type === 'Ride' || stats.type === 'EBikeRide';

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-1.5 * Math.PI / 180); // Classic slightly skewed receipt print

    // 1. Physical Paper Shadow
    ctx.shadowBlur = 45;
    ctx.shadowColor = 'rgba(0,0,0,0.18)';
    ctx.shadowOffsetY = 20;

    // 2. Programmatic Serrated Zig-zag Paper Edges
    const zigZagHeight = 12;
    const teethCount = 36;
    const toothWidth = w / teethCount;

    ctx.beginPath();
    // Top Edge
    ctx.moveTo(-w / 2, -h / 2 + zigZagHeight);
    for (let i = 0; i <= teethCount; i++) {
        const x = -w / 2 + i * toothWidth;
        const y = -h / 2 + (i % 2 === 0 ? 0 : zigZagHeight);
        ctx.lineTo(x, y);
    }
    // Right Edge
    ctx.lineTo(w / 2, h / 2 - zigZagHeight);
    // Bottom Edge
    for (let i = teethCount; i >= 0; i--) {
        const x = -w / 2 + i * toothWidth;
        const y = h / 2 - (i % 2 === 0 ? 0 : zigZagHeight);
        ctx.lineTo(x, y);
    }
    // Left Edge
    ctx.lineTo(-w / 2, -h / 2 + zigZagHeight);
    ctx.closePath();

    ctx.fillStyle = '#f5f4f0'; // Warm cream paper
    ctx.fill();

    // 3. Clear shadows for text rendering
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    ctx.shadowColor = 'transparent';

    // 4. Header Details
    ctx.fillStyle = '#111111';
    ctx.textAlign = 'center';

    ctx.font = `800 32px ${monoFont}`;
    ctx.fillText("SCORA.", 0, -h / 2 + 75);

    ctx.font = `700 18px ${monoFont}`;
    ctx.fillText("WORKOUT SUMMARY RECEIPT", 0, -h / 2 + 110);

    // Header Divider
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#111111';
    ctx.beginPath();
    ctx.moveTo(-w / 2 + 50, -h / 2 + 140);
    ctx.lineTo(w / 2 - 50, -h / 2 + 140);
    ctx.stroke();

    // Store Info Lines
    ctx.textAlign = 'left';
    ctx.font = `700 16px ${monoFont}`;
    const dateStr = (stats.date || 'TODAY').toUpperCase();
    const timeStr = (stats.startTime || '00:00 AM').toUpperCase();
    ctx.fillText(`DATE: ${dateStr}`, -w / 2 + 50, -h / 2 + 175);
    ctx.fillText(`TIME: ${timeStr}`, -w / 2 + 50, -h / 2 + 205);
    ctx.fillText(`TYPE: ${normalizeSport(stats.type || 'RUN').toUpperCase()}`, -w / 2 + 50, -h / 2 + 235);

    // Double Divider
    ctx.beginPath();
    ctx.moveTo(-w / 2 + 50, -h / 2 + 260); ctx.lineTo(w / 2 - 50, -h / 2 + 260);
    ctx.moveTo(-w / 2 + 50, -h / 2 + 266); ctx.lineTo(w / 2 - 50, -h / 2 + 266);
    ctx.stroke();

    // 5. Line Items (Dotted Leaders)
    const lineYStart = -h / 2 + 315;
    const rowGap = 70;

    const drawReceiptLine = (label: string, value: string, y: number) => {
        ctx.font = `700 22px ${monoFont}`;
        ctx.fillStyle = '#111111';
        ctx.textAlign = 'left';
        ctx.fillText(label, -w / 2 + 50, y);

        ctx.textAlign = 'right';
        ctx.fillText(value, w / 2 - 50, y);

        // Compute and draw dotted leaders
        ctx.textAlign = 'left';
        const labelW = ctx.measureText(label).width;
        const valW = ctx.measureText(value).width;
        const startX = -w / 2 + 50 + labelW + 10;
        const endX = w / 2 - 50 - valW - 10;

        let dotStr = "";
        while (ctx.measureText(dotStr + ".").width < (endX - startX)) {
            dotStr += ".";
        }
        ctx.fillText(dotStr, startX, y);
    };

    // Extract values based on activity context
    const distLabel = isWorkout ? "DURATION" : "DISTANCE";
    const distText = isWorkout ? (stats.timeStr || '0:00') : `${stats.distanceVal || '0.00'} KM`;

    const paceLabel = isWorkout ? "HEART RATE" : (isRide ? "AVG SPEED" : "PACE");
    const paceText = isWorkout ? (stats.avgHeartrate ? `${stats.avgHeartrate} BPM` : 'N/A') : (stats.subValue || 'N/A').toUpperCase();

    const energyLabel = isWorkout ? "CALORIES" : "DURATION";
    const energyText = isWorkout ? (stats.calories ? `${stats.calories} KCAL` : 'N/A') : (stats.timeStr || 'N/A').toUpperCase();

    drawReceiptLine(distLabel, distText, lineYStart);
    drawReceiptLine(paceLabel, paceText, lineYStart + rowGap);
    drawReceiptLine(energyLabel, energyText, lineYStart + rowGap * 2);

    // Location line
    const locLabel = "LOCATION";
    const locText = (stats.location || 'OUTDOORS').toUpperCase().substring(0, 16);
    drawReceiptLine(locLabel, locText, lineYStart + rowGap * 3);

    // Barcode Divider
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(-w / 2 + 50, lineYStart + rowGap * 3 + 55);
    ctx.lineTo(w / 2 - 50, lineYStart + rowGap * 3 + 55);
    ctx.stroke();
    ctx.setLineDash([]);

    // 6. Draw barcode
    const barcodeY = h / 2 - 150;
    const barcodeH = 65;
    const barcodeW = w - 180;
    const startX = -barcodeW / 2;

    ctx.fillStyle = '#111111';
    let currX = startX;
    // Deterministic bars
    const bars = [3, 1, 4, 1, 2, 3, 1, 4, 2, 1, 3, 2, 1, 4, 1, 2, 3, 1, 4, 2, 1, 3, 2];
    for (let i = 0; i < bars.length; i++) {
        const barW = bars[i] * 3.5;
        const gapW = ((i % 4) + 1.5) * 3;
        ctx.fillRect(currX, barcodeY, barW, barcodeH);
        currX += barW + gapW;
    }

    // Barcode serial label
    ctx.textAlign = 'center';
    ctx.font = `700 15px ${monoFont}`;
    const activityId = stats.id ? String(stats.id).substring(0, 12).toUpperCase() : 'FIT-REC-99';
    ctx.fillText(`*SC-${activityId}*`, 0, barcodeY + barcodeH + 25);

    ctx.restore();
}

export function drawEssentialItalic(ctx: CanvasRenderingContext2D, stats: any, textColor: string) {
    const sysFont = "'Plus Jakarta Sans', sans-serif";
    const p = stats.dataPoints || [];
    const main = p[0] || { value: '0.00', label: 'Distance', unit: 'km' };
    const sub = p[1] || { value: '0:00', label: 'Pace', unit: '/km' };

    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';

    const cx = 100;
    const cy = 1750;

    // 1. Date (Above distance)
    const datePoint = p.find(x => x.label === 'Date') || { value: stats.date || 'MAR 08' };
    ctx.save();
    ctx.font = `normal 700 28px ${sysFont}`;
    ctx.fillStyle = textColor === 'black' ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.3)';
    if (typeof ctx.letterSpacing !== 'undefined') ctx.letterSpacing = "10px";
    // Distance from baseline of main text to date baseline
    ctx.fillText(datePoint.value.toUpperCase(), cx, cy - 350);
    ctx.restore();

    // 2. Main value + unit inline (e.g. "8.02" in hero + "km" as inline tag)
    const heroValue = main.value;
    let fontSize = heroValue.length > 5 ? 180 : 350;
    ctx.font = `normal 900 ${fontSize}px ${sysFont}`;
    const textWidth = ctx.measureText(heroValue).width;
    const maxWidth = 840; // leave room for unit
    if (textWidth > maxWidth) {
        fontSize *= (maxWidth / textWidth);
        ctx.font = `normal 900 ${fontSize}px ${sysFont}`;
    }
    ctx.fillStyle = textColor.startsWith('#') ? textColor : (textColor.startsWith('#') ? textColor : (textColor === 'black' ? 'black' : 'white'));
    ctx.fillText(heroValue, cx - 10, cy);

    // Unit "km" inline — smaller, light weight, right after the value
    const heroW = ctx.measureText(heroValue).width;
    const unitSize = Math.round(fontSize * 0.28);
    ctx.font = `300 ${unitSize}px ${sysFont}`;
    ctx.fillStyle = textColor === 'black' ? 'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.55)';
    if (typeof ctx.letterSpacing !== 'undefined') ctx.letterSpacing = "3px";
    ctx.fillText((main.unit || 'km').toUpperCase(), cx - 10 + heroW + 16, cy);
    if (typeof ctx.letterSpacing !== 'undefined') ctx.letterSpacing = "0px";

    // 3. Pace footer — "4:27 /km" on its own line
    if (sub.value && sub.value !== '-') {
        ctx.save();
        ctx.font = `300 44px ${sysFont}`;
        ctx.fillStyle = textColor === 'black' ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.5)';
        if (typeof ctx.letterSpacing !== 'undefined') ctx.letterSpacing = "2px";
        const paceUnit = sub.unit || '/km';
        ctx.fillText(`${sub.value} ${paceUnit}`.toLowerCase(), cx, cy + 90);
        ctx.restore();
    }
}

export function drawObsidianBar(ctx: CanvasRenderingContext2D, stats: any, textColor: string) {
    const { solid, trans, label: labelColor, accent: accentColor } = buildColors(textColor);
    const sysFont = "'Outfit', sans-serif";

    const cx = 540;
    const cy = 1750;
    const barW = 880;
    const barH = 160;
    const radius = 24;

    const isWorkout = stats.type?.toLowerCase().includes('workout') || stats.type?.toLowerCase().includes('training') || stats.type?.toLowerCase().includes('gym') || !stats.hasDistance;
    const isRide = stats.type === 'Ride' || stats.type === 'EBikeRide';

    const p1Label = isWorkout ? "DURATION" : "DISTANCE";
    const p1Value = isWorkout ? (stats.timeStr || '0:00') : `${stats.distanceVal || '0.00'} KM`;

    const p2Label = isWorkout ? "HEART RATE" : (isRide ? "AVG SPEED" : "PACE");
    const p2Value = isWorkout ? (stats.avgHeartrate ? `${stats.avgHeartrate} BPM` : 'N/A') : (stats.subValue || 'N/A').toUpperCase();

    const p3Label = isWorkout ? "ENERGY" : "DURATION";
    const p3Value = isWorkout ? (stats.calories ? `${stats.calories} KCAL` : 'N/A') : (stats.timeStr || 'N/A').toUpperCase();

    ctx.save();
    applyAntiGhostingShadow(ctx, textColor);

    // Glass backdrop container
    ctx.fillStyle = textColor === 'black' ? 'rgba(255, 255, 255, 0.85)' : 'rgba(28, 28, 30, 0.75)';
    ctx.beginPath();
    ctx.roundRect(cx - barW / 2, cy - barH / 2, barW, barH, radius);
    ctx.fill();

    ctx.strokeStyle = textColor === 'black' ? 'rgba(0, 0, 0, 0.12)' : 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Subtle vertical dividers between columns
    ctx.strokeStyle = textColor === 'black' ? 'rgba(0, 0, 0, 0.08)' : 'rgba(255, 255, 255, 0.1)';
    ctx.beginPath();
    ctx.moveTo(cx - barW / 6, cy - 40);
    ctx.lineTo(cx - barW / 6, cy + 40);
    ctx.moveTo(cx + barW / 6, cy - 40);
    ctx.lineTo(cx + barW / 6, cy + 40);
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    const drawCell = (val: string, label: string, x: number) => {
        ctx.save();
        ctx.translate(x, cy);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Label
        ctx.fillStyle = accentColor;
        ctx.font = `800 13px ${sysFont}`;
        setLetterSpacing(ctx, "3px");
        ctx.fillText(label, 0, -25);
        setLetterSpacing(ctx, "0px");

        // Value
        ctx.fillStyle = textColor;
        ctx.font = `normal 900 42px ${sysFont}`;
        ctx.fillText(val, 0, 20);

        ctx.restore();
    };

    drawCell(p1Value, p1Label, cx - 280);
    drawCell(p2Value, p2Label, cx);
    drawCell(p3Value, p3Label, cx + 280);

    ctx.restore();
}

export function drawModernPill(ctx: CanvasRenderingContext2D, stats: any, textColor: string) {
    const { solid, trans, label: labelColor, accent: accentColor } = buildColors(textColor);
    const sysFont = "'Outfit', sans-serif";

    const cx = 540;
    const cy = 1750;
    const w = 920;
    const h = 160;
    const radius = 80;

    const isWorkout = stats.type?.toLowerCase().includes('workout') || stats.type?.toLowerCase().includes('training') || stats.type?.toLowerCase().includes('gym') || !stats.hasDistance;
    const isRide = stats.type === 'Ride' || stats.type === 'EBikeRide';

    const p1Label = isWorkout ? "DURATION" : "DISTANCE";
    const p1Value = isWorkout ? (stats.timeStr || '0:00') : (stats.distanceVal || '0.00');
    const p1Unit = isWorkout ? '' : 'KM';

    const p2Label = isWorkout ? "HEART RATE" : (isRide ? "AVG SPEED" : "PACE");
    const p2Value = isWorkout ? (stats.avgHeartrate ? `${stats.avgHeartrate}` : 'N/A') : (stats.subValue || 'N/A').split(' ')[0];
    const p2Unit = isWorkout ? 'BPM' : (stats.subValue || '').split(' ')[1] || (isRide ? 'KM/H' : '/KM');

    ctx.save();
    applyAntiGhostingShadow(ctx, textColor);

    // 1. Glass Backdrop Container
    ctx.beginPath();
    ctx.roundRect(cx - w / 2, cy - h / 2, w, h, radius);
    ctx.fillStyle = textColor === 'black' ? 'rgba(255, 255, 255, 0.8)' : 'rgba(28, 28, 30, 0.7)';
    ctx.fill();

    ctx.strokeStyle = textColor === 'black' ? 'rgba(0, 0, 0, 0.12)' : 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    // 2. Data Left Half
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillStyle = textColor;

    // Left value
    ctx.font = `normal 900 85px ${sysFont}`;
    ctx.fillText(p1Value, cx - w / 2 + 70, cy - 12);
    const valW = ctx.measureText(p1Value).width;

    // Left unit
    ctx.font = `800 13px ${sysFont}`;
    ctx.fillStyle = accentColor;
    setLetterSpacing(ctx, "3px");
    ctx.fillText(`${p1Label} ${p1Unit}`, cx - w / 2 + 70, cy + 38);
    setLetterSpacing(ctx, "0px");

    // Middle Separator Line
    ctx.strokeStyle = textColor === 'black' ? 'rgba(0, 0, 0, 0.08)' : 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx - w / 2 + 70 + valW + 40, cy - 35);
    ctx.lineTo(cx - w / 2 + 70 + valW + 40, cy + 35);
    ctx.stroke();

    // 3. Data Right Half
    const subX = cx - w / 2 + 70 + valW + 80;
    ctx.fillStyle = textColor;
    ctx.font = `normal 900 68px ${sysFont}`;
    ctx.fillText(p2Value, subX, cy - 12);

    ctx.font = `800 13px ${sysFont}`;
    ctx.fillStyle = accentColor;
    setLetterSpacing(ctx, "3px");
    ctx.fillText(`${p2Label} ${p2Unit}`.toUpperCase(), subX, cy + 38);
    setLetterSpacing(ctx, "0px");

    ctx.restore();
}

export function drawTrackRecord(ctx: CanvasRenderingContext2D, stats: any, textColor: string) {
    const sysFont = "'Plus Jakarta Sans', sans-serif";
    const p = stats.dataPoints || [];
    const main = p[0] || { value: '0.00', label: 'Dist', unit: 'km' };

    const cx = 540;
    const cy = 960;

    // Track Background
    drawTrackGraphic(ctx, cx - 300, cy - 450, 600, 900);

    // Main Stat
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const heroValue = main.value;
    const isLong = heroValue.length > 5;
    ctx.font = `normal 900 ${isLong ? '100px' : '235px'} ${sysFont}`;
    ctx.fillStyle = textColor.startsWith('#') ? textColor : (textColor.startsWith('#') ? textColor : (textColor === 'black' ? 'black' : 'white'));
    ctx.fillText(heroValue, cx, cy - 20);

    // Label (Bigger units, less transparency)
    ctx.font = `800 32px ${sysFont}`;
    ctx.fillStyle = textColor === 'black' ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.6)';
    if (typeof ctx.letterSpacing !== 'undefined') ctx.letterSpacing = "15px";
    const label = (main.unit || main.label).toUpperCase();
    ctx.fillText(label, cx + 10, cy + 120);
    ctx.letterSpacing = "0px";
}


export function drawMonoSplit(ctx: CanvasRenderingContext2D, stats: any, textColor: string) {
    const { solid, trans, label: labelColor, accent: accentColor } = buildColors(textColor);
    const isDarkAccent = isColorDark(accentColor);
    const sysFont = "'Outfit', sans-serif";

    const cx = 540;
    const cy = 1750;
    const w = 800; // slightly more compact
    const h = 140; // slightly more compact
    const radius = 24;

    const isWorkout = stats.type?.toLowerCase().includes('workout') || stats.type?.toLowerCase().includes('training') || stats.type?.toLowerCase().includes('gym') || !stats.hasDistance;
    const isRide = stats.type === 'Ride' || stats.type === 'EBikeRide';

    const p1Value = (isWorkout ? (stats.timeStr || '0:00') : (stats.distanceVal || '0.00')).toUpperCase();
    const p1Label = isWorkout ? 'DURATION' : 'DISTANCE';
    const p1Unit = isWorkout ? '' : 'KM';

    const p2Value = (isWorkout ? (stats.avgHeartrate ? `${stats.avgHeartrate}` : (stats.calories ? `${stats.calories}` : 'WORKOUT')) : (stats.subValue || '0:00').split(' ')[0]).toUpperCase();
    const p2Label = isWorkout ? (stats.avgHeartrate ? 'HEART RATE' : 'CALORIES') : (isRide ? 'AVG SPEED' : 'PACE');
    const p2Unit = isWorkout ? (stats.avgHeartrate ? 'BPM' : 'KCAL') : (stats.subValue || '').split(' ')[1] || '/KM';

    ctx.save();
    applyAntiGhostingShadow(ctx, textColor);

    // 1. Left Half Background (Accent Color)
    ctx.beginPath();
    ctx.roundRect(cx - w / 2, cy - h / 2, w / 2, h, [radius, 0, 0, radius]);
    ctx.fillStyle = accentColor;
    ctx.fill();

    // 2. Right Half Background (Theme Contrast)
    const isLightTextTheme = textColor === 'black';
    const rightBg = isLightTextTheme ? '#ffffff' : '#1c1c1e';
    ctx.beginPath();
    ctx.roundRect(cx, cy - h / 2, w / 2, h, [0, radius, radius, 0]);
    ctx.fillStyle = rightBg;
    ctx.fill();

    // Draw container border
    ctx.strokeStyle = textColor === 'black' ? 'rgba(0, 0, 0, 0.12)' : 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(cx - w / 2, cy - h / 2, w, h, radius);
    ctx.stroke();

    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    // --- LEFT SIDE DATA ---
    ctx.fillStyle = isDarkAccent ? '#ffffff' : '#111111';

    // Value
    ctx.font = `normal 900 52px ${sysFont}`;
    const leftValStr = p1Unit ? `${p1Value} ${p1Unit}` : p1Value;
    ctx.fillText(leftValStr, cx - w / 4, cy - 18);

    // Label
    ctx.font = `800 13px ${sysFont}`;
    setLetterSpacing(ctx, '3px');
    ctx.fillText(p1Label, cx - w / 4, cy + 30);

    // --- RIGHT SIDE DATA ---
    ctx.fillStyle = isLightTextTheme ? '#111111' : '#ffffff';

    // Value
    ctx.font = `normal 900 52px ${sysFont}`;
    const rightValStr = p2Unit ? `${p2Value} ${p2Unit}` : p2Value;
    setLetterSpacing(ctx, '0px');
    ctx.fillText(rightValStr, cx + w / 4, cy - 18);

    // Label
    ctx.font = `800 13px ${sysFont}`;
    setLetterSpacing(ctx, '3px');
    ctx.fillText(p2Label, cx + w / 4, cy + 30);
    setLetterSpacing(ctx, '0px');

    ctx.restore();
}

export function drawEditorialArchive(ctx: CanvasRenderingContext2D, stats: any, textColor: string) {
    const sysFont = "'Plus Jakarta Sans', sans-serif";
    const p = stats.dataPoints || [];
    const p1 = p[0] || { value: stats.distanceVal || '0.00', label: stats.mainLabel || 'Dist', unit: 'km' };
    const p2 = p[1] || { value: (stats.subValue || '').split(' ')[0] || '0:00', label: stats.subLabel || 'Pace', unit: (stats.subValue || '').split(' ')[1] || '/km' };
    const p3 = p[2] || { value: stats.timeStr || '0:00', label: 'Time', unit: '' };
    const datePoint = p.find(x => x.label === 'Date') || { value: stats.date || 'MAR 08' };

    const cx = 540;
    const cy = 1100;
    const w = 700;
    const h = 750;
    const radius = 8;

    ctx.save();
    ctx.translate(cx, cy);

    // 1. Background (White 95%)
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.beginPath();
    ctx.roundRect(-w / 2, -h / 2, w, h, radius);
    ctx.fill();

    // 2. Header
    ctx.textBaseline = 'top';
    ctx.fillStyle = 'black';

    // Date (Left)
    ctx.textAlign = 'left';
    ctx.globalAlpha = 0.4;
    ctx.font = `normal 900 18px ${sysFont}`;
    if (typeof ctx.letterSpacing !== 'undefined') ctx.letterSpacing = "10px";
    ctx.fillText(datePoint.value.toUpperCase(), -w / 2 + 50, -h / 2 + 50);
    ctx.letterSpacing = "0px";

    // "ARCHIVE" (Right)
    ctx.textAlign = 'right';
    ctx.font = `900 18px ${sysFont}`;
    if (typeof ctx.letterSpacing !== 'undefined') ctx.letterSpacing = "10px";
    ctx.fillText("ARCHIVE", w / 2 - 50, -h / 2 + 50);
    ctx.letterSpacing = "0px";
    ctx.globalAlpha = 1.0;

    // Header divider
    ctx.globalAlpha = 0.05;
    ctx.fillRect(-w / 2 + 50, -h / 2 + 100, w - 100, 2);
    ctx.globalAlpha = 1.0;

    // 3. Main Body
    ctx.textAlign = 'left';
    ctx.font = `normal 900 230px ${sysFont}`;
    ctx.fillText(p1.value, -w / 2 + 40, -h / 2 + 120);

    // Unit Label with Bar
    ctx.globalAlpha = 1.0;
    ctx.fillRect(-w / 2 + 50, -h / 2 + 120 + 240, 100, 4); // Line above unit
    ctx.font = `900 22px ${sysFont}`;
    if (typeof ctx.letterSpacing !== 'undefined') ctx.letterSpacing = "5px";
    ctx.fillText(`DIST // ${p1.unit || 'KM'}`, -w / 2 + 50, -h / 2 + 120 + 265);
    ctx.letterSpacing = "0px";

    // 4. Footer
    ctx.globalAlpha = 0.05;
    ctx.fillRect(-w / 2 + 50, h / 2 - 160, w - 100, 2);
    ctx.globalAlpha = 1.0;

    // Columns
    const footerY = h / 2 - 110;

    // Pace column
    ctx.textAlign = 'left';
    ctx.globalAlpha = 0.3;
    ctx.font = `900 14px ${sysFont}`;
    ctx.fillText((p2.label || "PACE").toUpperCase(), -w / 2 + 50, footerY - 25);
    ctx.globalAlpha = 1.0;
    ctx.font = `normal 900 55px ${sysFont}`;
    ctx.fillText(p2.value, -w / 2 + 50, footerY + 20);

    // Time column
    ctx.textAlign = 'right';
    ctx.globalAlpha = 0.3;
    ctx.font = `900 14px ${sysFont}`;
    ctx.fillText("TIME", w / 2 - 50, footerY - 25);
    ctx.globalAlpha = 1.0;
    ctx.font = `normal 900 55px ${sysFont}`;
    ctx.fillText(p3.value, w / 2 - 50, footerY + 20);

    ctx.restore();
}


export function drawMetricThin(ctx: CanvasRenderingContext2D, stats: any, textColor: string) {
    const sysFont = "'Plus Jakarta Sans', sans-serif";
    const p = stats.dataPoints || [];
    const main = p[0] || { value: '0.00', label: 'Dist', unit: 'km' };
    const sub = p[1] || { value: '0:00', label: 'Pace', unit: '/km' };

    const cx = 100;
    const cy = 1750;

    // Massive Thin Number
    const heroValue = main.value;
    let fontSize = heroValue.length > 5 ? 240 : 480;
    ctx.font = `100 ${fontSize}px ${sysFont}`;
    const textWidth = ctx.measureText(heroValue).width;
    const maxWidth = 880;
    if (textWidth > maxWidth) {
        fontSize *= (maxWidth / textWidth);
        ctx.font = `100 ${fontSize}px ${sysFont}`;
    }

    ctx.fillStyle = textColor.startsWith('#') ? textColor : (textColor.startsWith('#') ? textColor : (textColor === 'black' ? 'black' : 'white'));
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    ctx.fillText(heroValue, cx, cy);

    // Bottom row
    const rowY = cy + 110;
    ctx.save();
    // Unit (bigger, readable)
    ctx.font = `800 28px ${sysFont}`;
    ctx.fillStyle = textColor === 'black' ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.4)';
    if (typeof ctx.letterSpacing !== 'undefined') ctx.letterSpacing = "15px";
    const labelMain = (main.unit || main.label).toUpperCase();
    ctx.fillText(labelMain, cx + 5, rowY);
    ctx.restore();

    // Secondary stat
    ctx.font = `normal 100 110px ${sysFont}`;
    ctx.fillStyle = textColor === 'black' ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.6)';
    ctx.fillText(sub.value, cx + 240, rowY + 15);
}

export function drawDataMatrix(ctx: CanvasRenderingContext2D, stats: any, textColor: string) {
    const sysFont = "'Plus Jakarta Sans', sans-serif";
    const p = stats.dataPoints || [];
    // Matrix 2x2
    const p0 = p[0] || { value: '-', label: 'Dist', unit: '' };
    const p1 = p[1] || { value: '-', label: 'Pace', unit: '' };
    const p2 = p[2] || { value: '-', label: 'Time', unit: '' };
    const p3 = p[8] || p[3] || { value: '-', label: 'Speed', unit: '' };

    const cx = 180;
    const cy = 1350;
    const rowH = 280;
    const colW = 420;

    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    const renderCell = (data, x, y, size) => {
        ctx.save();
        ctx.fillStyle = textColor.startsWith('#') ? textColor : (textColor.startsWith('#') ? textColor : (textColor === 'black' ? 'black' : 'white'));
        let fontSize = size;
        ctx.font = `normal 900 ${fontSize}px ${sysFont}`;
        const w = ctx.measureText(data.value).width;
        if (w > colW - 20) fontSize *= ((colW - 20) / w);
        ctx.font = `normal 900 ${fontSize}px ${sysFont}`;
        ctx.fillText(data.value, x, y);

        ctx.font = `900 20px ${sysFont}`;
        ctx.fillStyle = textColor === 'black' ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.2)';
        if (typeof ctx.letterSpacing !== 'undefined') ctx.letterSpacing = "12px";
        ctx.fillText((data.unit || data.label).toUpperCase(), x + 5, y + size * 0.7);
        ctx.restore();
    };

    renderCell(p0, cx, cy, 180);
    renderCell(p1, cx + colW, cy, 180);
    renderCell(p2, cx, cy + rowH, 120);
    renderCell(p3, cx + colW, cy + rowH, 120);
}

export function drawVerticalLabel(ctx: CanvasRenderingContext2D, stats: any, textColor: string) {
    const sysFont = "'Plus Jakarta Sans', sans-serif";
    const p = stats.dataPoints || [];
    const main = p[0] || { value: '0.00', label: 'Dist', unit: 'km' };
    const p2 = p[1] || { value: '0:00', label: 'Pace', unit: '' };
    const p3 = p[2] || { value: '0m', label: 'Time', unit: '' };

    const cx = 540;
    const cy = 950;
    const boxW = 340; // Even narrower (was 380)
    const boxH_top = 750;
    const boxH_bot = 620;

    // 1. Top Section (Black)
    ctx.fillStyle = 'black';
    ctx.fillRect(cx - boxW / 2, cy - boxH_top, boxW, boxH_top);

    // 2. Vertical Hero (Shifted up slightly to avoid label overlap)
    ctx.save();
    ctx.translate(cx, cy - boxH_top * 0.6); // Moved up (was 0.55)
    ctx.rotate(Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'white';

    let fontSize = 210;
    ctx.font = `normal 900 ${fontSize}px ${sysFont}`;
    const textW = ctx.measureText(main.value).width;
    if (textW > boxH_top * 0.75) { // Tighter constraint (was 0.8)
        fontSize *= (boxH_top * 0.75 / textW);
        ctx.font = `normal 900 ${fontSize}px ${sysFont}`;
    }
    if (typeof ctx.letterSpacing !== 'undefined') ctx.letterSpacing = "-8px";
    ctx.fillText(main.value, 0, 0);
    ctx.restore();

    // 3. KM Unit (Moved down and centered)
    ctx.save();
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = `900 40px ${sysFont}`;
    if (typeof ctx.letterSpacing !== 'undefined') ctx.letterSpacing = "12px";
    const labelMain = (main.unit || main.label).toUpperCase();
    ctx.fillText(labelMain, cx + 6, cy - 70); // Moved down (was 140)
    ctx.restore();

    // 4. Bottom Section (White)
    ctx.fillStyle = 'white';
    ctx.fillRect(cx - boxW / 2, cy, boxW, boxH_bot);

    // 5. Secondary Data Points (Condensed but readable)
    const renderBotCell = (data, yOffset, size, labelOpacity, weight, labelSize) => {
        ctx.save();
        ctx.translate(cx, cy + yOffset);
        ctx.textAlign = 'center';
        ctx.fillStyle = 'black';
        ctx.font = `normal ${weight} ${size}px ${sysFont}`;
        ctx.fillText(data.value, 0, 0);

        ctx.font = `900 ${labelSize}px ${sysFont}`;
        ctx.fillStyle = `rgba(0,0,0,${labelOpacity})`;
        if (typeof ctx.letterSpacing !== 'undefined') ctx.letterSpacing = "10px";
        ctx.fillText(data.label.toUpperCase(), 0, labelSize + 15);
        ctx.restore();
    };

    renderBotCell(p2, 170, 100, 0.5, 900, 32); // Pace (Bigger & more opaque)
    renderBotCell(p3, 400, 80, 0.4, 300, 32);  // Time/Duration (Bigger & more opaque)
}

export function drawFrostedMinimal(ctx: CanvasRenderingContext2D, stats: any, textColor: string) {
    const sysFont = "'Plus Jakarta Sans', sans-serif";
    const p = stats.dataPoints || [];
    const main = p[0] || { value: '0.00', label: 'Dist', unit: 'km' };
    const p2 = p[1] || { value: '0m', label: 'Time', unit: '' };

    const cx = 540;
    const cy = 1750;
    const w = 800;
    const h = 200;

    // Glass Pill
    ctx.beginPath();
    ctx.roundRect(cx - w / 2, cy - h / 2, w, h, 100);
    ctx.fillStyle = textColor === 'black' ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)';
    ctx.fill();
    ctx.strokeStyle = textColor === 'black' ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Primary
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = textColor.startsWith('#') ? textColor : (textColor.startsWith('#') ? textColor : (textColor === 'black' ? 'black' : 'white'));
    const isLongStr = main.value.length > 5;
    ctx.font = `normal 900 ${isLongStr ? '70px' : '140px'} ${sysFont}`;
    const dWValue = ctx.measureText(main.value).width;
    ctx.fillText(main.value, cx - w / 2 + 80, cy);

    ctx.font = `900 18px ${sysFont}`;
    ctx.globalAlpha = 0.2;
    (ctx as any).letterSpacing = "8px";
    const labelMainStr = (main.unit || main.label).toUpperCase();
    ctx.fillText(labelMainStr, cx - w / 2 + 80 + dWValue + 20, cy + 10);
    (ctx as any).letterSpacing = "0px";
    ctx.globalAlpha = 1.0;

    // Separator
    ctx.strokeStyle = textColor === 'black' ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)';
    ctx.beginPath(); ctx.moveTo(cx + 20, cy - 40); ctx.lineTo(cx + 20, cy + 40); ctx.stroke();

    // Secondary
    ctx.textAlign = 'left';
    ctx.fillStyle = textColor === 'black' ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.6)';
    ctx.font = `300 70px ${sysFont}`;
    ctx.fillText(p2.value, cx + 80, cy - 10);
    ctx.font = `900 14px ${sysFont}`;
    ctx.globalAlpha = 0.1;
    (ctx as any).letterSpacing = "10px";
    ctx.fillText(p2.label.toUpperCase(), cx + 80, cy + 40);
    (ctx as any).letterSpacing = "0px";
    ctx.globalAlpha = 1.0;
}


// ─── Export ───────────────────────────────────────────────────────────────────

export async function exportCanvas(canvasId: string) {
    const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
    if (!canvas) return;

    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = [
        now.getHours(),
        now.getMinutes(),
        now.getSeconds()
    ].map(v => String(v).padStart(2, '0')).join('');
    const fileName = `scora-${dateStr}-${timeStr}.png`;

    // ─── OPTION A: Web Share API (iOS Safari ONLY) ───
    // Standard download is "broken" on iOS Safari (saves to a hidden 'Files' folder).
    // We use the Share Sheet here to allow "Save to Photos" directly.
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (/Macintosh/i.test(navigator.userAgent) && navigator.maxTouchPoints > 1) ||
        /Mobile/i.test(navigator.userAgent);

    if (isIOS && navigator.share && navigator.canShare) {
        try {
            const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
            if (blob) {
                const file = new File([blob], fileName, { type: 'image/png' });
                if (navigator.canShare({ files: [file] })) {
                    await navigator.share({
                        files: [file],
                        title: 'Scora Sticker',
                        text: 'Created with Scora'
                    });
                    return; // Success on iOS!
                }
            }
        } catch (err) {
            console.warn("[Export] Web Share failed, falling back to download:", err);
        }
    }

    // ─── OPTION B: Standard Download (Android & Desktop) ───
    // Fast, single-tap experience.
    const link = document.createElement('a');
    link.download = fileName;
    link.href = canvas.toDataURL('image/png');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
// ─── Narrative Highlight Sticker (Precision Replication) ─────────────────────

export function drawNarrativeHighlight(ctx: CanvasRenderingContext2D, stats: any, textColor: string) {
    const serifFont = "'Playfair Display', serif";
    const wantWhiteCard = textColor === 'white' || textColor === '#ffffff';
    const bgColor = wantWhiteCard ? 'rgba(255, 255, 255, 0.9)' : 'rgba(20, 20, 22, 0.9)';
    const textCol = wantWhiteCard ? '#1a1a1a' : '#ffffff';
    const highlightColor = wantWhiteCard ? "#FFD644" : "rgba(255, 214, 68, 0.4)";

    const cx = 540;
    const cy = 300; // Moved to top, near Scora logo

    // ─── Data Extraction & Sport Logic ───────────────────────────────────────
    const distNum = parseFloat(stats.distanceVal);
    const baseActivity = normalizeSport(stats.activityType || 'Run');
    const activityLower = baseActivity.toLowerCase();

    // 1. Determine Units & Labels
    let unit = 'kilometers';
    let metricLabel = 'pace';
    let activityAction = 'through';
    let mainMetric = stats.distanceVal;

    if (activityLower === 'ride' || activityLower.includes('cycle')) {
        unit = distNum === 1 ? 'kilometer' : 'kilometers';
        metricLabel = 'speed';
    } else if (activityLower === 'run' || activityLower === 'walk' || activityLower === 'hike') {
        unit = distNum === 1 ? 'kilometer' : 'kilometers';
        metricLabel = 'pace';
    } else if (activityLower === 'swim') {
        unit = distNum === 1 ? 'meter' : 'meters';
        metricLabel = 'pace';
        activityAction = 'in';
        mainMetric = Math.round(distNum * 1000).toString(); // Convert km to meters for swim narrative
    }

    const location = stats.location && stats.location !== 'Unknown' ? stats.location : '';
    const region = stats.region && stats.region !== 'World' ? stats.region : '';
    const duration = stats.timeStr || '0m';
    const pace = (stats.subValue || '').split(' ')[0] || '0:00';
    const paceUnit = (stats.subValue || '').split(' ')[1] || '/km';
    const dateStr = stats.date || '';

    // 2. Build Narrative Lines
    let l1_p1 = "";
    let l1_p2 = "";
    let l2_p1 = "";
    let l2_p2 = "";
    let l2_p3 = "";
    let l2_p4 = "";
    let l2_p5 = "";

    const isWorkout = stats.type?.toLowerCase().includes('workout') || stats.type?.toLowerCase().includes('training') || stats.type?.toLowerCase().includes('gym') || !stats.hasDistance;

    if (isWorkout) {
        l1_p1 = `${duration}`;
        l1_p2 = ` ${applyActivityCasing(baseActivity, 'narrative-highlight')} ${location ? 'in ' + location : ''},`;
        l2_p1 = 'At ';
        l2_p2 = stats.avgHeartrate ? `${stats.avgHeartrate} bpm` : 'steady';
        l2_p3 = ` effort · ${dateStr}`;
        l2_p4 = "";
        l2_p5 = "";
    } else {
        l1_p1 = `${mainMetric} ${unit}`;
        l1_p2 = ` ${applyActivityCasing(baseActivity, 'narrative-highlight')} ${activityAction} ${location || 'the world'},`;
        l2_p1 = 'In ';
        l2_p2 = `${duration}`;
        l2_p3 = `, at `;
        l2_p4 = `${pace}${paceUnit}`;
        l2_p5 = ` ${metricLabel} · ${dateStr}`;
    }

    // 3. Text Content Setup (Pre-measure for scaling)
    ctx.save();
    let baseFontSize = 82;
    ctx.font = `600 ${baseFontSize}px ${serifFont}`;

    const maxTextW = 920;
    const w1 = ctx.measureText(l1_p1 + l1_p2).width;
    const w2 = ctx.measureText(l2_p1 + l2_p2 + l2_p3 + l2_p4 + l2_p5).width;
    const maxW = Math.max(w1, w2);

    if (maxW > maxTextW) {
        baseFontSize *= (maxTextW / maxW);
        ctx.font = `600 ${baseFontSize}px ${serifFont}`;
    }

    const cardW = 1080;
    const cardH = 280; // Reduced from 320 for a tighter, symmetrical look

    // 4. Card Background (Clean White for High Fidelity)
    ctx.save();

    // Subtle professional shadow
    ctx.shadowColor = 'rgba(0,0,0,0.12)';
    ctx.shadowBlur = 40;
    ctx.shadowOffsetY = 15;

    // Draw Base Card (Pure White)
    ctx.fillStyle = bgColor;
    const xIdx = cx - cardW / 2;
    const yIdx = cy - cardH / 2;
    ctx.beginPath();
    ctx.roundRect(xIdx, yIdx, cardW, cardH, 2);
    ctx.fill();
    ctx.restore();

    // Paper physics removed per user request
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(xIdx, yIdx, cardW, cardH, 2);
    ctx.clip();
    ctx.restore();

    // 5. Draw Text
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';

    const gap = baseFontSize * 1.4;
    const l1Y = cy - 55; // Mathematically centered for 280px card
    const l2Y = cy + 55;
    const startX = cx - cardW / 2 + 70;

    function drawSegment(text: string, x: number, y: number, highlight: boolean) {
        const width = ctx.measureText(text).width;
        if (highlight) {
            ctx.save();
            ctx.fillStyle = highlightColor;
            const hH = baseFontSize * 0.85; // Perfect marker proportions
            ctx.beginPath();
            ctx.roundRect(x - 8, y - hH / 2, width + 16, hH, 8); // Elegant rounded highlighter cap
            ctx.fill();
            ctx.restore();
        }
        ctx.fillStyle = textCol;
        ctx.fillText(text, x, y);
        return width;
    }

    // Line 1
    let currX = startX;
    currX += drawSegment(l1_p1, currX, l1Y, true);
    drawSegment(l1_p2, currX, l1Y, false);

    // Line 2
    currX = startX;
    currX += drawSegment(l2_p1, currX, l2Y, false);
    currX += drawSegment(l2_p2, currX, l2Y, true);
    currX += drawSegment(l2_p3, currX, l2Y, false);
    if (l2_p4) currX += drawSegment(l2_p4, currX, l2Y, true);
    drawSegment(l2_p5, currX, l2Y, false);

    ctx.restore();
}

// ─── Condesa Stack Sticker (Industrial Modern) ────────────────────────────────
/**
 * A bold, geometric layout inspired by modern event posters.
 * Uses stacked metrics with high-contrast typography and specific sub-labels.
 */
export function drawCondesaStack(ctx: CanvasRenderingContext2D, stats: any, textColor: string) {
    const { solid, trans, label: labelColor, accent: accentColor } = buildColors(textColor);

    const boxX = 80;
    const boxY = 200;
    const boxW = 920;
    const boxH = 360;

    const isWorkout = stats.type?.toLowerCase().includes('workout') || stats.type?.toLowerCase().includes('training') || stats.type?.toLowerCase().includes('gym') || !stats.hasDistance;
    const isRide = stats.type === 'Ride' || stats.type === 'EBikeRide';

    ctx.save();
    // applyAntiGhostingShadow(ctx, textColor); // Removed shadow per user request

    // 1. Draw rounded container (condesa stack card)
    ctx.strokeStyle = textColor === 'black' ? 'rgba(0, 0, 0, 0.1)' : 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    ctx.fillStyle = isColorDark(accentColor) ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.15)'; // Transparent liquid glass
    ctx.beginPath();
    ctx.roundRect(boxX, boxY, boxW, boxH, 16);
    ctx.fill();
    ctx.stroke();

    // Data Intelligence
    const dateObj = stats.rawDate ? new Date(stats.rawDate) : new Date();
    const dayLabel = (stats.dayName || dateObj.toLocaleDateString('en-US', { weekday: 'long' })).toUpperCase();
    const dayNum = String(dateObj.getDate()).padStart(2, '0');
    const monthLabel = dateObj.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
    const headerTitle = `${dayLabel} ${dayNum} ${monthLabel}`;

    const startTimeVal = (stats.startTime || '10:24 PM').toUpperCase();
    const distVal = isWorkout ? (stats.timeStr || '0:00') : (stats.distanceVal || '0.00');
    const distLabel = isWorkout ? 'DURATION' : 'DISTANCE';
    const distUnit = isWorkout ? '' : 'KM';

    const paceLabel = isWorkout ? 'HEART RATE' : (isRide ? 'AVG SPEED' : 'PACE');
    const paceVal = isWorkout ? (stats.avgHeartrate ? `${stats.avgHeartrate} BPM` : 'N/A') : (stats.subValue || 'N/A').toUpperCase();
    const locationVal = (stats.location || 'MEXICO').toUpperCase();

    // 2. Render Header
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = textColor === 'black' ? '#000000' : '#ffffff';
    ctx.font = `normal 700 38px 'Plus Jakarta Sans', sans-serif`;
    ctx.fillText(headerTitle, boxX + 45, boxY + 45);

    // Subtle horizontal divider under header
    ctx.strokeStyle = textColor === 'black' ? 'rgba(0, 0, 0, 0.08)' : 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(boxX + 45, boxY + 105);
    ctx.lineTo(boxX + boxW - 45, boxY + 105);
    ctx.stroke();

    // 3. Grid Columns (2x2 Grid)
    const col1X = boxX + 45;
    const col2X = boxX + boxW / 2 + 15;
    const row1Y = boxY + 130;
    const row2Y = boxY + 235;

    const drawGridItem = (x: number, y: number, label: string, val: string, unit = '') => {
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';

        // Label
        ctx.fillStyle = accentColor;
        ctx.font = `800 13px 'Plus Jakarta Sans', sans-serif`;
        setLetterSpacing(ctx, '2px');
        ctx.fillText(label, x, y);
        setLetterSpacing(ctx, '0px');

        // Value
        ctx.fillStyle = textColor; // Use custom color
        ctx.font = `normal 700 38px 'Space Grotesk', sans-serif`;
        const displayVal = unit ? `${val} ` : val;
        ctx.fillText(displayVal, x, y + 25);

        if (unit) {
            const valW = ctx.measureText(displayVal).width;
            ctx.font = `800 15px 'Space Grotesk', sans-serif`;
            ctx.fillStyle = textColor;
            ctx.fillText(unit, x + valW, y + 45);
        }
    };

    // Row 1
    drawGridItem(col1X, row1Y, "LOCAL TIME", startTimeVal);
    drawGridItem(col2X, row1Y, distLabel, distVal, distUnit);

    // Row 2
    drawGridItem(col1X, row2Y, paceLabel, paceVal);
    // Location with auto-scale
    const locMaxW = 380;
    ctx.font = `normal 700 38px 'Plus Jakarta Sans', sans-serif`;
    let locVal = locationVal;
    if (ctx.measureText(locVal).width > locMaxW) {
        locVal = locVal.substring(0, 16) + '…';
    }
    drawGridItem(col2X, row2Y, "LOCATION", locVal);

    ctx.restore();
}

// ─── New Stickers Support Helpers ──────────────────────────────────────────

export function drawStackedEditorial(ctx: CanvasRenderingContext2D, stats: any, textColor: string) {
    const { s1, s2, s3, hasMap } = getDynamicStats(stats);
    // The user's selected color drives the map. Text is always white.
    const { accent: accentColor } = buildColors(textColor);

    const cx = 540;
    const safeW = 960;

    // Parse the day name from the raw date
    const dateStrRaw = stats.rawDate || '';
    const rawDate = dateStrRaw ? new Date(dateStrRaw.replace('Z', '')) : new Date();
    const dayLabel = new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(rawDate).toUpperCase();

    ctx.save();

    // NO SHADOWS - pure flat editorial style
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;

    // 1. Map Route (Drawn FIRST so it's behind text)
    if (hasMap && stats.polyline) {
        drawRoutePath(ctx, stats.polyline, cx, 930, 800, {
            color: accentColor, // Only the map changes color!
            strokeWidth: 20
        });
    }

    const mainFont = "'Archivo Black', sans-serif";
    ctx.fillStyle = '#ffffff'; // Text is permanently white
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';

    // 2. Giant Day Name at Top (Squeezed down to y=750)
    // Scale to fill exactly 960px
    ctx.font = `900 100px ${mainFont}`;
    const topW = Math.max(1, ctx.measureText(dayLabel).width);
    let topSize = Math.floor(100 * (safeW / topW));
    if (!isFinite(topSize) || topSize > 400) topSize = 400; // Cap height

    ctx.font = `900 ${topSize}px ${mainFont}`;
    ctx.fillText(dayLabel, cx, 750);

    // 3. Giant Distance at Bottom (Squeezed up to y=1150)
    const valText = String(s1.value);
    const unitText = String(s1.label);
    const distText = `${valText} ${unitText}`;

    ctx.font = `900 100px ${mainFont}`;
    const botW = Math.max(1, ctx.measureText(distText).width);
    let botSize = Math.floor(100 * (safeW / botW));
    if (!isFinite(botSize) || botSize > 400) botSize = 400; // Cap height

    ctx.font = `900 ${botSize}px ${mainFont}`;
    ctx.fillText(distText, cx, 1150);

    // 4. Sub-Metrics (Directly below distance)
    const subText = `${s2.value} ${s2.label}   /   ${s3.value} ${s3.label}`.toUpperCase();
    ctx.font = `900 36px ${mainFont}`;
    // Force sub-metrics to be white too, per instruction: "the letter should stay white"
    ctx.fillStyle = '#ffffff';
    if (typeof (ctx as any).letterSpacing !== 'undefined') (ctx as any).letterSpacing = "4px";
    ctx.fillText(subText, cx, 1220);
    if (typeof (ctx as any).letterSpacing !== 'undefined') (ctx as any).letterSpacing = "0px";

    ctx.restore();
}

export function drawScriptAndSerif(ctx: CanvasRenderingContext2D, stats: any, textColor: string) {
    const colors = getThemeColors(textColor);
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';

    const { s1, s2, hasMap } = getDynamicStats(stats);

    const cx = 540;
    const cy = 1000;
    const scriptFont = "'Great Vibes', cursive";

    ctx.save();
    // 1. Title (Large, Cursive, Sentence Case) - Shrink to fit logic
    let fontSize = 180;
    const maxTextWidth = 1000;
    ctx.font = `400 ${fontSize}px ${scriptFont}`;
    let textWidth = ctx.measureText(stats.title || "Activity").width;

    if (textWidth > maxTextWidth) {
        fontSize = Math.floor(fontSize * (maxTextWidth / textWidth));
        ctx.font = `400 ${fontSize}px ${scriptFont}`;
    }

    ctx.fillStyle = colors.solid;
    ctx.fillText(stats.title || "Activity", cx, cy - 420);

    // 2. Divider
    const lineY = cy - 80;
    ctx.strokeStyle = colors.trans;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(cx - 450, lineY - 140); ctx.lineTo(cx + 450, lineY - 140); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx - 450, lineY + 140); ctx.lineTo(cx + 450, lineY + 140); ctx.stroke();

    // 3. Stats Row (Using Unified Script Style)
    const drawStatUnder = (data, x) => {
        // Value (Cursive)
        ctx.font = `400 160px ${scriptFont}`;
        ctx.fillStyle = colors.solid;
        ctx.fillText(data.value, x, lineY);

        // Label (Cursive, smaller) - Increased visibility
        ctx.font = `400 70px ${scriptFont}`;
        ctx.fillStyle = colors.solid; // Use solid instead of label for better visibility
        ctx.globalAlpha = 1.0;
        // Move label significantly below the line
        ctx.fillText(data.label.toLowerCase(), x, lineY + 220);
    };

    drawStatUnder(s1, cx - 220);
    drawStatUnder(s2, cx + 220);

    // 4. Route (Bottom)
    if (hasMap) {
        drawRoutePath(ctx, stats.polyline, cx, cy + 520, 420, {
            color: colors.solid,
            strokeWidth: 3
        });
    }
    ctx.restore();
}

export function drawThinPath(ctx: CanvasRenderingContext2D, stats: any, textColor: string) {
    const colors = getThemeColors(textColor);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    const { s1, s2, s3, hasMap } = getDynamicStats(stats);

    const cx = 540;
    const startY = 220; // Push high up
    const mainFont = "'Syncopate', sans-serif";

    ctx.save();

    // 1. Map Backdrop (Thick)
    if (hasMap && stats.polyline) {
        ctx.globalAlpha = 0.4; // Fainter visibility for white map
        // Center the map at cy=350 so it sits perfectly behind the compressed text block
        drawRoutePath(ctx, stats.polyline, cx, 350, 850, {
            color: '#ffffff', // Remain white to not clash with colored text
            strokeWidth: 20 // Slightly thinner map stroke
        });
        ctx.globalAlpha = 1.0;
    }

    // 2. Header / Day Name (Reasonably sized)
    let titleFontSize = 36;
    ctx.font = `700 ${titleFontSize}px ${mainFont}`;
    ctx.fillStyle = textColor; // 1.0 opacity
    ctx.globalAlpha = 1.0;
    if (typeof (ctx as any).letterSpacing !== 'undefined') (ctx as any).letterSpacing = "6px";

    // Parse the day name from the raw date
    const dateStrRaw = stats.rawDate || '';
    const rawDate = dateStrRaw ? new Date(dateStrRaw.replace('Z', '')) : new Date();
    const dayName = new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(rawDate).toUpperCase();

    const titleText = dayName;

    // Scale down only if it exceeds 960px (activity name might be big but we cap it)
    let measuredTitleW = Math.max(1, ctx.measureText(titleText).width);
    while (measuredTitleW > 960 && titleFontSize > 15) {
        titleFontSize -= 2;
        ctx.font = `700 ${titleFontSize}px ${mainFont}`;
        measuredTitleW = ctx.measureText(titleText).width;
    }

    ctx.fillText(titleText, cx, startY);
    if (typeof (ctx as any).letterSpacing !== 'undefined') (ctx as any).letterSpacing = "0px";

    // 3. Hero Value (Maximized to 960px wide)
    const valText = String(s1.value);
    const unitText = String(s1.label);

    // Calculate scaling to perfectly fit 960px
    ctx.font = `700 100px ${mainFont}`;
    const baseW = Math.max(1, ctx.measureText(valText).width);

    ctx.font = `700 40px ${mainFont}`; // Unit is proportionally smaller
    const unitBaseW = Math.max(1, ctx.measureText(unitText).width);

    const gap = 20;
    const totalBaseW = baseW + gap + unitBaseW;

    const heroScale = 960 / totalBaseW;
    let vFontSize = Math.floor(100 * heroScale);
    let uFontSize = Math.floor(40 * heroScale);

    // Hard caps
    if (!isFinite(vFontSize) || vFontSize > 600) vFontSize = 600;
    if (!isFinite(uFontSize) || uFontSize > 240) uFontSize = 240;

    const heroY = startY + titleFontSize + 30; // Stack tightly

    // Recalculate true widths for centering
    ctx.font = `700 ${vFontSize}px ${mainFont}`;
    const finalValW = ctx.measureText(valText).width;
    ctx.font = `700 ${uFontSize}px ${mainFont}`;
    const finalUnitW = ctx.measureText(unitText).width;
    const finalTotalW = finalValW + gap + finalUnitW;

    // Draw Value
    const valStartX = cx - (finalTotalW / 2);
    ctx.textAlign = 'left';
    ctx.font = `700 ${vFontSize}px ${mainFont}`;
    ctx.fillStyle = textColor;
    ctx.fillText(valText, valStartX, heroY);

    // Draw Unit
    const unitStartX = valStartX + finalValW + gap;
    ctx.font = `700 ${uFontSize}px ${mainFont}`;
    // Align unit to bottom of the value visually
    ctx.textBaseline = 'alphabetic';
    // Visual baseline of Syncopate is roughly y + (size * 0.75)
    const baselineY = heroY + (vFontSize * 0.75);
    ctx.fillText(unitText, unitStartX, baselineY);

    // Reset baseline
    ctx.textBaseline = 'top';

    // 4. Footer Row (Compressed)
    const footY = heroY + (vFontSize * 0.8) + 20; // Tightly beneath hero

    // Minimum 36px rule
    ctx.font = `700 36px ${mainFont}`;
    ctx.textAlign = 'center';
    ctx.fillStyle = textColor;
    if (typeof (ctx as any).letterSpacing !== 'undefined') (ctx as any).letterSpacing = "2px";

    const footerText = `${s2.value} ${s2.label}   /   ${s3.value} ${s3.label}`;
    ctx.fillText(footerText.toUpperCase(), cx, footY);
    if (typeof (ctx as any).letterSpacing !== 'undefined') (ctx as any).letterSpacing = "0px";

    ctx.restore();
}

export function drawMicroSerif(ctx: CanvasRenderingContext2D, stats: any, textColor: string) {
    const { s1, s2, hasMap } = getDynamicStats(stats);
    const mainColor = textColor;

    // Lora for a premium, slightly softer serif aesthetic
    const serifFont = "'Lora', serif";
    const bottomY = 250;

    // Canvas is 1080 wide. 33% each = 360px per column
    // Column centers: 180, 540, 900
    ctx.save();

    // 1. Optional subtle shadow for premium readability
    ctx.shadowColor = 'rgba(0,0,0,0.4)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 2;

    // Use a fixed font size that guarantees 99.99 fits in 340px without dynamic scaling!
    // This ensures both Distance and Pace use the EXACT same font size, maintaining the editorial look.
    const valFontSize = 90;
    const unitFontSize = 36;
    const vFont = `normal 500 ${valFontSize}px ${serifFont}`;
    const uFont = `400 ${unitFontSize}px ${serifFont}`;

    const calcBlockWidth = (valText: string | number, unitText: string) => {
        ctx.font = vFont;
        const vW = Math.max(1, ctx.measureText(String(valText)).width);
        ctx.font = uFont;
        const uW = ctx.measureText(String(unitText)).width;
        return vW + 16 + uW; // 16px gap
    };

    // 2. Distance Block (Col 1: Center = 180)
    const distVal = String(s1.value);
    const distUnit = String(s1.label).toLowerCase();
    const b1W = calcBlockWidth(distVal, distUnit);
    const start1X = 180 - (b1W / 2);
    drawMetricBlock(ctx, start1X, bottomY, 'Distance', distVal, distUnit, {
        showLabel: false,
        labelFont: `400 32px ${serifFont}`,
        valueFont: vFont,
        unitFont: uFont,
        color: mainColor,
        unitGap: 16
    });

    // 3. Pace/Speed Block (Col 2: Center = 540)
    const paceUnit = s2.label === 'TIME' ? '' : (s2.label === 'BPM' ? 'bpm' : (s2.label === 'KM/H' ? 'km/h' : '/km'));
    const paceVal = String(s2.value);
    const b2W = calcBlockWidth(paceVal, paceUnit);
    const start2X = 540 - (b2W / 2);
    drawMetricBlock(ctx, start2X, bottomY, s2.label, paceVal, paceUnit, {
        showLabel: false,
        labelFont: `400 32px ${serifFont}`,
        valueFont: vFont,
        unitFont: uFont,
        color: mainColor,
        unitGap: 16
    });

    // 4. Map Route Block (Col 3: Center = 900)
    if (hasMap && stats.polyline) {
        ctx.save();
        ctx.globalAlpha = 0.9;
        // Center at 900 horizontally.
        // The text baseline is 250. Text height is ~90px, so vertical center is ~215.
        drawRoutePath(ctx, stats.polyline, 900, 215, 260, {
            color: mainColor,
            strokeWidth: 5
        });
        ctx.restore();
    }

    ctx.restore();
}

/**
 * Performance Bars Template
 * Adaptive rows of metrics + horizontal performance bars (Speed visualization)
 */
export function drawPerformanceBars(ctx: CanvasRenderingContext2D, stats: StickerStats, textColor: string) {
    const { solid, trans, label: colorLabel } = buildColors(textColor);
    const canvasH = 1080;
    const canvasW = 1080;
    const padding = 60;
    const interFont = "'Inter', sans-serif";

    ctx.save();

    // 1. Setup Defaults
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    // 2. Header (Kilometer | Pace) - Lowered to avoid logo overlap
    ctx.font = `900 24px ${interFont}`;
    ctx.fillStyle = trans;
    setLetterSpacing(ctx, '4px');
    ctx.fillText('KILOMETER', padding, 180);

    ctx.textAlign = 'right';
    ctx.fillText('PACE', canvasW - padding, 180);
    setLetterSpacing(ctx, '0px');

    // 3. Dynamic Splits List
    const splits = stats.splits || [];
    const lineCount = splits.length;

    // Adaptive Layout Logic
    let rowH = 80;
    let valSize = 48;
    let labSize = 28;
    let gap = 12;

    if (lineCount > 20) {
        rowH = 34;
        valSize = 24;
        labSize = 16;
        gap = 4;
    } else if (lineCount > 10) {
        rowH = 55;
        valSize = 36;
        labSize = 22;
        gap = 8;
    }

    const listStartY = 240;
    const fastestPace = stats.fastestPaceSeconds || 1;

    splits.forEach((split, i) => {
        const y = listStartY + i * (rowH + gap);
        const barTotalWidth = canvasW - (padding * 2);
        const barWidth = (fastestPace / split.seconds) * barTotalWidth;

        // Performance Bar Background (Full width)
        // Adjusting opacities for better contrast: 0.1 for bg, 0.4 for perf
        ctx.fillStyle = textColor === 'white' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)';
        ctx.fillRect(padding, y, barTotalWidth, rowH);

        // Performance Bar (Actual pace)
        ctx.fillStyle = textColor === 'white' ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.2)';

        if (split.type === 'partial') {
            ctx.strokeStyle = trans;
            ctx.lineWidth = 1;
            ctx.strokeRect(canvasW - padding - barWidth, y, barWidth, rowH);
        } else {
            ctx.fillRect(canvasW - padding - barWidth, y, barWidth, rowH);
        }

        // KM Label
        ctx.textAlign = 'left';
        ctx.fillStyle = trans;
        ctx.font = `700 ${labSize}px ${interFont}`;
        ctx.fillText(split.label, padding + 20, y + rowH / 2);

        // Pace Value
        ctx.textAlign = 'right';
        ctx.fillStyle = solid;
        ctx.font = `normal 900 ${valSize}px ${interFont}`;
        ctx.fillText(split.pace, canvasW - padding - 20, y + rowH / 2);
    });

    // 4. Summary Footer
    const footerY = 880;
    ctx.strokeStyle = trans;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(padding, footerY - 60);
    ctx.lineTo(canvasW - padding, footerY - 60);
    ctx.stroke();

    // Footer: Distance (KM)
    ctx.textAlign = 'left';
    ctx.fillStyle = trans;
    ctx.font = `900 22px ${interFont}`;
    setLetterSpacing(ctx, '4px');
    ctx.fillText('KM', padding, footerY - 10);
    setLetterSpacing(ctx, '0px');

    ctx.fillStyle = solid;
    ctx.font = `normal 900 120px ${interFont}`;
    ctx.fillText(stats.distanceVal || '0.0', padding, footerY + 60);

    // Footer: Avg Pace
    ctx.textAlign = 'right';
    ctx.fillStyle = trans;
    ctx.font = `900 22px ${interFont}`;
    setLetterSpacing(ctx, '4px');
    ctx.fillText('PACE', canvasW - padding, footerY - 10);
    setLetterSpacing(ctx, '0px');

    ctx.fillStyle = solid;
    ctx.font = `normal 900 120px ${interFont}`;
    const paceVal = stats.subValue.split(' ')[0];
    ctx.fillText(paceVal, canvasW - padding, footerY + 60);

    // Pace Unit (/km)
    ctx.font = `400 32px ${interFont}`;
    ctx.fillStyle = trans;
    ctx.fillText('/km', canvasW - padding, footerY + 60 + 40);

    // Footer: Time & Attribution
    const bottomRowY = 1000;
    ctx.textAlign = 'left';
    ctx.fillStyle = trans;
    ctx.font = `900 18px ${interFont}`;
    setLetterSpacing(ctx, '4px');
    ctx.fillText('TIME', padding, bottomRowY);
    setLetterSpacing(ctx, '0px');

    ctx.textAlign = 'right';
    ctx.font = `300 68px ${interFont}`;
    ctx.fillStyle = solid;
    ctx.fillText(stats.timeStr, canvasW - padding, bottomRowY + 10);

    // Attribution (Garmin etc)
    if (stats.deviceName) {
        ctx.textAlign = 'center';
        ctx.fillStyle = colorLabel;
        ctx.font = `400 16px ${interFont}`;
        ctx.fillText(stats.deviceName.toUpperCase(), canvasW / 2, 1050);
    }

    ctx.restore();
}

// ─── AI Mockup Translations ───────────────────────────────────────────────────

export function drawLocationPill(ctx: CanvasRenderingContext2D, stats: any, textColor = 'white') {
    ctx.textBaseline = 'alphabetic';

    // Get location
    let loc = stats.dataPoints?.find((p: any) => p.label === 'Location')?.value;
    if (!loc || loc === '-') {
        loc = '';
    }

    const durParts = parseDurationParts(stats.mainValue || '');
    const sGap = 8;

    // Measure total width
    const iconW = 40;
    const gap = 15;
    const paddingX = 50;

    ctx.font = "600 45px 'Plus Jakarta Sans'";
    const locText = loc + (durParts.length > 0 && loc ? ',' : '');
    const locW = locText ? ctx.measureText(locText).width : 0;

    let statsW = 0;
    durParts.forEach((p, i) => {
        ctx.font = "900 55px 'Plus Jakarta Sans'";
        const vW = ctx.measureText(p.val).width;
        ctx.font = "900 28px 'Plus Jakarta Sans'";
        const uW = p.unit ? ctx.measureText(p.unit).width : 0;
        statsW += vW + (p.unit ? sGap + uW : 0) + (i < durParts.length - 1 ? sGap * 2 : 0);
    });

    const totalW = (loc ? iconW + gap + locW : 0) + (statsW ? (loc ? gap : 0) + statsW : 0);
    const pillW = totalW + (paddingX * 2);
    const pillH = 120;

    const startX = 540 - (pillW / 2);
    const startY = 300 - (pillH / 2);

    // ... (Background draw unchanged)
    const isDarkText = textColor === 'black' || (textColor.startsWith('#') && isColorDark(textColor));
    const isDark = !isDarkText;
    const bgFill = isDark ? 'rgba(20, 20, 22, 0.95)' : 'rgba(255, 255, 255, 0.95)';
    const shadowC = isDark ? 'rgba(0, 0, 0, 0.6)' : 'rgba(0, 0, 0, 0.2)';
    const mainFill = textColor.startsWith('#') ? textColor : (isDark ? '#ffffff' : '#000000');
    const unitFill = isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.4)';
    const dotFill = isDark ? '#000000' : '#ffffff';

    ctx.fillStyle = bgFill;
    ctx.shadowColor = shadowC;
    ctx.shadowBlur = 30;
    ctx.shadowOffsetY = 10;
    ctx.beginPath();
    ctx.roundRect(startX, startY, pillW, pillH, 60);
    ctx.fill();
    ctx.shadowColor = 'transparent';

    let currentX = startX + paddingX;

    if (loc) {
        ctx.save();
        // The icon's visual center is X=12, Y=12. Scaled by 1.7, that's 20.4.
        // For iconW=40, X translation should be currentX + 20 - 20.4 = currentX.
        // For pill center at startY + 60, Y translation should be startY + 60 - 20.4 = startY + 40.
        ctx.translate(currentX, startY + 40);
        ctx.scale(1.7, 1.7);
        ctx.fillStyle = mainFill;
        const pinPath = new Path2D('M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z');
        ctx.fill(pinPath);
        ctx.fillStyle = dotFill;
        ctx.beginPath(); ctx.arc(12, 10, 3, 0, Math.PI * 2); ctx.fill();
        ctx.restore();

        currentX += iconW + gap;
        ctx.fillStyle = mainFill;
        ctx.font = "600 45px 'Plus Jakarta Sans'";
        ctx.fillText(locText, currentX, startY + 75);
        currentX += locW + gap;
    }

    if (durParts.length > 0) {
        drawDurationSequence(ctx, currentX, startY + 75, durParts, {
            valFont: "900 55px 'Plus Jakarta Sans'",
            unitFont: "900 28px 'Plus Jakarta Sans'",
            valColor: mainFill,
            unitColor: unitFill,
            gap: sGap * 2,
            unitGap: sGap
        });
    }
}
function drawSprayPath(ctx: CanvasRenderingContext2D, coords: [number, number][], getXY: (p: [number, number]) => { x: number, y: number }, color: string) {
    if (!coords || coords.length === 0) return;

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = color;

    // 1. UNDERGLOW (Large, soft spray area)
    ctx.shadowColor = color;
    ctx.shadowBlur = 45;
    ctx.lineWidth = 35;
    ctx.globalAlpha = 0.3;
    ctx.beginPath();
    coords.forEach((p, i) => {
        const { x, y } = getXY(p);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // 2. MAIN BODY (Stronger center)
    ctx.shadowBlur = 15;
    ctx.lineWidth = 22;
    ctx.globalAlpha = 0.6;
    ctx.stroke();

    // 3. CORE (Solid center with jitter)
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 0.9;
    [12, 6].forEach((w, pass) => {
        ctx.lineWidth = w;
        ctx.beginPath();
        coords.forEach((p, i) => {
            const { x, y } = getXY(p);
            const jitter = pass === 0 ? 4 : 2;
            const jX = x + Math.sin(i * 0.8 + pass) * jitter;
            const jY = y + Math.cos(i * 0.7 - pass) * jitter;
            if (i === 0) ctx.moveTo(jX, jY); else ctx.lineTo(jX, jY);
        });
        ctx.stroke();
    });

    // 4. SPLATTER (Spray particles)
    ctx.fillStyle = color;
    coords.forEach((p, i) => {
        if (i % 8 === 0) { // Every few points
            const { x, y } = getXY(p);
            const particles = 4;
            for (let j = 0; j < particles; j++) {
                const angle = (i + j) * 137.5; // Golden angle for distribution
                const dist = 10 + (i * j % 25);
                const px = x + Math.cos(angle) * dist;
                const py = y + Math.sin(angle) * dist;
                const size = 1 + (i % 3);
                ctx.globalAlpha = 0.2 + (j * 0.1);
                ctx.beginPath();
                ctx.arc(px, py, size, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    });

    // 5. DRIPS (Paint gravity)
    ctx.globalAlpha = 0.7;
    coords.forEach((p, i) => {
        // Create drips on local peaks or every 60 points
        if (i > 0 && i < coords.length - 1 && i % 80 === 0) {
            const { x, y } = getXY(p);
            const dripLen = 30 + (i % 80);
            const dripWidth = 6 + (i % 4);

            ctx.lineWidth = dripWidth;
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x, y + dripLen);
            ctx.stroke();

            // Drip head (bulb)
            ctx.beginPath();
            ctx.arc(x, y + dripLen, dripWidth * 0.8, 0, Math.PI * 2);
            ctx.fill();
        }
    });

    ctx.restore();
}

export function drawPureMap(ctx: CanvasRenderingContext2D, stats: any, textColor = 'white') {
    if (!stats.polyline) return;

    const lineColor = textColor.startsWith('#') ? textColor : (textColor === 'black' ? '#000000' : '#ffffff');
    const coords = decodePolyline(stats.polyline);
    if (!coords || coords.length === 0) return;

    const mapBox = { x: 140, y: 560, w: 800, h: 800 };

    let minLat = coords[0][0], maxLat = minLat, minLng = coords[0][1], maxLng = minLng;
    coords.forEach((p: any) => {
        if (p[0] < minLat) minLat = p[0]; if (p[0] > maxLat) maxLat = p[0];
        if (p[1] < minLng) minLng = p[1]; if (p[1] > maxLng) maxLng = p[1];
    });

    const scale = Math.min(mapBox.w / (maxLng - minLng), mapBox.h / (maxLat - minLat));

    const getXY = (p: [number, number]) => {
        const x = mapBox.x + (p[1] - minLng) * scale + (mapBox.w - ((maxLng - minLng) * scale)) / 2;
        const y = mapBox.y + mapBox.h - ((p[0] - minLat) * scale) - (mapBox.h - ((maxLat - minLat) * scale)) / 2;
        return { x: x, y: y };
    };

    ctx.save();
    ctx.globalAlpha = 0.8;
    drawSprayPath(ctx, coords, getXY, lineColor);
    ctx.restore();
}



export function drawProVertical(ctx: CanvasRenderingContext2D, stats: any, textColor = 'white') {
    const c = buildColors(textColor);

    const boxX = 80;
    const boxY = 1380;
    const boxW = 920;
    const boxH = 360;

    ctx.save();
    applyAntiGhostingShadow(ctx, textColor);

    // 1. Sleek glassmorphic card backdrop
    ctx.strokeStyle = textColor === 'black' ? 'rgba(0, 0, 0, 0.12)' : 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 2;
    ctx.fillStyle = textColor === 'black' ? 'rgba(255, 255, 255, 0.8)' : 'rgba(28, 28, 30, 0.7)';
    ctx.beginPath();
    ctx.roundRect(boxX, boxY, boxW, boxH, 20);
    ctx.fill();
    ctx.stroke();

    // 2. Accent Bar on the Left (inside card)
    ctx.fillStyle = c.accent;
    ctx.beginPath();
    ctx.roundRect(boxX + 30, boxY + 40, 14, boxH - 80, 7);
    ctx.fill();

    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    // 3. Main Value & Unit
    const isWorkout = stats.type?.toLowerCase().includes('workout') || stats.type?.toLowerCase().includes('training') || stats.type?.toLowerCase().includes('gym') || !stats.hasDistance;
    const mainVal = (isWorkout ? (stats.timeStr || '0:00') : (stats.distanceVal || '0.00')).toUpperCase();
    const mainUnit = isWorkout ? 'DURATION' : 'KM';

    const valX = boxX + 70;
    const valY = boxY + 130;

    ctx.font = "normal 900 130px 'Plus Jakarta Sans'";
    ctx.fillStyle = textColor;
    ctx.fillText(mainVal, valX, valY);

    const valW = ctx.measureText(mainVal).width;

    ctx.font = "800 36px 'Plus Jakarta Sans'";
    ctx.fillStyle = c.accent;
    ctx.fillText(mainUnit, valX + valW + 20, valY + 30);

    // 4. Metadata Line (Time, Pace, HR, Location)
    const isRide = stats.type === 'Ride' || stats.type === 'EBikeRide';
    const paceLabel = isWorkout ? "HEART RATE" : (isRide ? "AVG SPEED" : "PACE");
    const paceVal = isWorkout ? (stats.avgHeartrate ? `${stats.avgHeartrate} BPM` : 'WORKOUT') : (stats.subValue || '0:00 /KM').toUpperCase();

    const subString = `${paceLabel}: ${paceVal}   ·   ${(stats.startTime || '00:00 AM').toUpperCase()}   ·   ${(stats.location || 'OUTDOORS').toUpperCase()}`;
    ctx.font = "800 20px 'Plus Jakarta Sans'";
    ctx.fillStyle = textColor;
    ctx.globalAlpha = 0.8;
    setLetterSpacing(ctx, "3px");
    ctx.fillText(subString, valX, boxY + 270);
    setLetterSpacing(ctx, "0px");

    ctx.restore();
}

// ─── SCORA 20 COLLECTION ────────────────────────────────────────────────────────

export function drawMassiveSerif(ctx: CanvasRenderingContext2D, stats: any, textColor = 'white') {
    const isDarkText = textColor === 'black' || (textColor.startsWith('#') && isColorDark(textColor));
    const isDark = !isDarkText;
    const cSolid = isDark ? '#ffffff' : '#000000';

    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'center';

    const rawVal = stats.mainValue || stats.distanceVal || '0.00';
    const isDuration = String(rawVal).includes('h') || String(rawVal).includes('m');

    ctx.shadowColor = 'rgba(0,0,0,0.2)';
    ctx.shadowBlur = 40;
    ctx.shadowOffsetY = 20;

    ctx.globalAlpha = 0.9;
    ctx.fillStyle = cSolid;

    const cx = 540;
    const cy = 960;

    if (isDuration) {
        const displayVal = String(rawVal).trim();
        let fontSize = 320;
        ctx.font = `normal 900 ${fontSize}px 'Playfair Display'`;

        // Auto-scale
        while (ctx.measureText(displayVal).width > 900 && fontSize > 150) {
            fontSize -= 20;
            ctx.font = `normal 900 ${fontSize}px 'Playfair Display'`;
        }

        if ((ctx as any).letterSpacing !== undefined) { (ctx as any).letterSpacing = "-0.05em"; }
        ctx.fillText(displayVal, cx, cy + 40);
    } else {
        // From React #01: Value is massive, unit is far below and spaced out
        const mainVal = String(rawVal).replace(/[a-zA-Z]/g, '').trim();
        const mainUnit = (String(rawVal).replace(/[0-9.]/g, '').trim() || 'km').toUpperCase();

        let fontSize = 520;
        ctx.font = `normal 900 ${fontSize}px 'Playfair Display'`;

        // Auto-scale
        while (ctx.measureText(mainVal).width > 920 && fontSize > 200) {
            fontSize -= 40;
            ctx.font = `normal 900 ${fontSize}px 'Playfair Display'`;
        }

        if ((ctx as any).letterSpacing !== undefined) { (ctx as any).letterSpacing = "-0.08em"; }
        ctx.fillText(mainVal, cx, cy + 80);

        ctx.shadowColor = 'transparent';
        if ((ctx as any).letterSpacing !== undefined) { (ctx as any).letterSpacing = "0px"; }

        ctx.globalAlpha = 0.4;
        ctx.font = "900 32px 'Plus Jakarta Sans'";
        if ((ctx as any).letterSpacing !== undefined) { (ctx as any).letterSpacing = "1em"; }
        ctx.fillText(mainUnit, cx, cy + 180);
    }

    ctx.globalAlpha = 1.0;
    if ((ctx as any).letterSpacing !== undefined) { (ctx as any).letterSpacing = "0px"; }
}

export function drawDualPill(ctx: CanvasRenderingContext2D, stats: any, textColor = 'white') {
    ctx.textBaseline = 'alphabetic';

    let loc = stats.dataPoints?.find((p: any) => p.label === 'Location')?.value;
    if (!loc || loc === '-') loc = 'LOCATION';

    const rawVal = stats.mainValue || stats.distanceVal || '0.00';
    const isDuration = String(rawVal).includes('h') || String(rawVal).includes('m');

    let mainVal, mainUnit;
    if (isDuration) {
        mainVal = String(rawVal).trim();
        mainUnit = '';
    } else {
        const durParts = parseDurationParts(stats.mainValue || '');
        mainVal = durParts.length > 0 ? durParts.map(p => p.val).join(' ') : (stats.distanceVal || '0.00');
        mainUnit = durParts.length > 0 ? durParts.map(p => p.unit).join(' ') : 'km';
    }

    // Measure text
    ctx.font = "900 28px 'Plus Jakarta Sans'";
    const locW = ctx.measureText(loc.toUpperCase()).width;

    ctx.font = "normal 900 40px 'Plus Jakarta Sans'";
    const valW = ctx.measureText(mainVal).width;

    ctx.font = "800 24px 'Plus Jakarta Sans'";
    const unitW = mainUnit ? ctx.measureText(mainUnit.toUpperCase()).width : 0;

    const iconW = 30;
    const gap = 15;
    const paddingX = 40;

    const darkPillW = iconW + gap + locW + (paddingX * 2);
    const lightPillW = valW + (mainUnit ? gap + unitW : 0) + (paddingX * 2);

    const totalW = darkPillW + lightPillW;
    const pillH = 100;
    const startX = 540 - (totalW / 2);
    const startY = 960 - (pillH / 2);

    // Global shadow
    ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
    ctx.shadowBlur = 30;
    ctx.shadowOffsetY = 10;

    // Draw Dark Pill
    const isDarkText = textColor === 'black' || (textColor.startsWith('#') && isColorDark(textColor));
    const isDark = !isDarkText;
    const bg1 = isDark ? 'rgba(0,0,0,0.95)' : 'rgba(255,255,255,0.95)';
    const fg1 = isDark ? '#ffffff' : '#000000';

    const bg2 = isDark ? 'rgba(255,255,255,0.95)' : 'rgba(0,0,0,0.95)';
    const fg2 = isDark ? '#000000' : '#ffffff';

    ctx.fillStyle = bg1;
    ctx.beginPath();
    ctx.roundRect(startX, startY, darkPillW + 40, pillH, 50); // overshoot right side
    ctx.fill();

    // Map pin
    ctx.save();
    ctx.translate(startX + paddingX, startY + 28);
    ctx.scale(1.3, 1.3);
    ctx.fillStyle = fg1;
    ctx.fill(new Path2D('M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z'));
    ctx.restore();

    ctx.fillStyle = fg1;
    ctx.font = "900 28px 'Plus Jakarta Sans'";
    if ((ctx as any).letterSpacing !== undefined) { (ctx as any).letterSpacing = "0.2em"; }
    ctx.fillText(loc.toUpperCase(), startX + paddingX + iconW + gap, startY + 62);
    if ((ctx as any).letterSpacing !== undefined) { (ctx as any).letterSpacing = "0px"; }

    // Draw Light Pill
    ctx.fillStyle = bg2;
    ctx.beginPath();
    ctx.roundRect(startX + darkPillW - 30, startY, lightPillW + 30, pillH, 50);
    ctx.fill();

    ctx.shadowColor = 'transparent';

    let currentX = startX + darkPillW + paddingX - 10;
    ctx.fillStyle = fg2;
    ctx.font = "normal 900 40px 'Plus Jakarta Sans'";
    ctx.fillText(mainVal, currentX, startY + 62);

    if (mainUnit) {
        currentX += valW + 8;
        ctx.font = "800 24px 'Plus Jakarta Sans'";
        ctx.fillText(mainUnit.toUpperCase(), currentX, startY + 62);
    }
}

export function drawStatement(ctx: CanvasRenderingContext2D, stats: any, textColor = 'white') {
    const isDarkText = textColor === 'black' || (textColor.startsWith('#') && isColorDark(textColor));
    const isDark = !isDarkText;
    const cSolid = isDark ? '#ffffff' : '#000000';

    const rawVal = stats.mainValue || stats.distanceVal || '0.00';
    let loc = stats.dataPoints?.find((p: any) => p.label === 'Location')?.value;
    if (!loc || loc === '-') loc = 'the city';

    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';

    // Header
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = cSolid;
    ctx.font = "900 24px 'Plus Jakarta Sans'";
    if ((ctx as any).letterSpacing !== undefined) { (ctx as any).letterSpacing = "0.5em"; }
    ctx.fillText("REPORT", 100, 1400);
    if ((ctx as any).letterSpacing !== undefined) { (ctx as any).letterSpacing = "0px"; }

    // Sentence wrapping
    ctx.globalAlpha = 0.9;
    ctx.font = "normal 500 70px 'EB Garamond'";

    const distStr = String(rawVal).trim();

    let dateStr = (stats.dayAndNumber || 'Date')
        .split(' ')
        .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(' ');
    const titleStr = stats.title || 'Workout';
    const sentence = `Completed ${distStr} - ${loc} - ${dateStr} - ${titleStr}`;
    const words = sentence.split(' ');
    let line = '';
    let currY = 1500;
    const maxWidth = 880;

    for (let i = 0; i < words.length; i++) {
        const testLine = line + words[i] + ' ';
        const metrics = ctx.measureText(testLine);
        if (metrics.width > maxWidth && i > 0) {
            ctx.fillText(line, 100, currY);
            line = words[i] + ' ';
            currY += 80;
        } else {
            line = testLine;
        }
    }
    ctx.fillText(line, 100, currY);
    ctx.globalAlpha = 1.0;
}


export function drawBrutalistLetters(ctx: CanvasRenderingContext2D, stats: any, textColor = 'white') {
    const { solid, trans, label: labelColor, accent: accentColor } = buildColors(textColor);
    const isDarkAccent = isColorDark(accentColor);

    const rawVal = stats.mainValue || stats.distanceVal || '0.00';
    const displayVal = String(rawVal).trim().toUpperCase();

    let type = stats.type || stats.activityType || 'Run';
    const baseActivity = normalizeSport(type);
    type = applyActivityCasing(baseActivity, 'brutalist-letters').toUpperCase();

    const cx = 540;
    const cy = 1680;

    ctx.save();
    applyAntiGhostingShadow(ctx, textColor);

    // 1. Giant Background Type (Swiss Poster Style)
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = textColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    let fontSize = 240;
    ctx.font = `900 ${fontSize}px 'Plus Jakarta Sans'`;
    if ((ctx as any).letterSpacing !== undefined) { (ctx as any).letterSpacing = "-0.05em"; }
    let textWidth = ctx.measureText(type).width;
    const maxW = 980;

    if (textWidth > maxW) {
        fontSize = Math.floor(fontSize * (maxW / textWidth));
        ctx.font = `900 ${fontSize}px 'Plus Jakarta Sans'`;
    }

    ctx.fillText(type, cx, cy - 40);
    if ((ctx as any).letterSpacing !== undefined) { (ctx as any).letterSpacing = "0px"; }
    ctx.globalAlpha = 1.0;

    // 2. Foreground Solid Accent Box for Value
    ctx.font = "normal 900 68px 'Plus Jakarta Sans'";
    if ((ctx as any).letterSpacing !== undefined) { (ctx as any).letterSpacing = "-0.05em"; }
    const txtW = ctx.measureText(displayVal).width;
    const txtH = 96;

    ctx.fillStyle = accentColor;
    ctx.fillRect(cx - (txtW / 2) - 30, cy + 30, txtW + 60, txtH);

    // Text on accent box
    ctx.fillStyle = isDarkAccent ? '#ffffff' : '#111111';
    ctx.fillText(displayVal, cx, cy + 30 + txtH / 2);
    if ((ctx as any).letterSpacing !== undefined) { (ctx as any).letterSpacing = "0px"; }

    ctx.restore();
}

export function drawTinyGPS(ctx: CanvasRenderingContext2D, stats: any, textColor = 'white') {
    const isDarkText = textColor === 'black' || (textColor.startsWith('#') && isColorDark(textColor));
    const isDark = !isDarkText;
    const cSolid = textColor.startsWith('#') ? textColor : (textColor === 'black' ? '#000000' : '#ffffff');

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    let loc = stats.dataPoints?.find((p: any) => p.label === 'Location')?.value;
    if (!loc || loc === '-') loc = 'LOCATION';

    const rawVal = stats.mainValue || stats.distanceVal || '0.00';
    const displayVal = String(rawVal).trim();

    // Mock GPS coords or real
    let coordStr = "19.4326° N, 99.1332° W";
    if (stats.polyline) {
        const coords = decodePolyline(stats.polyline);
        if (coords.length > 0) {
            const lat = coords[0][0];
            const lng = coords[0][1];
            coordStr = `${Math.abs(lat).toFixed(4)}° ${lat >= 0 ? 'N' : 'S'}, ${Math.abs(lng).toFixed(4)}° ${lng >= 0 ? 'E' : 'W'}`;
        }
    }

    // High Density Cinematic Look
    ctx.globalAlpha = 0.9; // Requested 90%
    ctx.fillStyle = cSolid;

    // Coords (Cinzel 400 - Larger)
    ctx.font = "400 42px 'Cinzel'";
    if ((ctx as any).letterSpacing !== undefined) { (ctx as any).letterSpacing = "0.4em"; }
    ctx.fillText(coordStr.toUpperCase(), 540, 350);
    if ((ctx as any).letterSpacing !== undefined) { (ctx as any).letterSpacing = "0px"; }

    // Tiny Accent Line
    ctx.globalAlpha = 0.3;
    ctx.fillRect(440, 400, 200, 2);

    // Primary Metadata (Cinzel 900 - Massive Readability)
    ctx.globalAlpha = 0.9;
    const baseSize = 52; // Reduced from 75px
    const fullText = `${loc.toUpperCase()} · ${displayVal}`;
    ctx.font = `900 ${baseSize}px 'Cinzel'`;

    // Smart Shrink if it overflows 800px width
    let fontSize = baseSize;
    const maxW = 900;
    let textW = ctx.measureText(fullText).width;
    if (textW > maxW) {
        fontSize = Math.floor(baseSize * (maxW / textW));
        ctx.font = `900 ${fontSize}px 'Cinzel'`;
    }

    if ((ctx as any).letterSpacing !== undefined) { (ctx as any).letterSpacing = "0.05em"; }
    ctx.fillText(fullText, 540, 465);
    if ((ctx as any).letterSpacing !== undefined) { (ctx as any).letterSpacing = "0px"; }
}

export function drawMagCover(ctx: CanvasRenderingContext2D, stats: any, textColor = 'white') {
    const isDarkText = textColor === 'black' || (textColor.startsWith('#') && isColorDark(textColor));
    const isDark = !isDarkText;
    const cSolid = isDark ? '#ffffff' : '#000000';

    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    const paddingX = 100;
    const startY = 800;

    // Date Header Border
    ctx.fillStyle = cSolid;
    ctx.globalAlpha = 0.2;
    ctx.fillRect(paddingX, startY + 40, 1080 - paddingX * 2, 2);

    // Date
    ctx.globalAlpha = 0.5;
    ctx.textAlign = 'right';
    ctx.font = "900 24px 'Plus Jakarta Sans'";
    if ((ctx as any).letterSpacing !== undefined) { (ctx as any).letterSpacing = "0.3em"; }
    ctx.fillText(stats.dayAndNumber || 'DATE', 1080 - paddingX, startY);
    if ((ctx as any).letterSpacing !== undefined) { (ctx as any).letterSpacing = "0px"; }

    // Massive Title
    ctx.globalAlpha = 1.0;
    ctx.textAlign = 'left';

    const titleChunks = (stats.title || 'Workout').toUpperCase().split(' ');
    ctx.font = "normal 900 160px 'Playfair Display'";
    if ((ctx as any).letterSpacing !== undefined) { (ctx as any).letterSpacing = "-0.05em"; }

    let currentY = startY + 70;
    titleChunks.forEach(chunk => {
        ctx.fillText(chunk, paddingX, currentY);
        currentY += 150;
    });
    if ((ctx as any).letterSpacing !== undefined) { (ctx as any).letterSpacing = "0px"; }
}


export function drawPulseRow(ctx: CanvasRenderingContext2D, stats: any, textColor = 'white') {
    // Hidden if no HR
    if (!stats.avgHeartrate && !stats.maxHeartrate) return;
    const hr = stats.maxHeartrate || stats.avgHeartrate || '-';

    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    const hrText = `${hr} BPM`;
    ctx.font = "900 40px 'Plus Jakarta Sans'";
    const textW = ctx.measureText(hrText).width;

    const pillH = 90;
    const iconW = 40;
    const paddingX = 40;
    const gap = 25;
    const totalW = iconW + gap + textW + (paddingX * 2);

    const startX = 540 - (totalW / 2);
    const startY = 960 - (pillH / 2);

    // Red Pill
    ctx.shadowColor = 'rgba(220, 38, 38, 0.4)';
    ctx.shadowBlur = 30;
    ctx.shadowOffsetY = 10;

    ctx.fillStyle = '#dc2626'; // red-600
    ctx.beginPath();
    ctx.roundRect(startX, startY, totalW, pillH, 45);
    ctx.fill();

    ctx.shadowColor = 'transparent';

    let cx = startX + paddingX;

    // Heart Icon
    ctx.save();
    ctx.translate(cx, startY + 25);
    ctx.scale(1.7, 1.7);
    ctx.fillStyle = '#ffffff';
    // exact SVG path for Lucide Heart
    ctx.fill(new Path2D('M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z'));
    ctx.restore();

    cx += iconW + gap / 2;

    // Divider
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.fillRect(cx, startY + 25, 2, 40);

    cx += gap / 2 + 10;

    // BPM Text
    ctx.fillStyle = '#ffffff';
    ctx.fillText(hrText, cx, startY + 45 + 5);
}

export function drawBoxedMetric(ctx: CanvasRenderingContext2D, stats: any, textColor = 'white') {
    const isDarkText = textColor === 'black' || (textColor.startsWith('#') && isColorDark(textColor));
    const isDark = !isDarkText;
    const bgFill = isDark ? 'rgba(0,0,0,0.8)' : 'rgba(255,255,255,0.95)';
    const fgFill = isDark ? '#ffffff' : '#000000';
    const borderColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';

    const rawVal = stats.mainValue || stats.distanceVal || '0.00';
    const displayVal = String(rawVal).trim();

    const chars = displayVal.replace(/\s+/g, '').split('');
    const boxW = 80;
    const boxH = 120;
    const gap = 10;
    const totalW = (chars.length * boxW) + ((chars.length - 1) * gap);

    let currentX = 540 - (totalW / 2);
    const startY = 960 - (boxH / 2);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = "normal 900 65px 'Plus Jakarta Sans'";

    ctx.shadowColor = 'rgba(0,0,0,0.1)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 5;

    chars.forEach(char => {
        ctx.fillStyle = bgFill;
        ctx.beginPath();
        ctx.fillRect(currentX, startY, boxW, boxH);

        ctx.strokeStyle = borderColor;
        ctx.lineWidth = 2;
        ctx.strokeRect(currentX, startY, boxW, boxH);

        ctx.fillStyle = fgFill;
        ctx.shadowColor = 'transparent';
        ctx.fillText(char, currentX + boxW / 2, startY + boxH / 2 + 5);

        currentX += boxW + gap;
    });
}

export function drawStepMaster(ctx: CanvasRenderingContext2D, stats: any, textColor = 'white') {
    const isDarkText = textColor === 'black' || (textColor.startsWith('#') && isColorDark(textColor));
    const isDark = !isDarkText;
    const bgOuter = isDark ? '#ffffff' : '#000000';
    const fgOuter = isDark ? '#000000' : '#ffffff';
    const bgInner = isDark ? '#000000' : '#ffffff';
    const fgInner = isDark ? '#ffffff' : '#000000';

    const hasDistance = stats.hasDistance || (stats.distanceVal && parseFloat(stats.distanceVal) > 0);
    const activityType = stats.type || (hasDistance ? 'Run' : 'Workout');

    // Values based on category
    let valStr, subStr;
    if (activityType.toLowerCase().includes('train') || activityType.toLowerCase().includes('gym') || activityType.toLowerCase().includes('workout')) {
        valStr = stats.timeStr || '0:00';
        subStr = 'DURATION';
    } else {
        valStr = stats.distanceVal || '0.00';
        subStr = 'KM TOTAL';
    }

    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';

    // Measure dynamically
    ctx.font = "900 72px 'Plus Jakarta Sans'";
    const valW = ctx.measureText(valStr).width;
    ctx.font = "800 22px 'Plus Jakarta Sans'";
    const subW = ctx.measureText(subStr).width;

    const pillH = 120; // Pro Slim
    const iconBoxSize = 90; // Balanced circle
    const padding = 15;
    const gap = 30;
    const totalW = padding + iconBoxSize + gap + Math.max(valW, subW) + padding + 30;

    const cx = 540;
    const cy = 960;
    const startX = cx - totalW / 2;
    const startY = cy - pillH / 2;

    // 1. Main Pill
    ctx.fillStyle = bgOuter;
    ctx.beginPath();
    ctx.roundRect(startX, startY, totalW, pillH, pillH / 2);
    ctx.fill();

    // 2. Icon Box (Circle)
    ctx.fillStyle = bgInner;
    ctx.beginPath();
    const boxY = startY + (pillH - iconBoxSize) / 2;
    ctx.roundRect(startX + padding, boxY, iconBoxSize, iconBoxSize, iconBoxSize / 2);
    ctx.fill();

    // 3. Activity Icon (Centered in circle)
    const iconSize = 50;
    ctx.save();
    ctx.translate(
        startX + padding + (iconBoxSize - iconSize) / 2,
        boxY + (iconBoxSize - iconSize) / 2
    );
    drawScoraActivityIcon(ctx, activityType, iconSize, fgInner, 0, 0);
    ctx.restore();

    // 4. Text
    ctx.fillStyle = fgOuter;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    const textX = startX + padding + iconBoxSize + gap;

    // Value text
    ctx.font = "900 74px 'Plus Jakarta Sans'";
    ctx.fillText(valStr, textX, startY + 45);

    // Sub text
    ctx.globalAlpha = 0.45;
    ctx.font = "800 22px 'Plus Jakarta Sans'";
    if ((ctx as any).letterSpacing !== undefined) { (ctx as any).letterSpacing = "0.25em"; }
    ctx.fillText(subStr, textX, startY + 84);
    if ((ctx as any).letterSpacing !== undefined) { (ctx as any).letterSpacing = "0px"; }
    ctx.globalAlpha = 1.0;
}


export function drawSocialFloat(ctx: CanvasRenderingContext2D, stats: any, textColor = 'white') {
    const isDarkText = textColor === 'black' || (textColor.startsWith('#') && isColorDark(textColor));
    const isDark = !isDarkText;
    const mainPillBg = 'rgba(50, 50, 50, 0.85)';
    const cyan = '#22d3ee';
    const darkPillBg = 'rgba(20, 20, 20, 0.6)';

    const rawVal = stats.mainValue || stats.distanceVal || '0.00';
    const valClean = String(rawVal).toLowerCase().replace(/km|m/g, '').trim();
    const mainText = `${valClean} ${stats.hasDistance ? 'km' : 'm'}`;
    const paceText = `${stats.subValue || '0:00'} /KM`;
    const dateText = (stats.dateShort || 'MAR 04').toUpperCase();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const cx = 540;
    const cy = 960;

    // 1. Main Pill
    ctx.font = "normal 900 85px 'Plus Jakarta Sans'";
    const mainW = ctx.measureText(mainText).width;
    const pillW = mainW + 160;
    const pillH = 180;

    ctx.fillStyle = mainPillBg;
    ctx.beginPath();
    ctx.roundRect(cx - pillW / 2, cy - pillH / 2, pillW, pillH, 90);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.fillText(mainText, cx, cy);

    // 2. Bottom Left Pill (Pace)
    ctx.font = "900 30px 'Plus Jakarta Sans'";
    const paceW = ctx.measureText(paceText).width;
    const pPillW = paceW + 60;
    const pPillH = 70;
    const px = cx - pillW / 2 + 30;
    const py = cy + pillH / 2 - 10;

    ctx.fillStyle = cyan;
    ctx.beginPath();
    ctx.roundRect(px, py - pPillH / 2, pPillW, pPillH, 35);
    ctx.fill();

    ctx.fillStyle = '#000000';
    ctx.fillText(paceText, px + pPillW / 2, py);

    // 3. Top Right Pill (Date)
    ctx.font = "900 24px 'Plus Jakarta Sans'";
    const dateW = ctx.measureText(dateText).width;
    const dPillW = dateW + 50;
    const dPillH = 60;
    const dx = cx + pillW / 2 - dPillW - 10;
    const dy = cy - pillH / 2 - 10;

    ctx.fillStyle = darkPillBg;
    ctx.beginPath();
    ctx.roundRect(dx, dy - dPillH / 2, dPillW, dPillH, 30);
    ctx.fill();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.fillText(dateText, dx + dPillW / 2, dy);

    // 4. Dot
    ctx.fillStyle = cyan;
    ctx.beginPath();
    ctx.arc(cx + pillW / 2 + 30, cy, 5, 0, Math.PI * 2);
    ctx.fill();
}

export function drawSerifFloat(ctx: CanvasRenderingContext2D, stats: any, textColor = 'white') {
    const isDarkText = textColor === 'black' || (textColor.startsWith('#') && isColorDark(textColor));
    const isDark = !isDarkText;
    const cSolid = isDark ? '#ffffff' : '#000000';

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const rawVal = stats.mainValue || stats.distanceVal || '0.00';
    const displayVal = String(rawVal).trim();

    const cx = 540;
    const cy = 960;

    ctx.shadowColor = 'rgba(0,0,0,0.4)';
    ctx.shadowBlur = 60;
    ctx.shadowOffsetY = 30;

    // 1. Tagline
    const isDistance = stats.hasDistance || displayVal.toLowerCase().includes('km');
    const tagline = isDistance ? "The total distance was" : "The total time was";

    ctx.globalAlpha = 0.4;
    ctx.fillStyle = cSolid;
    ctx.font = "normal 400 65px 'EB Garamond'";
    ctx.fillText(tagline, cx, cy - 100);

    // 2. Massive Value
    ctx.globalAlpha = 1.0;
    ctx.font = "normal 900 180px 'Playfair Display'";
    if ((ctx as any).letterSpacing !== undefined) { (ctx as any).letterSpacing = "-0.05em"; }
    ctx.fillText(displayVal, cx, cy + 40);

    ctx.shadowBlur = 0;
    if ((ctx as any).letterSpacing !== undefined) { (ctx as any).letterSpacing = "0px"; }
}

export function drawMonoGhost(ctx: CanvasRenderingContext2D, stats: any, textColor = 'white') {
    const isDarkText = textColor === 'black' || (textColor.startsWith('#') && isColorDark(textColor));
    const isDark = !isDarkText;
    const cSolid = isDark ? '#ffffff' : '#000000';

    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';

    const rawVal = stats.timeStr || stats.mainValue || '0:00';
    const displayVal = String(rawVal).trim();
    const loc = (stats.dataPoints?.find((p: any) => p.label === 'Location')?.value || 'LOCATION').toUpperCase();
    const date = (stats.dayAndNumber || 'DATE').toUpperCase();

    const cx = 950; // Shifted right for "End" alignment
    const cy = 960;

    // 1. Massive Ghost Value
    ctx.font = "normal 300 240px 'JetBrains Mono'";
    ctx.fillStyle = cSolid;
    ctx.globalAlpha = 0.25;
    ctx.fillText(displayVal, cx, cy);

    // 2. Meta Line below
    ctx.globalAlpha = 0.6;
    ctx.font = "800 22px 'JetBrains Mono'";
    if ((ctx as any).letterSpacing !== undefined) { (ctx as any).letterSpacing = "0.4em"; }
    ctx.fillText(`${loc} // ${date}`, cx, cy + 120);

    ctx.globalAlpha = 1.0;
    if ((ctx as any).letterSpacing !== undefined) { (ctx as any).letterSpacing = "0px"; }
}

export function drawCoordsV2(ctx: CanvasRenderingContext2D, stats: any, textColor = 'white') {
    const isDarkText = textColor === 'black' || (textColor.startsWith('#') && isColorDark(textColor));
    const isDark = !isDarkText;
    const cSolid = isDark ? '#ffffff' : '#000000';

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const displayVal = (stats.mainValue || stats.distanceVal || '0.00').toString().trim();

    // Top pill (GPS COORDS)
    const cy = 960;

    let coordStr = "19.4326° N, 99.1332° W";
    if (stats.polyline) {
        const coords = decodePolyline(stats.polyline);
        if (coords.length > 0) {
            const lat = coords[0][0];
            const lng = coords[0][1];
            coordStr = `${Math.abs(lat).toFixed(4)}° ${lat >= 0 ? 'N' : 'S'}, ${Math.abs(lng).toFixed(4)}° ${lng >= 0 ? 'E' : 'W'}`;
        }
    }

    ctx.globalAlpha = 0.4;
    ctx.fillStyle = cSolid;
    ctx.font = "900 20px 'JetBrains Mono'";
    if ((ctx as any).letterSpacing !== undefined) { (ctx as any).letterSpacing = "0.2em"; }

    ctx.fillText(coordStr, 540, cy - 60);

    if ((ctx as any).letterSpacing !== undefined) { (ctx as any).letterSpacing = "0px"; }

    // Main Value
    ctx.globalAlpha = 1.0;
    ctx.font = "normal 900 110px 'Playfair Display'";
    ctx.fillText(displayVal, 540, cy + 20);
}


export function drawMarginalia(ctx: CanvasRenderingContext2D, stats: any, textColor = 'white') {
    const isDarkText = textColor === 'black' || (textColor.startsWith('#') && isColorDark(textColor));
    const isDark = !isDarkText;
    const cSolid = isDark ? '#ffffff' : '#000000';

    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';

    const rawVal = stats.mainValue || stats.distanceVal || '0.00';
    const mainVal = String(rawVal).trim();

    ctx.save();
    ctx.translate(100, 1000);

    ctx.globalAlpha = 0.6;
    ctx.fillStyle = cSolid;

    // Rotated text
    ctx.save();
    ctx.rotate(-Math.PI / 2);
    ctx.font = "900 20px 'Plus Jakarta Sans'";
    if ((ctx as any).letterSpacing !== undefined) { (ctx as any).letterSpacing = "0.8em"; }
    ctx.fillText("METADATA", 0, 0);
    if ((ctx as any).letterSpacing !== undefined) { (ctx as any).letterSpacing = "0px"; }
    ctx.restore();

    // Data blocks
    ctx.font = "normal 400 80px 'EB Garamond'";
    ctx.fillText(stats.title || 'Workout', 50, -40);

    ctx.globalAlpha = 0.3;
    ctx.fillText(mainVal, 50, 40);

    ctx.restore();
}

export function drawTypewriterMono(ctx: CanvasRenderingContext2D, stats: any, textColor = 'white') {
    const isDarkText = textColor === 'black' || (textColor.startsWith('#') && isColorDark(textColor));
    const isDark = !isDarkText;
    const cSolid = isDark ? '#ffffff' : '#000000';

    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    const displayVal = (stats.mainValue || stats.distanceVal || '0.00').toString().trim();
    const loc = (stats.dataPoints?.find((p: any) => p.label === 'Location')?.value || 'LOCATION').toUpperCase();
    const date = (stats.dayAndNumber || 'DATE').toUpperCase();

    const cx = 540;
    const cy = 960;

    ctx.save();
    ctx.translate(cx - 300, cy - 100);

    // Left Border
    ctx.globalAlpha = 0.15;
    ctx.fillStyle = cSolid;
    ctx.fillRect(0, 0, 3, 200);

    // Content
    const tx = 45;

    ctx.globalAlpha = 0.7;
    ctx.font = "700 24px 'Courier Prime'";
    if ((ctx as any).letterSpacing !== undefined) { (ctx as any).letterSpacing = "0.4em"; }
    ctx.fillText("OBSERVATION:", tx, 10);
    if ((ctx as any).letterSpacing !== undefined) { (ctx as any).letterSpacing = "0px"; }

    ctx.globalAlpha = 1.0;
    ctx.font = "bold normal 85px 'Courier Prime'";
    if ((ctx as any).letterSpacing !== undefined) { (ctx as any).letterSpacing = "-0.05em"; }
    ctx.fillText(`"${displayVal} logged."`, tx, 60);
    if ((ctx as any).letterSpacing !== undefined) { (ctx as any).letterSpacing = "0px"; }

    ctx.globalAlpha = 0.7;
    ctx.font = "400 22px 'Courier Prime'";
    if ((ctx as any).letterSpacing !== undefined) { (ctx as any).letterSpacing = "0.2em"; }
    ctx.fillText(`${loc} // ${date}`, tx, 160);
    if ((ctx as any).letterSpacing !== undefined) { (ctx as any).letterSpacing = "0px"; }

    ctx.restore();
}

export function drawBrutalSlash(ctx: CanvasRenderingContext2D, stats: any, textColor = 'white') {
    const isDarkText = textColor === 'black' || (textColor.startsWith('#') && isColorDark(textColor));
    const isDark = !isDarkText;
    const cSolid = isDark ? '#ffffff' : '#000000';

    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';

    const cx = 400;
    const cy = 960;

    ctx.fillStyle = cSolid;

    // 1. Giant Slash (Reduced alpha)
    ctx.globalAlpha = 0.1;
    ctx.font = "900 360px 'Plus Jakarta Sans'";
    if ((ctx as any).letterSpacing !== undefined) { (ctx as any).letterSpacing = "-0.05em"; }
    const slashW = ctx.measureText("/").width;
    ctx.fillText("/", cx - slashW / 2, cy + 120);
    if ((ctx as any).letterSpacing !== undefined) { (ctx as any).letterSpacing = "0px"; }

    // 2. Text Content (Shifted to overlap slightly)
    ctx.globalAlpha = 1.0;
    ctx.font = "normal 900 140px 'Plus Jakarta Sans'";
    if ((ctx as any).letterSpacing !== undefined) { (ctx as any).letterSpacing = "-0.05em"; }
    ctx.fillText(stats.timeStr || '0:00', cx + slashW / 2 - 60, cy + 30);
    if ((ctx as any).letterSpacing !== undefined) { (ctx as any).letterSpacing = "0px"; }

    ctx.globalAlpha = 0.8;
    ctx.font = "800 28px 'Plus Jakarta Sans'";
    if ((ctx as any).letterSpacing !== undefined) { (ctx as any).letterSpacing = "0.45em"; }
    ctx.fillText("DURATION", cx + slashW / 2 - 60, cy + 95);
    if ((ctx as any).letterSpacing !== undefined) { (ctx as any).letterSpacing = "0px"; }
}

export function drawMonoMinimal(ctx: CanvasRenderingContext2D, stats: any, textColor = 'white') {
    const { solid, trans, label: labelColor, accent: accentColor } = buildColors(textColor);

    const cx = 540;
    const cy = 1680;
    const w = 600;
    const h = 140;

    ctx.save();
    applyAntiGhostingShadow(ctx, textColor);

    // 1. Draw rounded container (tech spec plate)
    ctx.strokeStyle = textColor === 'black' ? 'rgba(0, 0, 0, 0.15)' : 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1.5;
    ctx.fillStyle = textColor === 'black' ? 'rgba(255, 255, 255, 0.8)' : 'rgba(28, 28, 30, 0.75)';
    ctx.beginPath();
    ctx.roundRect(cx - w / 2, cy - h / 2, w, h, 8); // Technical sharp 8px corners
    ctx.fill();
    ctx.stroke();

    // Subtle side accent line on the left
    ctx.fillStyle = accentColor;
    ctx.fillRect(cx - w / 2 + 10, cy - h / 2 + 15, 4, h - 30);

    ctx.textBaseline = 'middle';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    // 2. Left Column: Label / Details
    ctx.textAlign = 'left';
    ctx.fillStyle = textColor;

    // Sub-title
    ctx.font = "800 13px 'JetBrains Mono'";
    setLetterSpacing(ctx, "0.15em");
    ctx.fillText("SPECIFICATION", cx - w / 2 + 30, cy - 25);

    // Main Activity
    const isWorkout = stats.type?.toLowerCase().includes('workout') || stats.type?.toLowerCase().includes('training') || stats.type?.toLowerCase().includes('gym') || !stats.hasDistance;
    const type = applyActivityCasing(normalizeSport(stats.type || 'Run'), 'mono-minimal').toUpperCase();
    ctx.font = "500 20px 'JetBrains Mono'";
    setLetterSpacing(ctx, "0.05em");
    ctx.fillText(type, cx - w / 2 + 30, cy + 15);
    setLetterSpacing(ctx, "0px");

    // 3. Right Column: Metric
    ctx.textAlign = 'right';
    const rawVal = stats.mainValue || stats.distanceVal || '0.00';
    const valStr = String(rawVal).trim().toUpperCase();
    const unit = isWorkout ? '' : 'KM';
    const displayVal = unit ? `${valStr} ${unit}` : valStr;

    ctx.font = "normal 800 48px 'JetBrains Mono'";
    ctx.fillText(displayVal, cx + w / 2 - 30, cy);

    ctx.restore();
}

export function drawSwissMinimal(ctx: CanvasRenderingContext2D, stats: any, textColor = 'white') {
    const isDarkText = textColor === 'black' || (textColor.startsWith('#') && isColorDark(textColor));
    const isDark = !isDarkText;
    const cSolid = isDark ? '#ffffff' : '#000000';
    const bgPill = isDark ? '#ffffff' : '#000000';
    const fgPill = isDark ? '#000000' : '#ffffff';

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const rawVal = stats.mainValue || stats.distanceVal || '0.00';
    const isDuration = String(rawVal).includes('h') || String(rawVal).includes('m');
    const displayVal = String(rawVal).trim();

    const hasDistance = stats.hasDistance || (stats.distanceVal && parseFloat(stats.distanceVal) > 0);
    let type = applyActivityCasing(normalizeSport(stats.type || (hasDistance ? 'Run' : 'Workout')), 'swiss-minimal');
    const mainUnit = stats.mainValue ? stats.mainValue.replace(/[0-9.]/g, '').trim() || 'KM' : 'KM';

    const cx = 540;
    const cy = 960;

    // 1. Value
    ctx.fillStyle = cSolid;
    ctx.font = isDuration ? "900 160px 'Plus Jakarta Sans'" : "900 240px 'Plus Jakarta Sans'";
    if ((ctx as any).letterSpacing !== undefined) { (ctx as any).letterSpacing = "-0.08em"; }
    ctx.fillText(displayVal, cx, cy - 60);
    if ((ctx as any).letterSpacing !== undefined) { (ctx as any).letterSpacing = "0px"; }

    // 2. Type Pill
    ctx.font = "900 22px 'Plus Jakarta Sans'";
    const txt2 = type.toUpperCase();
    const w2 = ctx.measureText(txt2).width;

    const padding = 40;
    const pillW = w2 + padding * 2;
    const pillH = 55;

    ctx.fillStyle = bgPill;
    ctx.beginPath();
    ctx.roundRect(cx - pillW / 2, cy + 80, pillW, pillH, 10);
    ctx.fill();

    ctx.fillStyle = fgPill;
    ctx.textAlign = 'center';
    if ((ctx as any).letterSpacing !== undefined) { (ctx as any).letterSpacing = "0.3em"; }

    ctx.fillText(txt2, cx, cy + 80 + pillH / 2);

    if ((ctx as any).letterSpacing !== undefined) { (ctx as any).letterSpacing = "0px"; }
}

export function drawEditorialRow(ctx: CanvasRenderingContext2D, stats: any, textColor = 'white') {
    const { s1, s2, s3, hasMap } = getDynamicStats(stats);
    const { accent } = buildColors(textColor);

    const bannerH = 160;
    const bannerY = 1700;
    // ensure textcolor logic is safe
    const isDarkText = textColor === 'black' || (textColor.startsWith('#') && isColorDark(textColor));
    const isDark = !isDarkText;

    ctx.save();

    // Brutalist Box
    ctx.fillStyle = isDark ? 'rgba(255,255,255,0.95)' : 'rgba(0,0,0,0.85)';
    ctx.fillRect(0, bannerY, 1080, bannerH);

    // Accent Top Border
    ctx.fillStyle = accent;
    ctx.fillRect(0, bannerY, 1080, 8);

    // Left Section: ACTIVITY TYPE
    ctx.fillStyle = accent;
    ctx.font = "900 24px 'Michroma'";
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText((stats.title || 'ACTIVITY').toUpperCase(), 40, bannerY + bannerH / 2);

    // Divider
    ctx.fillStyle = isDark ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.2)';
    ctx.fillRect(320, bannerY + 30, 2, bannerH - 60);

    // Middle Section: MAIN STAT (Distance/Time)
    ctx.textAlign = 'center';
    ctx.fillStyle = isDark ? '#000000' : '#ffffff';
    ctx.font = "800 70px 'Space Grotesk'";
    ctx.fillText(s1.value, 540, bannerY + bannerH / 2);
    ctx.font = "800 20px 'Space Grotesk'";
    const valW = ctx.measureText(s1.value).width;
    ctx.fillText(s1.label.toUpperCase(), 540 + valW / 2 + 30, bannerY + bannerH / 2);

    // Divider
    ctx.fillStyle = isDark ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.2)';
    ctx.fillRect(780, bannerY + 30, 2, bannerH - 60);

    // Right Section: SUB STAT (Pace)
    ctx.textAlign = 'center';
    ctx.fillStyle = accent;
    ctx.font = "800 45px 'Space Grotesk'";
    ctx.fillText(s2.value, 930, bannerY + bannerH / 2 - 10);
    ctx.fillStyle = isDark ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.6)';
    ctx.font = "600 16px 'Michroma'";
    ctx.fillText(s2.label.toUpperCase(), 930, bannerY + bannerH / 2 + 30);

    ctx.restore();
}


// ─── Editorial Strip Template ──────────────────────────────────────────────

export function drawCloudIcon(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string) {
    ctx.save();
    ctx.fillStyle = color;
    const s = size / 24;
    ctx.beginPath();
    ctx.moveTo(x + 18 * s, x + 10 * s);
    // Simplified cloud path
    ctx.arc(x + 17 * s, y + 15 * s, 6 * s, -Math.PI / 2, Math.PI, true);
    ctx.arc(x + 8 * s, y + 15 * s, 5 * s, Math.PI, -Math.PI / 4, true);
    ctx.arc(x + 12 * s, y + 10 * s, 5 * s, -Math.PI, 0, false);
    ctx.fill();
    ctx.restore();
}

export function drawMapPinIcon(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string) {
    ctx.save();
    ctx.fillStyle = color;
    const s = size / 24;

    // Solid Marker Shape (Inverted Drop)
    ctx.beginPath();
    ctx.moveTo(x, y + 10 * s);
    ctx.bezierCurveTo(x - 9 * s, y + 2 * s, x - 9 * s, y - 8 * s, x, y - 8 * s);
    ctx.bezierCurveTo(x + 9 * s, y - 8 * s, x + 9 * s, y + 2 * s, x, y + 10 * s);

    // Inner cutout (the "hole") - using winding rule to create transparent center
    ctx.moveTo(x + 3 * s, y - 1 * s);
    ctx.arc(x, y - 1 * s, 3 * s, 0, Math.PI * 2, true);

    ctx.fill();
    ctx.restore();
}

export function drawSciencePro(ctx: CanvasRenderingContext2D, stats: any, textColor: string) {
    ctx.save();
    ctx.translate(0, -450);
    const accent = '#A3FFD6';
    ctx.textAlign = 'center';

    // 1. Header (Ultra-Compact + Scaled)
    const title = (stats.title || normalizeSport(stats.type) || 'Activity').toUpperCase();
    let titleFontSize = 82;
    ctx.font = `400 ${titleFontSize}px 'Michroma'`;
    const maxTitleW = 900;

    // Auto-Scaling for Title
    while (ctx.measureText(title).width > maxTitleW && titleFontSize > 30) {
        titleFontSize -= 2;
        ctx.font = `400 ${titleFontSize}px 'Michroma'`;
    }

    ctx.fillStyle = accent;
    ctx.fillText(title, 540, 700);

    const isWorkout = stats.type?.toLowerCase().includes('workout') || stats.type?.toLowerCase().includes('training') || stats.type?.toLowerCase().includes('gym') || !stats.hasDistance;
    const mainDisplayVal = isWorkout ? (stats.timeStr || '0:00') : (stats.distanceVal || stats.mainValue || '0.00');
    const mainUnit = isWorkout ? 'DURATION' : 'KM';

    ctx.font = "400 32px 'Michroma'";
    const meta = `${(stats.location || 'MEXICO CITY').toUpperCase()} — ${mainDisplayVal} ${mainUnit}`;
    ctx.globalAlpha = 0.8;
    setLetterSpacing(ctx, '4px');
    ctx.fillText(meta, 540, 745);
    setLetterSpacing(ctx, '0px');
    ctx.globalAlpha = 1.0;

    // 2. Middle Row (Technical Grid V9 - Bold & Linked)
    const iconY = 840; // Tighter vertical positioning
    ctx.strokeStyle = accent;
    ctx.lineWidth = 5; // Bolder icons as requested

    // A. Performance Pill (Dynamic: PACE or CALORIES)
    const calVal = stats.calories ? `${stats.calories} KCAL` : (stats.avgPower ? `${stats.avgPower} W` : (stats.timeStr || '--'));
    const paceVal = (isWorkout ? calVal : (stats.subValue || '5:15 /KM')).toUpperCase();
    const pillLabel = isWorkout ? (stats.calories ? 'CALORIES' : 'OUTPUT') : 'PACE';

    const pillWidth = 200;
    const startX = 320;

    ctx.beginPath(); ctx.roundRect(startX, iconY - 35, pillWidth, 70, 35); ctx.stroke();

    // Label
    ctx.font = "900 18px 'Space Grotesk'";
    ctx.fillStyle = accent;
    ctx.globalAlpha = 0.6;
    ctx.fillText(pillLabel, startX + pillWidth / 2, iconY - 45);
    ctx.globalAlpha = 1.0;

    ctx.font = "700 24px 'Space Grotesk'";
    ctx.fillText(paceVal, startX + pillWidth / 2, iconY + 10);

    // B. Globe Icon (Bold Wireframe)
    function drawScientificGlobe(x, y) {
        ctx.save();
        ctx.lineWidth = 2.5; // Thicker wireframe
        ctx.beginPath(); ctx.ellipse(x, y, 15, 38, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.ellipse(x, y, 30, 32, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x - 38, y); ctx.lineTo(x + 38, y); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x, y - 38); ctx.lineTo(x, y + 38); ctx.stroke();
        ctx.restore();
    }
    drawScientificGlobe(startX + pillWidth + 40, iconY);

    // C. Lightning Bolt (Bold Circle)
    function drawScientificBolt(x, y) {
        ctx.save();
        ctx.beginPath(); ctx.arc(x, y, 40, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = accent;
        ctx.beginPath();
        ctx.moveTo(x + 5, y - 18); ctx.lineTo(x - 12, y + 2);
        ctx.lineTo(x + 2, y + 2); ctx.lineTo(x - 5, y + 20);
        ctx.lineTo(x + 12, y); ctx.lineTo(x, y); ctx.fill();
        ctx.restore();
    }
    drawScientificBolt(startX + pillWidth + 120, iconY);

    // D. Chevron Target (Bold Multi-Chevron)
    function drawScientificTarget(x, y) {
        ctx.save();
        ctx.beginPath(); ctx.arc(x, y, 40, 0, Math.PI * 2); ctx.stroke();
        ctx.lineWidth = 3.5; // Bolder chevrons
        const d = 12; // offset
        const s = 6;  // size
        ctx.beginPath(); ctx.moveTo(x - s, y - d - s); ctx.lineTo(x, y - d); ctx.lineTo(x + s, y - d - s); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x - s, y + d + s); ctx.lineTo(x, y + d); ctx.lineTo(x + s, y + d + s); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x - d - s, y - s); ctx.lineTo(x - d, y); ctx.lineTo(x - d - s, y + s); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x + d + s, y - s); ctx.lineTo(x + d, y); ctx.lineTo(x + d + s, y + s); ctx.stroke();
        ctx.restore();
    }
    drawScientificTarget(startX + pillWidth + 200, iconY);

    // 3. Performance Stats (Elite Density)
    ctx.font = "400 62px 'Space Grotesk'";
    ctx.fillText('PERFORMANCE', 540, 975); // Shaved 35px
    ctx.globalAlpha = 0.9;
    ctx.font = "400 52px 'Space Grotesk'";
    const hrVal = stats.avgHeartrate || stats.maxHeartrate || '170';
    ctx.fillText(hrVal + ' BPM', 540, 1025); // Shaved 40px
    ctx.globalAlpha = 1.0;

    // 4. Footer (Elite Density)
    ctx.font = "700 36px 'Space Grotesk'";
    ctx.globalAlpha = 0.6;
    ctx.fillText(`© ${new Date().getFullYear()} SCORA`, 540, 1100); // Shaved 50px
    ctx.globalAlpha = 1.0;

    ctx.font = "400 58px 'Space Grotesk'";
    const tempVal = stats.avgTemp || '--';
    ctx.fillText(tempVal + '°C TRACKED', 540, 1160);
    ctx.restore();
}

/**
 * Dynamic Greeting based on start time string (e.g. "9:00 AM")
 */
function getGreeting(startTimeStr: string): string {
    if (!startTimeStr) return "GOOD MORNING";
    const [time, ampm] = startTimeStr.split(' ');
    const [hour] = time.split(':').map(Number);

    let h24 = hour;
    if (ampm === 'PM' && hour !== 12) h24 += 12;
    if (ampm === 'AM' && hour === 12) h24 = 0;

    if (h24 >= 5 && h24 < 12) return "GOOD MORNING";
    if (h24 >= 12 && h24 < 19) return "GOOD AFTERNOON";
    return "GOOD NIGHT";
}

export function drawEditorialStrip(ctx: CanvasRenderingContext2D, stats: any, textColor: string) {
    const c = buildColors(textColor);
    ctx.textBaseline = 'middle';

    // 1. Top Section (Weather/Time)
    ctx.textAlign = 'right';
    ctx.fillStyle = c.solid;

    if (stats.avgTemp) {
        ctx.font = "900 64px 'Inter'";
        ctx.fillText(stats.avgTemp + '°', 950, 150);
    }

    ctx.font = "900 24px 'Plus Jakarta Sans'";
    ctx.fillStyle = c.trans;
    ctx.fillText('LOCAL TIME', 950, 220);

    ctx.font = "700 32px 'Plus Jakarta Sans'";
    ctx.fillStyle = c.solid;
    const timeDisplay = (stats.startTime || '--:--').toUpperCase();
    const durDisplay = stats.timeStr ? ` | ${stats.timeStr.toUpperCase()}` : '';
    ctx.fillText(`${timeDisplay}${durDisplay}`, 950, 265);

    // 2. Vertical Day Headline
    ctx.save();
    ctx.translate(900, 960);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Dynamic Greeting
    ctx.font = "900 28px 'Inter'";
    ctx.fillStyle = c.trans;
    setLetterSpacing(ctx, '12px');
    ctx.fillText(getGreeting(stats.startTime), 0, -180);
    setLetterSpacing(ctx, '0px');

    // Massive Rotated Day
    const dayStr = (stats.dayName || 'FRIDAY').toUpperCase();
    let fontSize = 320;
    ctx.font = `900 ${fontSize}px 'Inter'`;
    let dayWidth = ctx.measureText(dayStr).width;

    if (dayWidth > 1100) {
        fontSize = Math.floor(320 * (1100 / dayWidth));
        ctx.font = `900 ${fontSize}px 'Inter'`;
    }

    const dayGrad = ctx.createLinearGradient(-500, 0, 500, 0);
    dayGrad.addColorStop(0, textColor === 'black' ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)');
    dayGrad.addColorStop(1, textColor === 'black' ? 'rgba(0,0,0,0.9)' : 'rgba(255,255,255,0.9)');
    ctx.fillStyle = dayGrad;
    ctx.fillText(dayStr, 0, 0);
    ctx.restore();

    // 3. Bottom Section (Location/Stats)
    const bottomY = 1730; // 1750 -> 1730
    ctx.textAlign = 'left';

    ctx.strokeStyle = c.trans;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(80, bottomY - 50); ctx.lineTo(1000, bottomY - 50); ctx.stroke();

    // Location
    drawMapPinIcon(ctx, 100, bottomY, 24, c.accent);
    ctx.font = "900 24px 'Plus Jakarta Sans'";
    ctx.fillStyle = c.trans;
    setLetterSpacing(ctx, '4px');
    ctx.fillText((stats.location || 'MEXICO CITY').toUpperCase(), 130, bottomY);
    setLetterSpacing(ctx, '0px');

    // Main Stat (Distance/Duration)
    const mainVal = stats.hasDistance ? stats.distanceVal : stats.mainValue;
    const mainUnitBottom = stats.hasDistance ? 'KM' : 'TIME';

    drawStatWithUnit(ctx, 100, bottomY + 70, mainVal, mainUnitBottom, { // 80 -> 70
        valueFont: "900 84px 'Inter'",
        unitFont: "700 32px 'Plus Jakarta Sans'",
        valueColor: c.solid,
        unitColor: c.trans,
        gap: 20,
        align: 'left'
    });



}


// ─── The Final Three Suite ──────────────────────────────────────────────────

/**
 * 01. CLASSIC STACK (v1.0)
 * High-fidelity retro typography with hard-shadow "Playfair" depth.
 */
export function drawClassicStack(ctx: CanvasRenderingContext2D, stats: any, textColor: string) {
    const c = buildColors(textColor);
    const sysFont = "'Playfair Display', serif";

    const valText = stats.hasDistance ? (stats.distanceVal || '0.00') : (stats.timeStr || '0:00');
    const unitText = stats.hasDistance ? 'kilometers' : 'time';
    const locText = (stats.dataPoints?.find(p => p.label === 'Location')?.value || 'Unknown').toUpperCase();

    const cx = 540;
    const cy = 960;

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Hard Shadow Config
    ctx.shadowColor = textColor === 'black' ? 'rgba(0,0,0,0.15)' : '#b91c1c';
    ctx.shadowOffsetX = 6;
    ctx.shadowOffsetY = 6;
    ctx.shadowBlur = 0;

    // 1. Value (Massive)
    ctx.font = `normal 900 320px ${sysFont}`;
    ctx.fillStyle = textColor === 'black' ? 'black' : '#fbbf24';
    ctx.fillText(valText, cx, cy - 140);

    // 2. Unit
    ctx.font = `normal 900 140px ${sysFont}`;
    ctx.fillStyle = textColor === 'black' ? 'rgba(0,0,0,0.85)' : 'white';
    ctx.fillText(unitText, cx, cy + 80);

    // 3. Location (Subtitle)
    ctx.shadowOffsetX = 3;
    ctx.shadowOffsetY = 3;
    ctx.font = `normal 900 58px ${sysFont}`;
    ctx.letterSpacing = "4px";
    ctx.fillText(locText, cx, cy + 220);

    ctx.restore();
}

/**
 * 02. NEON SLANTED (v1.0)
 * Glassmorphic tilted block with vibrant gradients and "High-Voltage" contrast.
 */
export function drawNeonSlanted(ctx: CanvasRenderingContext2D, stats: any, textColor: string) {
    const sysFont = "'Playfair Display', serif";
    const rawType = stats.activityType || 'Workout';
    const activity = applyActivityCasing(normalizeSport(rawType), 'neon-slanted');

    // Back to Kilometers/Time for this specific style (Compositional Choice)
    const valText = stats.hasDistance ? (stats.distanceVal || '0.00') : (stats.timeStr || '0:00');
    const unitText = stats.hasDistance ? 'KILOMETERS' : 'TIME';
    const fullMainText = `${valText} ${unitText}`;

    const cx = 540;
    const cy = 1000;
    const w = 780;
    const h = 480;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-5 * Math.PI / 180);

    // 1. Glass Backdrop
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.4)';
    ctx.shadowBlur = 60;
    ctx.shadowOffsetY = 30;

    ctx.beginPath();
    ctx.roundRect(-w / 2, -h / 2, w, h, 120);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
    ctx.fill();

    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(34, 211, 238, 0.2)'; // Cyan tint
    ctx.stroke();
    ctx.restore();

    // 2. Activity Label (Gradient)
    const grad = ctx.createLinearGradient(-w / 2, 0, w / 2, 0);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.5, '#22d3ee'); // Cyan
    grad.addColorStop(1, '#ffffff');

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `normal 900 85px ${sysFont}`;
    ctx.fillStyle = grad;

    ctx.shadowColor = 'rgba(22, 78, 99, 0.8)';
    ctx.shadowOffsetX = 5;
    ctx.shadowOffsetY = 5;
    ctx.shadowBlur = 0;
    ctx.fillText(activity, 0, -60);

    // 3. Values (Width-Aware Fit)
    let fontSize = 120;
    ctx.font = `normal 900 ${fontSize}px ${sysFont}`;

    // Safety check: ensure combined text fits in width
    while (ctx.measureText(fullMainText).width > w - 100 && fontSize > 40) {
        fontSize -= 5;
        ctx.font = `normal 900 ${fontSize}px ${sysFont}`;
    }

    const valueGrad = ctx.createLinearGradient(-w / 4, 0, w / 4, 0);
    valueGrad.addColorStop(0, '#67e8f9'); // Cyan 300
    valueGrad.addColorStop(1, '#3b82f6'); // Blue 500
    ctx.fillStyle = valueGrad;
    ctx.shadowColor = '#1e3a8a';
    ctx.fillText(fullMainText, 0, 80);

    ctx.restore();
}

/**
 * 03. AESTHETIC MEDAL (v1.0)
 * 16-point scalloped seal with gold-rim gradient and typographic inner-core.
 */
export function drawAestheticMedal(ctx: CanvasRenderingContext2D, stats: any, textColor: string) {
    const sysFont = "'Playfair Display', serif";
    const paceVal = (stats.subValue || '').split(' ')[0] || '0:00';

    // Date Logic: Month + Day
    const rawDate = stats.rawDate ? new Date(stats.rawDate) : new Date();
    const month = new Intl.DateTimeFormat('en-US', { month: 'short' }).format(rawDate).toUpperCase();
    const day = rawDate.getDate().toString().padStart(2, '0');
    const dateFormatted = `${month} ${day}`;

    const cx = 540;
    const cy = 960;
    const outerR = 320;

    // Helper: Scalloped Path
    const drawScalloped = (x, y, radius, points, depth) => {
        ctx.beginPath();
        for (let i = 0; i < points * 2; i++) {
            const r = (i % 2 === 0) ? radius : radius - depth;
            const a = (Math.PI * i) / points;
            ctx.lineTo(x + r * Math.sin(a), y + r * Math.cos(a));
        }
        ctx.closePath();
    };

    ctx.save();

    // 1. Scalloped Seal Border
    ctx.save();
    drawScalloped(cx, cy, outerR, 16, 25);

    const gold = ctx.createLinearGradient(cx - outerR, cy - outerR, cx + outerR, cy + outerR);
    gold.addColorStop(0, '#fbbf24');
    gold.addColorStop(0.5, '#f59e0b');
    gold.addColorStop(1, '#d97706');

    ctx.lineWidth = 14;
    ctx.strokeStyle = gold;
    ctx.stroke();
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; // Glass center
    ctx.fill();
    ctx.restore();

    // 2. Inner Rim
    ctx.beginPath();
    ctx.arc(cx, cy, outerR - 45, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(251, 191, 36, 0.15)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // 3. Content
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Activity-Specific Metric Logic
    // Fix: Using subLabel and subValue instead of speedVal
    const label = (stats.hasDistance ? (stats.subLabel || 'PACE') : 'TIME').toUpperCase();
    const val = (stats.hasDistance ? (stats.subValue || '0.00').split(' ')[0] : (stats.timeStr || '0:00'));
    let suffix = '';

    if (stats.type === 'Ride') {
        suffix = ' KM/HR';
    } else if (stats.hasDistance) {
        suffix = ' /KM';
    }

    // Label (Top)
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = "900 24px 'Plus Jakarta Sans'";
    ctx.letterSpacing = "12px";
    ctx.fillText(label, cx + 6, cy - 130);

    // Primary Value (Middle)
    const fullValText = `${val}${suffix}`;
    ctx.shadowColor = '#b91c1c';
    ctx.shadowOffsetX = 6;
    ctx.shadowOffsetY = 6;
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'white';

    let fontSize = 130;
    ctx.font = `normal 900 ${fontSize}px ${sysFont}`;

    // Width awareness to keep inside the seal core
    while (ctx.measureText(fullValText).width > 480 && fontSize > 60) {
        fontSize -= 5;
        ctx.font = `normal 900 ${fontSize}px ${sysFont}`;
    }

    ctx.fillText(fullValText, cx, cy - 10);

    // Footer Decoration
    ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;
    ctx.fillStyle = 'white';
    ctx.font = "900 22px 'Plus Jakarta Sans'";
    ctx.letterSpacing = "6px";

    // Pill dot
    ctx.globalAlpha = 0.5;
    ctx.beginPath(); ctx.arc(cx - 100, cy + 95, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillText(dateFormatted, cx, cy + 100);
    ctx.beginPath(); ctx.arc(cx + 100, cy + 95, 5, 0, Math.PI * 2); ctx.fill();

    ctx.restore();
}
export function drawGraffitiExpo(ctx: CanvasRenderingContext2D, stats: any, textColor: string) {
    const { solid, trans, label: labelColor, accent: accentColor } = buildColors(textColor);

    const lineColor = textColor.startsWith('#') ? textColor : (textColor === 'black' ? '#000000' : '#ffffff');
    const secondaryColor = textColor === 'black' ? '#000000' : '#ffffff';
    const isDarkAccent = isColorDark(accentColor);
    const isDarkSecondary = isColorDark(secondaryColor);

    // 1. Enhanced Spray Map (Higher, leave space for text)
    if (stats.polyline) {
        const coords = decodePolyline(stats.polyline);
        if (coords && coords.length > 0) {
            const mapBox = { x: 100, y: 180, w: 880, h: 700 };

            let minLat = coords[0][0], maxLat = minLat, minLng = coords[0][1], maxLng = minLng;
            coords.forEach((p: any) => {
                if (p[0] < minLat) minLat = p[0]; if (p[0] > maxLat) maxLat = p[0];
                if (p[1] < minLng) minLng = p[1]; if (p[1] > maxLng) maxLng = p[1];
            });

            const scale = Math.min(mapBox.w / (maxLng - minLng), mapBox.h / (maxLat - minLat));

            const getXY = (p: [number, number]) => {
                const x = mapBox.x + (p[1] - minLng) * scale + (mapBox.w - ((maxLng - minLng) * scale)) / 2;
                const y = mapBox.y + mapBox.h - ((p[0] - minLat) * scale) - (mapBox.h - ((maxLat - minLat) * scale)) / 2;
                return { x, y };
            };

            ctx.save();
            ctx.globalAlpha = 0.85;
            ctx.beginPath();
            ctx.strokeStyle = lineColor;
            ctx.lineWidth = 16;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            coords.forEach((p: any, i: number) => {
                const pos = getXY(p);
                if (i === 0) ctx.moveTo(pos.x, pos.y); else ctx.lineTo(pos.x, pos.y);
            });
            ctx.stroke();
            ctx.restore();
        }
    }

    // 2. Aesthetic Typography (Bottom)
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';

    // Custom color from map
    const customColor = lineColor;
    const sport = normalizeSport(stats.type);

    // Distance (Data - 85% Opacity)
    const distNum = stats.distanceVal || '0.00';
    ctx.save();
    ctx.globalAlpha = 0.85;
    ctx.font = "900 140px 'BBH Bartle'";
    ctx.fillStyle = customColor;
    ctx.fillText(distNum, 540, 950);
    ctx.restore();

    // Units (Solid - 100% Opacity)
    ctx.save();
    ctx.font = "800 32px 'Plus Jakarta Sans'";
    ctx.fillStyle = secondaryColor;
    ctx.globalAlpha = 1.0;
    if (typeof (ctx as any).letterSpacing !== 'undefined') (ctx as any).letterSpacing = "15px";
    ctx.fillText("KILOMETERS", 540, 1000);
    if (typeof (ctx as any).letterSpacing !== 'undefined') (ctx as any).letterSpacing = "0px";
    ctx.restore();

    // Secondary Data (Pace & Time - 85% Opacity)
    ctx.save();
    ctx.globalAlpha = 0.85;
    ctx.font = "900 55px 'BBH Bartle'";
    ctx.fillStyle = customColor;
    ctx.fillText(stats.subValue || '0:00 /km', 310, 1100);
    ctx.fillText(stats.timeStr || '0h 00m', 770, 1100);
    ctx.restore();

    // Labels (Solid - 100% Opacity)
    ctx.save();
    ctx.font = "800 24px 'Plus Jakarta Sans'";
    ctx.fillStyle = secondaryColor;
    ctx.globalAlpha = 1.0;
    if (typeof (ctx as any).letterSpacing !== 'undefined') (ctx as any).letterSpacing = "10px";

    const paceLabel = sport === 'Ride' ? 'AVG. SPEED' : 'PACE';
    ctx.fillText(paceLabel, 310, 1140);
    ctx.fillText("TOTAL DURATION", 770, 1140);
    if (typeof (ctx as any).letterSpacing !== 'undefined') (ctx as any).letterSpacing = "0px";
    ctx.restore();
}

/**
 * GRAFFITI BRAND — Grid Centered Edition.
 * Surgical centering within an imagined 1x2 layout grid.
 */
export function drawGraffitiBrand(ctx: CanvasRenderingContext2D, stats: any, textColor: string) {
    const { accent: accentColor } = buildColors(textColor);

    // Canvas Constants
    const safeW = 960;
    const midX = 540;
    // 50/50 split columns
    const colX1 = 540 - (safeW / 4); // Center of left half
    const colX2 = 540 + (safeW / 4); // Center of right half

    // Push layout as high as possible to minimize vertical footprint
    const startY = 220; // Intended visual top of the sticker

    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic'; // Safari safe: prevents 'top' bounding box inconsistencies

    // 1. Logic: Check if Workout/Non-Distance
    const isWorkout = stats.type?.toLowerCase().includes('workout') || stats.type?.toLowerCase().includes('training') || stats.type?.toLowerCase().includes('gym') || !stats.hasDistance;

    // 2. Hero Metric (Top, Max Width)
    const heroVal = String(isWorkout ? (stats.timeStr || '0:00') : (stats.distanceVal || '0.00')).toUpperCase();

    ctx.save();
    ctx.globalAlpha = 1.0;
    ctx.font = "400 100px 'Bungee'";

    // Scale hero text to fill 960px perfectly (protect against 0 width crashing canvas)
    const baseW = Math.max(1, ctx.measureText(heroVal).width);
    let heroSize = Math.floor(100 * (safeW / baseW));
    if (!isFinite(heroSize) || heroSize > 600) heroSize = 600; // Hard cap

    ctx.font = `400 ${heroSize}px 'Bungee'`;
    ctx.fillStyle = accentColor;

    // Calculate exact alphabetic baseline. Bungee's baseline is approx 85% of font size.
    const heroBaseline = startY + (heroSize * 0.85);
    ctx.fillText(heroVal, midX, heroBaseline);
    ctx.restore();

    // 3. Main Unit (Directly beneath hero)
    const heroLabel = isWorkout ? "DURATION" : "KILOMETERS";
    ctx.save();
    ctx.font = "800 40px 'Space Grotesk'"; // Increased from 32px
    ctx.fillStyle = accentColor;
    ctx.globalAlpha = 1.0;
    if (typeof (ctx as any).letterSpacing !== 'undefined') (ctx as any).letterSpacing = "10px";

    // Place unit baseline exactly 40px below the hero baseline
    const labelBaseline = heroBaseline + 40;
    ctx.fillText(heroLabel, midX, labelBaseline);
    ctx.restore();

    // 4. Activity Statistics (Data Prep)
    const isRide = stats.type === 'Ride' || stats.type === 'EBikeRide';

    let m1Value = ''; let m1Label = '';
    let m2Value = ''; let m2Label = '';

    if (isWorkout) {
        m1Value = stats.avgHeartrate ? `${stats.avgHeartrate} BPM` : (stats.calories ? `${stats.calories} KCAL` : 'WORKOUT');
        m1Label = stats.avgHeartrate ? 'HEART RATE' : (stats.calories ? 'CALORIES' : 'SESSION');
        m2Value = stats.calories && stats.avgHeartrate ? `${stats.calories} KCAL` : String(stats.date || 'TODAY').toUpperCase();
        m2Label = stats.calories && stats.avgHeartrate ? 'CALORIES' : 'DATE';
    } else {
        m1Value = String(stats.subValue || '0:00 /KM').toUpperCase();
        m1Label = isRide ? 'AVG. SPEED' : 'PACE';
        m2Value = String(stats.timeStr || '0M').toUpperCase();
        m2Label = 'DURATION';
    }

    // 5. 50/50 Sub-Metrics
    // Place the top of the sub-metrics about 25px below the main unit label baseline
    const row2YTop = labelBaseline + 25;

    const drawGridMetric = (val: string, label: string, x: number, yTop: number) => {
        // Value
        ctx.save();
        ctx.fillStyle = accentColor;
        ctx.globalAlpha = 1.0;

        let mSize = 80;
        ctx.font = `400 ${mSize}px 'Bungee'`;

        // Scale to fit half column (480px) with 40px padding
        while (ctx.measureText(val).width > 440 && mSize > 30) {
            mSize -= 2;
            ctx.font = `400 ${mSize}px 'Bungee'`;
        }

        const valBaseline = yTop + (mSize * 0.85);
        ctx.fillText(val, x, valBaseline);

        // Label
        ctx.font = "800 36px 'Space Grotesk'";
        ctx.globalAlpha = 1.0;
        if (typeof (ctx as any).letterSpacing !== 'undefined') (ctx as any).letterSpacing = "4px";

        // Stack tightly under the sub-metric value (36px font + 12px gap)
        const subLabelBaseline = valBaseline + 36 + 12;
        ctx.fillText(label, x, subLabelBaseline);
        ctx.restore();
    };

    drawGridMetric(String(m1Value), String(m1Label), colX1, row2YTop);
    drawGridMetric(String(m2Value), String(m2Label), colX2, row2YTop);
}

export function drawJournalGrid(ctx: CanvasRenderingContext2D, stats: any, textColor: string) {
    const c = buildColors(textColor);
    const lineColor = textColor.startsWith('#') ? textColor : (textColor === 'black' ? '#000000' : '#ffffff');
    const isDark = isColorDark(lineColor);
    const sport = normalizeSport(stats.type);

    ctx.save();
    ctx.globalAlpha = 0.9;

    // Apply Bi-Directional Readability Shadow (Anti-Ghosting)
    ctx.save();
    ctx.shadowColor = isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.7)'; // Stronger contrast shadow
    ctx.shadowBlur = 14;
    ctx.shadowOffsetY = 3;

    // Refined Grid Aesthetics
    ctx.beginPath();
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 3;
    ctx.globalAlpha = 0.15;
    const gridX = 520; // Shifted left slightly to give more room
    const col2X = 810;
    const gridY = 80;
    const rowHeight = 110; // Increased row height for larger text
    // Horizontal separator lines
    ctx.moveTo(gridX, gridY + rowHeight - 20);
    ctx.lineTo(col2X + 220, gridY + rowHeight - 20);
    ctx.moveTo(gridX, gridY + rowHeight * 2 - 20);
    ctx.lineTo(col2X + 220, gridY + rowHeight * 2 - 20);
    ctx.stroke();

    // 1. DAY Indicator (Top Left)
    ctx.globalAlpha = 1.0; // PURE SOLID for maximum readability
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = lineColor;

    // Day Name (e.g., TUESDAY) under logo
    const dayLabel = (stats.dayName || "ACTIVITY").toUpperCase();

    let dayFontSize = 80;
    ctx.font = `900 ${dayFontSize}px 'Merriweather'`;
    // Proportional dynamic scaling loop
    while (ctx.measureText(dayLabel).width > 440 && dayFontSize > 30) {
        dayFontSize -= 2;
        ctx.font = `900 ${dayFontSize}px 'Merriweather'`;
    }

    ctx.fillText(dayLabel, 55, 180);

    // Month Day (e.g., 24) under Day Name
    const monthDay = stats.rawDate ? new Date(stats.rawDate).getDate() : "1";
    ctx.font = "900 260px 'Merriweather'"; // Massively increased
    ctx.fillText(String(monthDay), 45, 240); // Tightly nested

    // 2. Stats Grid (Top Right)
    ctx.textAlign = 'left';

    const drawGridItem = (x: number, y: number, label: string, value: string, unit: string) => {
        // Label
        ctx.font = "900 26px 'Plus Jakarta Sans'"; // Much larger labels
        ctx.globalAlpha = 1.0; // PURE SOLID
        ctx.fillText(label.toUpperCase(), x, y);

        // Value with Smart Scaling
        ctx.globalAlpha = 1.0; // PURE SOLID
        const baseSize = 55; // Much larger values
        ctx.font = `900 ${baseSize}px 'Merriweather'`;

        let fontSize = baseSize;
        const maxW = 260; // Grid column limit
        let valWidth = ctx.measureText(value).width;

        if (valWidth > maxW) {
            fontSize = Math.floor(baseSize * (maxW / valWidth));
            ctx.font = `900 ${fontSize}px 'Merriweather'`;
            valWidth = ctx.measureText(value).width;
        }

        ctx.fillText(value, x, y + 35);

        // Unit
        if (unit) {
            ctx.font = "900 24px 'Plus Jakarta Sans'"; // Larger units
            ctx.fillText(unit, x + valWidth + 8, y + 55);
        }
    };

    // Find Elevation in dataPoints
    const elevPoint = stats.dataPoints?.find((p: any) => p.label.toLowerCase().includes('elevation')) || { value: '0', unit: 'm' };

    // HR Logic: Explicitly prioritize Avg over Max for the Journal entry
    const hrPoint = stats.dataPoints?.find((p: any) => p.label.toLowerCase().includes('avg')) ||
        { value: stats.avgHeartrate || (stats.dataPoints?.find((p: any) => p.label.includes('HR'))?.value) || '-', unit: 'bpm' };

    const paceLabel = sport === 'Ride' ? 'AVG. SPEED' : 'PACE';
    const paceUnit = sport === 'Ride' ? 'km/h' : '/km';

    // Row 1: Distance | Pace
    drawGridItem(gridX, gridY, "DISTANCE", stats.distanceVal || "0.00", "km");
    drawGridItem(col2X, gridY, paceLabel, (stats.subValue || "").split(' ')[0] || "0:00", paceUnit);

    // Row 2: Moving Time | Elevation
    drawGridItem(gridX, gridY + rowHeight, "TIME", stats.timeStr || "0:00", "");
    drawGridItem(col2X, gridY + rowHeight, "ELEVATION", elevPoint.value, "m");

    // Row 3: Location | bpm
    const locationStr = stats.location?.length > 15 ? stats.location.slice(0, 15) + "…" : stats.location;
    drawGridItem(gridX, gridY + rowHeight * 2, "LOCATION", locationStr || "Scora", "");
    drawGridItem(col2X, gridY + rowHeight * 2, "HEART RATE", hrPoint.value, "bpm");

    // 3. Map (Top-Right Pocket - under stats)
    if (stats.polyline) {
        ctx.shadowBlur = 0; // Disable shadow for map to keep it clean
        ctx.shadowOffsetY = 0;

        const mapSize = 450;
        const mapX = 780;
        const mapY = 650;

        // Draw map with slightly thicker stroke
        drawRoutePath(ctx, stats.polyline, mapX, mapY, mapSize, {
            color: lineColor,
            strokeWidth: 9
        });
    }

    ctx.restore();
}

// ─── Race Day / Finish Line Sticker (Studio Precision v3.0) ──────────────────

export function drawFinishLine(ctx: CanvasRenderingContext2D, stats: any, textColor: string) {
    const canvasW = 1080;
    const canvasH = 1920;
    const cx = canvasW / 2;
    const cy = canvasH / 2;

    const lineColor = textColor.startsWith('#') ? textColor : (textColor === 'black' ? '#000000' : '#ffffff');
    const isDark = isColorDark(lineColor);

    ctx.save();

    // 1. Clock Backplate (Industrial liquid glass, permanently dark)
    const boxW = 920;
    const boxH = 420;
    const boxY = cy - 100;

    // Deep shadow for glass depth
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur = 50;
    // Permanently dark liquid glass background
    ctx.fillStyle = 'rgba(0,0,0,0.8)';
    ctx.beginPath();
    ctx.roundRect(cx - boxW / 2, boxY - boxH / 2, boxW, boxH, 210); // Full pill shape (boxH / 2)
    ctx.fill();

    // Gloss/Bevel effect (liquid glass edge)
    ctx.strokeStyle = 'rgba(255,255,255,0.15)'; // Crisp white reflection on the edge
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // 2. The Time (LED/Dot Matrix)
    const timeVal = stats.timeStr || "0:00:00";
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = lineColor;

    // Apply Neon Glow for 'Next Level' aesthetic
    ctx.shadowColor = lineColor;
    // Since background is ALWAYS dark, we can ALWAYS apply the glow, even if lineColor is black (though black glow is subtle)
    ctx.shadowBlur = isDark ? 10 : 25;

    let timeFontSize = timeVal.length > 7 ? 160 : 230;
    const safeW = 820; // Internal padding safety

    // Width-Aware scaling loop for handwriting integrity
    ctx.font = `400 ${timeFontSize}px 'Bitcount Single'`;
    (ctx as any).letterSpacing = "0px"; // Bitcount Single doesn't need wide tracking
    let measuredW = ctx.measureText(timeVal).width;

    while (measuredW > safeW && timeFontSize > 60) {
        timeFontSize -= 4;
        ctx.font = `400 ${timeFontSize}px 'Bitcount Single'`;
        measuredW = ctx.measureText(timeVal).width;
    }

    ctx.fillText(timeVal, cx, boxY);
    (ctx as any).letterSpacing = "0px";

    ctx.shadowBlur = 0; // Disable glow for secondary text

    // 3. Labels (Studio Precision Branding)
    ctx.save();
    ctx.font = "900 28px 'Plus Jakarta Sans'"; // Bolder and larger for emphasis
    // If the line color is dark, the text inside the dark pill might be hard to read!
    // But user only requested preserving dark background. We assume they will use a light text color when using this sticker.
    ctx.fillStyle = lineColor;
    ctx.globalAlpha = 0.85; // Brighter for impact
    ctx.letterSpacing = "15px"; // Wide cinematic tracking
    ctx.fillText("FINISH TIME", cx, boxY - (boxH / 2) + 55);
    ctx.restore();

    // 4. Secondary Metrics (Distance & Pace)
    // Push the bottom metrics slightly lower if we make the text bigger
    const metricsY = boxY + (boxH / 2) + 120;
    const distVal = stats.distanceVal || "0.00";
    const paceVal = (stats.subValue || "").split(' ')[0] || "0:00";
    const paceUnit = normalizeSport(stats.type) === 'Ride' ? 'km/h' : '/km';

    const drawSubMetric = (val: string, label: string, offset: number) => {
        ctx.save();
        ctx.translate(cx + offset, metricsY);

        ctx.textAlign = 'center';
        ctx.fillStyle = lineColor;

        // Value
        ctx.font = "400 90px 'Bitcount Single'";
        ctx.textBaseline = 'bottom'; // Lock numbers to the bottom
        (ctx as any).letterSpacing = "10px";
        ctx.fillText(val, 0, 0);
        (ctx as any).letterSpacing = "0px";

        // Label
        // Universal Readability Rule: Min 36px font, Min 90% opacity
        ctx.font = "700 36px 'Plus Jakarta Sans'"; // Increased from 22px
        ctx.textBaseline = 'top'; // Push label down from the number's baseline
        ctx.globalAlpha = 0.9; // Increased from 0.6
        ctx.letterSpacing = "6px";
        ctx.fillText(label.toUpperCase(), 0, 25); // Increased buffer slightly

        ctx.restore();
    };

    drawSubMetric(distVal, "DISTANCE (KM)", -240);
    drawSubMetric(paceVal, `AVG. ${normalizeSport(stats.type) === 'Ride' ? 'SPEED' : 'PACE'}`, 240);

    ctx.restore();
}

/**
 * ULTRA DETAIL — Clean, mapless design with details stacked under the Scora logo.
 * Inspired by the "vibrant minimalist" aesthetic.
 */
export function drawUltraDetail(ctx: CanvasRenderingContext2D, stats: any, textColor: string) {
    const { solid, trans, label: labelColor, accent: accentColor } = buildColors(textColor);

    ctx.save();

    // Bounding box dimensions under the logo
    const w = 920;
    const h = 240;
    const startX = 80;
    const startY = 180;
    const centerY = startY + h / 2;
    const r = 24;

    // 1. Draw Glassmorphic Card Background
    ctx.beginPath();
    ctx.roundRect(startX, startY, w, h, r);
    ctx.fillStyle = textColor === 'black' ? 'rgba(255, 255, 255, 0.85)' : 'rgba(28, 28, 30, 0.75)';
    ctx.fill();
    ctx.strokeStyle = textColor === 'black' ? 'rgba(0, 0, 0, 0.12)' : 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Subtle colored left accent stripe inside the card
    ctx.fillStyle = accentColor;
    ctx.beginPath();
    ctx.roundRect(startX + 15, startY + 20, 8, h - 40, 4);
    ctx.fill();

    // Determine values
    const isWorkout = stats.type?.toLowerCase().includes('workout') || stats.type?.toLowerCase().includes('training') || stats.type?.toLowerCase().includes('gym') || !stats.hasDistance;
    const isRide = stats.type === 'Ride' || stats.type === 'EBikeRide';

    // ── 1. Hero Block (Primary Metric) ──────────────────
    let heroValue = stats.distanceVal || '0.00';
    let heroUnit = (stats.distanceUnit || 'KM').toUpperCase();
    if (heroUnit === 'KILOMETERS') heroUnit = 'KM';
    if (heroUnit === 'MILES') heroUnit = 'MI';

    if (isWorkout) {
        heroValue = stats.timeStr || '0m';
        heroUnit = 'DURATION';
    }

    // ── 2. Metric 1 (Pace / HR) ─────────────────────────
    let m1Value = '';
    let m1Unit = '';
    let m1Label = '';

    if (isWorkout) {
        m1Value = stats.avgHeartrate ? String(stats.avgHeartrate) : (stats.calories ? String(stats.calories) : '0');
        m1Unit = stats.avgHeartrate ? 'BPM' : 'KCAL';
        m1Label = stats.avgHeartrate ? 'AVG HEART RATE' : 'CALORIES';
    } else {
        m1Value = (stats.subValue || '').split(' ')[0] || '0:00';
        m1Unit = isRide ? 'KM/H' : '/KM';
        m1Label = isRide ? 'AVG. SPEED' : 'PACE';
    }

    // ── 3. Metric 2 (Duration / Calories / Date) ────────
    let m2Value = '';
    let m2Unit = '';
    let m2Label = '';

    if (isWorkout) {
        m2Value = stats.calories ? String(stats.calories) : (stats.date || 'TODAY');
        m2Unit = stats.calories ? 'KCAL' : '';
        m2Label = stats.calories ? 'CALORIES' : 'DATE';
    } else {
        const fullTime = stats.timeStr || '0m';
        if (fullTime.includes('h')) {
            m2Value = fullTime.toUpperCase();
            m2Unit = '';
        } else {
            m2Value = fullTime.replace(/[a-zA-Z]+$/, '').trim();
            m2Unit = (fullTime.match(/[a-zA-Z]+$/)?.[0] || 'm').toUpperCase();
        }
        m2Label = 'TOTAL DURATION';
    }

    // Clear shadow settings for background partitions
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    // Draw dividers
    ctx.beginPath();
    ctx.moveTo(startX + 370, startY + 40);
    ctx.lineTo(startX + 370, startY + h - 40);
    ctx.moveTo(startX + 650, startY + 40);
    ctx.lineTo(startX + 650, startY + h - 40);
    ctx.strokeStyle = textColor === 'black' ? 'rgba(0, 0, 0, 0.08)' : 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Now, apply the premium anti-ghosting shadows for text rendering
    applyAntiGhostingShadow(ctx, textColor);

    // Left Column X: startX + 45
    const col1X = startX + 45;
    // Middle Column X: startX + 400
    const col2X = startX + 400;
    // Right Column X: startX + 680
    const col3X = startX + 680;

    ctx.textAlign = 'left';

    // ───────────────── COLUMN 1: HERO ─────────────────
    // Label
    ctx.font = "800 13px 'Outfit'";
    ctx.fillStyle = accentColor;
    setLetterSpacing(ctx, '2px');
    ctx.textBaseline = 'middle';
    ctx.fillText(heroUnit, col1X, centerY - 50);
    setLetterSpacing(ctx, '0px');

    // Value
    let heroFontSize = 76;
    if (heroValue.length > 5) heroFontSize = 64;
    if (heroValue.length > 7) heroFontSize = 52;
    ctx.font = `normal 900 ${heroFontSize}px 'Russo One'`;
    ctx.fillStyle = textColor;
    ctx.fillText(heroValue, col1X, centerY + 15);

    // ───────────────── COLUMN 2: METRIC 1 ─────────────
    // Label
    ctx.font = "800 13px 'Outfit'";
    ctx.fillStyle = accentColor;
    setLetterSpacing(ctx, '2px');
    ctx.fillText(m1Label, col2X, centerY - 50);
    setLetterSpacing(ctx, '0px');

    // Value + Unit
    ctx.font = "normal 900 56px 'Russo One'";
    ctx.fillStyle = textColor;
    ctx.fillText(m1Value, col2X, centerY + 15);
    const m1ValW = ctx.measureText(m1Value).width;
    if (m1Unit) {
        ctx.font = "800 20px 'Outfit'";
        ctx.fillStyle = accentColor;
        ctx.fillText(m1Unit, col2X + m1ValW + 8, centerY + 25);
    }

    // ───────────────── COLUMN 3: METRIC 2 ─────────────
    // Label
    ctx.font = "800 13px 'Outfit'";
    ctx.fillStyle = accentColor;
    setLetterSpacing(ctx, '2px');
    ctx.fillText(m2Label, col3X, centerY - 50);
    setLetterSpacing(ctx, '0px');

    // Value + Unit
    ctx.font = "normal 900 56px 'Russo One'";
    ctx.fillStyle = textColor;
    ctx.fillText(m2Value, col3X, centerY + 15);
    const m2ValW = ctx.measureText(m2Value).width;
    if (m2Unit) {
        ctx.font = "800 20px 'Outfit'";
        ctx.fillStyle = accentColor;
        ctx.fillText(m2Unit, col3X + m2ValW + 8, centerY + 25);
    }

    ctx.restore();
}

/**
 * 📝 NOTE MINIMAL (Stickers 4.0)
 * Aesthetic: A clean digital one-liner journal entry.
 * Features: Unified narrative (distance, pace, duration) with a gold cursor.
 * Philosophy: "Athletic data as a single-line memory."
 */
export function drawNoteSticker(ctx: CanvasRenderingContext2D, stats: any, textColor: string) {
    const textCol = '#1a1a1a'; // Force professional dark gray for white background contrast

    // 1. Narrative Formatting (Smart Fallback Protocol)
    const sport = normalizeSport(stats.type || stats.activityType || 'Run');
    let narrative = "";

    const distVal = stats.distanceVal || '0.00';
    const time = stats.timeStr || '0m';
    const pace = (stats.subValue || '').split(' ')[0] || '0:00';
    const hasDistance = parseFloat(distVal) > 0;

    if (hasDistance) {
        if (sport === 'Swim') {
            const meters = Math.round(parseFloat(distVal) * 1000);
            narrative = `${meters}m swim in ${time} at ${pace} pace`;
        } else if (sport === 'Ride') {
            narrative = `${distVal} km at ${pace} km/h speed in ${time}`;
        } else {
            // Run, Walk, Hike, or Generic Distance activity
            narrative = `${distVal} km at ${pace} pace in ${time}`;
        }
    } else {
        // Training / Workout / Gym / Ski (Missing Distance)
        const hr = stats.avgHeartrate ? ` at ${stats.avgHeartrate} bpm` : "";
        narrative = `${time} ${sport}${hr}`;
    }

    ctx.save();
    ctx.textBaseline = 'middle';
    ctx.font = `500 42px 'Elms Sans'`;

    const textWidth = ctx.measureText(narrative).width;
    const paddingX = 45;

    // Positioning: Under Scora logo (Top Left alignment)
    const xStart = 80;
    const yCenter = 210;

    // 2. White Background "Note" Card (Precision Replication)
    ctx.save();
    ctx.fillStyle = "#ffffff";

    // Subtle professional shadow
    ctx.shadowColor = 'rgba(0,0,0,0.12)';
    ctx.shadowBlur = 30;
    ctx.shadowOffsetY = 8;

    const rectW = textWidth + (paddingX * 2) + 20; // Extra room for cursor
    const rectH = 85; // Fixed height for consistency
    const rectX = xStart;
    const rectY = yCenter - rectH / 2;

    ctx.beginPath();
    ctx.roundRect(rectX, rectY, rectW, rectH, 8);
    ctx.fill();
    ctx.restore();

    // 3. Draw Text
    ctx.textAlign = 'left';
    ctx.fillStyle = textCol;
    ctx.fillText(narrative, rectX + paddingX, yCenter + 2); // Slight Y offset for visual balance

    // 4. The Cursor (#eab308)
    ctx.fillStyle = '#eab308';
    ctx.fillRect(rectX + paddingX + textWidth + 12, yCenter - 26, 5, 52);

    ctx.restore();
}

/**
 * SCORA V18 "NOTE ACCENT" (The Stepped Dimension Style)
 * 
 * Aesthetic: A minimalist "callout" with blue accents, stepped lines, and a 
 * semi-transparent background box. Reuses Note-Minimal data.
 */
export function drawNoteAccentSticker(ctx: CanvasRenderingContext2D, stats: any, textColor: string) {
    // 1. Color Logic (Dynamic Accent Support)
    const isHex = textColor.startsWith('#');
    const accentColor = isHex ? textColor : '#4f46e5';
    const rgb = hexToRgb(accentColor);

    // For the text itself, we use solid white or black depending on the background contrast
    // but the user's "selected text" background uses the accent.
    const isDark = isColorDark(accentColor);
    const textCol = isDark ? '#ffffff' : (textColor === 'black' ? '#000000' : '#ffffff');

    // 2. Narrative Formatting (Standard Note Data)
    const sport = normalizeSport(stats.type || stats.activityType || 'Run');
    let narrative = "";

    const distVal = stats.distanceVal || '0.00';
    const time = stats.timeStr || '0m';
    const pace = (stats.subValue || '').split(' ')[0] || '0:00';
    const hasDistance = parseFloat(distVal) > 0;

    if (hasDistance) {
        if (sport === 'Swim') {
            const meters = Math.round(parseFloat(distVal) * 1000);
            narrative = `${meters}m swim in ${time} at ${pace} pace`;
        } else if (sport === 'Ride') {
            narrative = `${distVal} km at ${pace} km/h speed in ${time}`;
        } else {
            narrative = `${distVal} km at ${pace} pace in ${time}`;
        }
    } else {
        const hr = stats.avgHeartrate ? ` at ${stats.avgHeartrate} bpm` : "";
        narrative = `${time} ${sport}${hr}`;
    }

    ctx.save();

    // 3. Measuring & Layout
    ctx.font = `500 44px 'Plus Jakarta Sans'`;
    ctx.textBaseline = 'alphabetic';
    const textWidth = ctx.measureText(narrative).width;

    const paddingX = 40;
    const boxHeight = 110;
    const boxWidth = textWidth + (paddingX * 2);

    const xStart = 100;
    const yBaseline = 400; // Moved down to avoid overlapping Scora logo

    const xL = xStart;
    const xR = xStart + boxWidth;

    const markerOffset = 45; // Much closer to the box as per reference
    const boxY = yBaseline - boxHeight / 2;
    const boxBottom = boxY + boxHeight;

    const yTop = boxY - markerOffset + 15;
    const yBottom = boxBottom + markerOffset - 15;
    const circleRadius = 26;

    // 4. Draw Background Box (Selected Text Opacity)
    ctx.fillStyle = `rgba(${rgb}, 0.45)`;
    ctx.fillRect(xL, boxY, boxWidth, boxHeight);

    // 5. Draw Markers (Separated Vertical Bars)
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';

    // Left Marker: Circle at top, line down to selection bottom
    ctx.beginPath();
    ctx.moveTo(xL, yTop);
    ctx.lineTo(xL, boxBottom);
    ctx.stroke();

    // Right Marker: Circle at bottom, line up to selection top
    ctx.beginPath();
    ctx.moveTo(xR, yBottom);
    ctx.lineTo(xR, boxY);
    ctx.stroke();

    // 6. Draw Marker Circles
    ctx.fillStyle = accentColor;

    // Start Marker (Top)
    ctx.beginPath();
    ctx.arc(xL, yTop, circleRadius, 0, Math.PI * 2);
    ctx.fill();

    // End Marker (Bottom)
    ctx.beginPath();
    ctx.arc(xR, yBottom, circleRadius, 0, Math.PI * 2);
    ctx.fill();

    // 7. Draw Narrative Text
    ctx.fillStyle = textCol;
    ctx.textAlign = 'left';

    // Professional shadow for high-contrast legibility
    ctx.shadowColor = 'rgba(0,0,0,0.15)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 2;

    // Center text vertically in the box
    ctx.textBaseline = 'middle';
    ctx.fillText(narrative, xL + paddingX, yBaseline + 2);

    // 8. SCORA V18 "ACTION MENU" (The Floating Context Menu)
    // Replicating the "Liquid Glass Effect" (Glossy Gradient + Specular Highlights + Beveled Edge)
    ctx.restore();
    ctx.save();

    const menuW = 920;
    const menuH = 135;
    const menuX = 540 - (menuW / 2);
    const menuY = yBaseline + 160;

    // A. Outer Shadow
    ctx.shadowColor = 'rgba(0,0,0,0.3)';
    ctx.shadowBlur = 35;
    ctx.shadowOffsetY = 15;

    // B. Base Liquid Glass Gradient Fill
    const baseGrad = ctx.createLinearGradient(menuX, menuY, menuX, menuY + menuH);
    const isLightTheme = textColor === 'black';
    if (isLightTheme) {
        baseGrad.addColorStop(0, 'rgba(255, 255, 255, 0.80)');
        baseGrad.addColorStop(0.3, 'rgba(255, 255, 255, 0.50)');
        baseGrad.addColorStop(1, 'rgba(240, 240, 245, 0.60)');
    } else {
        baseGrad.addColorStop(0, 'rgba(60, 60, 65, 0.65)');
        baseGrad.addColorStop(0.3, 'rgba(30, 30, 35, 0.45)');
        baseGrad.addColorStop(1, 'rgba(15, 15, 20, 0.55)');
    }

    ctx.fillStyle = baseGrad;
    ctx.beginPath();
    ctx.roundRect(menuX, menuY, menuW, menuH, menuH / 2);
    ctx.fill();

    // Disable shadow for internal drawings to avoid double-shadowing
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    // C. Specular Highlight / Glossy Top Half
    ctx.save();
    // Clip to the menu path so highlight doesn't bleed out
    ctx.beginPath();
    ctx.roundRect(menuX, menuY, menuW, menuH, menuH / 2);
    ctx.clip();

    const glossGrad = ctx.createLinearGradient(menuX, menuY, menuX, menuY + menuH / 2);
    glossGrad.addColorStop(0, isLightTheme ? 'rgba(255, 255, 255, 0.6)' : 'rgba(255, 255, 255, 0.35)');
    glossGrad.addColorStop(1, 'rgba(255, 255, 255, 0.0)');
    ctx.fillStyle = glossGrad;
    ctx.fillRect(menuX, menuY, menuW, menuH / 2);
    ctx.restore();

    // D. Glossy Beveled Edge (Gradient Stroke)
    const borderGrad = ctx.createLinearGradient(menuX, menuY, menuX, menuY + menuH);
    if (isLightTheme) {
        borderGrad.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
        borderGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.5)');
        borderGrad.addColorStop(1, 'rgba(0, 0, 0, 0.15)');
    } else {
        borderGrad.addColorStop(0, 'rgba(255, 255, 255, 0.5)');
        borderGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.2)');
        borderGrad.addColorStop(1, 'rgba(0, 0, 0, 0.4)');
    }
    ctx.strokeStyle = borderGrad;
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Draw Subtle Dividers
    const dividerColor = isLightTheme ? 'rgba(0, 0, 0, 0.08)' : 'rgba(255, 255, 255, 0.1)';
    ctx.strokeStyle = dividerColor;
    ctx.lineWidth = 2;

    const items = ['Cut', 'Copy', 'Paste', 'AutoFill'];
    const sectionW = (menuW - 120) / items.length;

    for (let i = 1; i < items.length; i++) {
        const dX = menuX + (i * sectionW) + 20;
        ctx.beginPath();
        ctx.moveTo(dX, menuY + 35);
        ctx.lineTo(dX, menuY + menuH - 35);
        ctx.stroke();
    }

    // Draw Menu Labels
    const labelColor = isLightTheme ? '#111111' : '#ffffff';
    ctx.fillStyle = labelColor;
    ctx.font = `500 42px 'Plus Jakarta Sans'`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    items.forEach((item, i) => {
        const tX = menuX + (i * sectionW) + (sectionW / 2) + 20;
        ctx.fillText(item, tX, menuY + (menuH / 2));
    });

    // Draw the Selection Arrow (Symmetric section)
    ctx.font = `600 48px 'Plus Jakarta Sans'`;
    ctx.fillText('>', menuX + menuW - 65, menuY + (menuH / 2) - 2);

    ctx.restore();
}

/**
 * 💬 SOCIAL CHAT (Stickers 4.0)
 * Aesthetic: A WhatsApp-style conversation flow.
 * Features: Multi-bubble conversation + Optional Map Image message.
 * Philosophy: "Athletic data as a personal share."
 */
export function drawChatSticker(ctx: CanvasRenderingContext2D, stats: any, textColor: string) {
    const bubbleOther = '#1f2c33'; // WA Dark: Other
    const bubbleUser = '#005c4b';  // WA Dark: User
    const textCol = '#e9edef';
    const timestampCol = 'rgba(255,255,255,0.4)';

    const dist = stats.distanceVal || '0.00';
    const pace = (stats.subValue || '').split(' ')[0] || '0:00';
    const time = stats.timeStr || '0h 00m';
    const startTime = stats.startTime || '12:00';
    const hr = stats.heartRate || stats.avgHR || null;

    const sport = normalizeSport(stats.type || stats.activityType || 'Run');
    const sportLower = sport.toLowerCase();
    let activityVerb = 'Running';
    if (sportLower === 'ride' || sportLower === 'bike') activityVerb = 'Riding';
    else if (sportLower === 'swim') activityVerb = 'Swimming';
    else if (sportLower === 'workout' || sportLower === 'training' || sportLower === 'gym') activityVerb = 'Training';

    const location = stats.location && stats.location !== 'Unknown' ? ` in ${stats.location}` : "";

    const intensityLabel = (sportLower === 'ride' || sportLower === 'bike') ? 'Speed' : 'Pace';
    const intensityUnit = (sportLower === 'ride' || sportLower === 'bike') ? ' km/hr' : ' /km';

    // Conversation Flow (Smart Fallback Logic)
    let messages = [];
    if (stats.hasDistance) {
        messages = [
            { text: `${activityVerb} for ${dist} km${location}`, side: 'left' as const, bg: bubbleOther },
            { text: `${intensityLabel}: ${pace}${intensityUnit}`, side: 'right' as const, bg: bubbleUser },
            { text: `During ${time}`, side: 'left' as const, bg: bubbleOther }
        ];
    } else {
        messages = [
            { text: `${activityVerb}${location}`, side: 'left' as const, bg: bubbleOther },
            { text: hr ? `Heart rate: ${hr} bpm` : "Good sweat session! 🔥", side: 'right' as const, bg: bubbleUser },
            { text: `During ${time}`, side: 'left' as const, bg: bubbleOther }
        ];
    }

    let currentY = 320;
    const spacing = 140;

    messages.forEach(msg => {
        drawWABubble(ctx, msg.text, msg.side, currentY, msg.bg, textCol, timestampCol, startTime);
        currentY += spacing;
    });

    // Optional Map Bubble (Always from User / Right)
    if (stats.polyline) {
        currentY += 20;
        drawWAMapBubble(ctx, stats.polyline, 'right', currentY, bubbleUser, timestampCol, startTime);
        currentY += 500; // Map height is 480 + gap
    }

    // 3. WhatsApp Bottom Input Bar (Positioned closely under last message)
    drawWAInput(ctx, currentY + 40);
}

function drawWABubble(ctx: CanvasRenderingContext2D, text: string, side: 'left' | 'right', y: number, bg: string, color: string, tsCol: string, time: string) {
    ctx.save();
    ctx.font = "400 36px 'Plus Jakarta Sans'";
    const textWidth = ctx.measureText(text).width;
    const bubbleW = Math.max(220, textWidth + (side === 'right' ? 180 : 140));
    const bubbleH = 95;
    const x = side === 'left' ? 70 : 1010 - bubbleW;

    // Bubble Body
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.roundRect(x, y, bubbleW, bubbleH, 18);
    ctx.fill();

    // Tail
    ctx.beginPath();
    if (side === 'left') {
        ctx.moveTo(x + 15, y);
        ctx.lineTo(x - 12, y);
        ctx.lineTo(x, y + 25);
    } else {
        ctx.moveTo(x + bubbleW - 15, y);
        ctx.lineTo(x + bubbleW + 12, y);
        ctx.lineTo(x + bubbleW, y + 25);
    }
    ctx.fill();

    // Main Text (Better Centering)
    ctx.fillStyle = color;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x + 35, y + bubbleH / 2);

    // Timestamp
    ctx.fillStyle = tsCol;
    ctx.font = "400 20px 'Plus Jakarta Sans'";
    ctx.textAlign = 'right';
    const tsX = x + bubbleW - 25;
    ctx.fillText(time, tsX, y + bubbleH - 20);

    ctx.restore();
}

function drawWAMapBubble(ctx: CanvasRenderingContext2D, polyline: string, side: 'left' | 'right', y: number, bg: string, tsCol: string, time: string) {
    const bubbleW = 480;
    const bubbleH = 480;
    const x = side === 'left' ? 70 : 1010 - bubbleW;

    ctx.save();
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.roundRect(x, y, bubbleW, bubbleH, 18);
    ctx.fill();

    // Tail
    ctx.beginPath();
    ctx.moveTo(x + bubbleW - 15, y);
    ctx.lineTo(x + bubbleW + 12, y);
    ctx.lineTo(x + bubbleW, y + 25);
    ctx.fill();

    // Inner Map
    const margin = 12;
    const mapW = bubbleW - margin * 2;
    const mapH = bubbleH - margin * 2 - 45;
    ctx.fillStyle = '#0b141a';
    ctx.beginPath();
    ctx.roundRect(x + margin, y + margin, mapW, mapH, 12);
    ctx.fill();

    const coords = decodePolyline(polyline);
    if (coords.length > 1) {
        let minLat = coords[0][0], maxLat = minLat, minLng = coords[0][1], maxLng = minLng;
        coords.forEach(p => {
            if (p[0] < minLat) minLat = p[0]; if (p[0] > maxLat) maxLat = p[0];
            if (p[1] < minLng) minLng = p[1]; if (p[1] > maxLng) maxLng = p[1];
        });
        const scale = Math.min((mapW - 60) / (maxLng - minLng), (mapH - 60) / (maxLat - minLat));
        const centerX = x + margin + mapW / 2;
        const centerY = y + margin + mapH / 2;

        ctx.save();
        ctx.beginPath();
        ctx.strokeStyle = '#25d366';
        ctx.lineWidth = 6;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        coords.forEach((p, i) => {
            const px = centerX + (p[1] - (minLng + maxLng) / 2) * scale;
            const py = centerY - (p[0] - (minLat + maxLat) / 2) * scale;
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        });
        ctx.stroke();
        ctx.restore();
    }

    // Timestamp
    ctx.fillStyle = tsCol;
    ctx.font = "400 20px 'Plus Jakarta Sans'";
    ctx.textAlign = 'right';
    ctx.fillText(time, x + bubbleW - 25, y + bubbleH - 20);

    ctx.restore();
}


function drawWAInput(ctx: CanvasRenderingContext2D, y: number) {
    ctx.save();
    const barH = 105;
    const barW = 940; // Wider bar for minimalist look
    const barX = 70;

    // 1. Dark Background for Input Bar
    ctx.fillStyle = '#1f2c33';
    ctx.beginPath();
    ctx.roundRect(barX, y, barW, barH, 50);
    ctx.fill();

    // 2. Icons & Text
    // Smiley (Left)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.lineWidth = 4;
    const smileyX = barX + 55;
    const midY = y + barH / 2;
    ctx.beginPath();
    ctx.arc(smileyX, midY, 22, 0, Math.PI * 2);
    ctx.stroke();
    // Tiny eyes
    ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.fillRect(smileyX - 8, midY - 8, 4, 4);
    ctx.fillRect(smileyX + 4, midY - 8, 4, 4);
    // Smile
    ctx.beginPath();
    ctx.arc(smileyX, midY, 12, 0.1 * Math.PI, 0.9 * Math.PI);
    ctx.stroke();

    // Placeholder "Message"
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.font = "400 36px 'Plus Jakarta Sans'";
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText("Message", barX + 115, midY);

    ctx.restore();
}

/**
 * Image 1: BOLD DAY
 * Audiowide font, massive centered numbers, auto-scaling.
 * WORKOUT FALLBACK: If distance is 0, show Calories or Duration.
 */
export function drawBoldDay(ctx: CanvasRenderingContext2D, stats: any, textColor: string) {
    const mainFont = "'Audiowide', cursive";
    const sysFont = "'Plus Jakarta Sans', sans-serif";
    const day = (stats.dayName || 'SUNDAY').toUpperCase();

    // Workout Detection
    const isWorkoutType = stats.type?.toLowerCase().includes('workout') || stats.type?.toLowerCase().includes('training') || stats.type?.toLowerCase().includes('gym');
    const hasDist = !isWorkoutType && stats.distanceVal && parseFloat(stats.distanceVal) > 0.1;
    let distText = `${stats.distanceVal || '0.00'}KM`;
    let label = day;

    if (!hasDist) {
        distText = stats.calories && stats.calories !== '0' ? `${stats.calories} KCAL` : (stats.timeStr || 'WORKOUT').toUpperCase();
    }

    const cx = 540;
    const cy = 280; // Shifted down globally to avoid SCORA logo

    ctx.save();
    ctx.translate(cx, cy);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = textColor;

    // Day of Week / Activity (Top)
    ctx.font = `800 45px ${sysFont}`;
    if (typeof ctx.letterSpacing !== 'undefined') ctx.letterSpacing = "15px";
    ctx.globalAlpha = 0.85;
    ctx.fillText(label, 0, -100); // Pushed further up from the data for more breathing room
    ctx.letterSpacing = "0px";

    // Distance (Bottom - MASSIVE & Scaling)
    let fontSize = 220;
    ctx.font = `900 ${fontSize}px ${mainFont}`;

    // Auto-scaling loop to use entire width
    while (ctx.measureText(distText).width > 960 && fontSize > 80) {
        fontSize -= 5;
        ctx.font = `900 ${fontSize}px ${mainFont}`;
    }

    ctx.globalAlpha = 1.0;
    ctx.fillText(distText, 0, 100); // Pushed further down from the label

    ctx.restore();
}

/**
 * Image 3: STUDIO PRECISION
 * Unified Boldonse aesthetic, massive hero metric.
 * WORKOUT FALLBACK: Duration as hero.
 * BIKE FIX: Increased spacing and dynamic column widths.
 */
export function drawStudioPrecision(ctx: CanvasRenderingContext2D, stats: any, textColor: string) {
    const mainFont = "'Archivo Black', sans-serif";

    // Workout Detection
    const isBike = (stats.type || '').toLowerCase().includes('ride') || (stats.type || '').toLowerCase().includes('bike');
    const isWorkoutType = stats.type?.toLowerCase().includes('workout') || stats.type?.toLowerCase().includes('training') || stats.type?.toLowerCase().includes('gym');
    const hasDist = !isWorkoutType && stats.distanceVal && parseFloat(stats.distanceVal) > 0.1;

    let heroText = `${stats.distanceVal || '0.00'}KM`;
    if (!hasDist) {
        heroText = stats.calories && stats.calories !== '0' ? `${stats.calories} KCAL` : (stats.timeStr || '0:00');
    }

    const startX = 60;
    const endX = 1020;
    // Push the hero metric as high up as possible to minimize vertical footprint
    const startY = 220;

    ctx.save();
    ctx.fillStyle = textColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    // Hero Metric - Maximize Horizontal Width exactly to 960px
    ctx.font = `400 100px ${mainFont}`;
    const baseW = ctx.measureText(heroText).width;
    let fontSize = Math.floor(100 * (960 / baseW));

    ctx.font = `400 ${fontSize}px ${mainFont}`;

    // Fallback logic for Safari baseline issues if needed, but top works best for Archivo Black
    ctx.fillText(heroText, 540, startY);

    // Sub-metrics
    const elevPoint = stats.dataPoints?.find(p => p.label.toUpperCase() === 'ELEVATION');
    const elevVal = elevPoint ? `${elevPoint.value}${elevPoint.unit}`.toUpperCase() : '0M';
    const calVal = stats.calories && stats.calories !== '0' ? `${stats.calories} KCAL` : '0 KCAL';

    let metrics: { label: string; val: string }[] = [];

    if (hasDist) {
        let metric1Val = (stats.subValue || '0:00').toUpperCase();
        let metric1Label = isBike ? 'SPEED' : 'PACE';

        if ((stats.type || '').toLowerCase().includes('workout') || (stats.type || '').toLowerCase().includes('training')) {
            metric1Val = stats.calories && stats.calories !== '0' ? `${stats.calories} KCAL` : metric1Val;
            metric1Label = stats.calories && stats.calories !== '0' ? 'CALORIES' : metric1Label;
        }

        const hrVal = stats.avgHeartrate ? `${stats.avgHeartrate}BPM` : elevVal;
        const hrLabel = stats.avgHeartrate ? 'HEART RATE' : 'ALTITUDE';
        metrics = [
            { label: metric1Label, val: metric1Val },
            { label: 'DURATION', val: (stats.timeStr || '0:00').toUpperCase() },
            { label: hrLabel, val: hrVal }
        ];
    } else {
        const heroIsCalories = heroText.includes('KCAL');
        const timeVal = (stats.startTime || '--:--').toUpperCase();
        const secondaryVal = heroIsCalories ? (stats.timeStr || '0:00').toUpperCase() : timeVal;
        const secondaryLabel = heroIsCalories ? 'DURATION' : 'START TIME';

        metrics = [
            { label: secondaryLabel, val: secondaryVal },
            { label: 'HEART RATE', val: stats.avgHeartrate ? `${stats.avgHeartrate}BPM` : '-' },
            { label: 'TYPE', val: normalizeSport(stats.type || 'GYM').toUpperCase() }
        ];
    }

    // Collapse vertical space by squeezing exactly beneath the visual height of Archivo Black (approx 75%)
    const rowY = startY + (fontSize * 0.75) + 30;
    const colW = (endX - startX) / 3;

    metrics.forEach((m, i) => {
        let x = startX + (i * colW) + (colW / 2);
        if (isBike && i === 0) x -= 20;
        if (isBike && i === 1) x += 20;

        ctx.globalAlpha = 0.8;
        ctx.font = `400 24px ${mainFont}`;
        ctx.textBaseline = 'top';
        ctx.fillText(m.label, x, rowY);

        ctx.globalAlpha = 1.0;
        let mSize = 68;
        ctx.font = `400 ${mSize}px ${mainFont}`;

        while (ctx.measureText(m.val).width > (colW - 10) && mSize > 30) {
            mSize -= 2;
            ctx.font = `400 ${mSize}px ${mainFont}`;
        }

        ctx.textBaseline = 'top';
        // Tightly collapse the value immediately below the label
        ctx.fillText(m.val, x, rowY + 28);
    });

    ctx.restore();
}

/**
 * Image 4: MANIFEST LIST
 * IBM Plex Serif editorial look, Label over Value.
 * High-fidelity match for user's reference image.
 */
export function drawManifestList(ctx: CanvasRenderingContext2D, stats: any, textColor: string) {
    const mainFont = "'IBM Plex Serif', serif";

    // Formatting Helpers
    const toTitleCase = (str: string) => str.toLowerCase().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

    const elevPoint = stats.dataPoints?.find(p => p.label.toUpperCase() === 'ELEVATION');
    const calPoint = stats.dataPoints?.find(p => p.label.toUpperCase() === 'ENERGY');

    const elevVal = stats.elevation || elevPoint?.value || '0';
    const tempVal = stats.avgTemp || stats.temperature || '0';

    const items = [
        { label: 'Distance', val: stats.mainValue || '0.00 km', hide: !stats.hasDistance },
        { label: 'Moving Time', val: stats.timeStr || '0:00' },
        { label: 'Pace', val: stats.subValue || '0:00', hide: !stats.hasDistance },
        { label: 'Total Elevation Gain', val: `+${elevVal} m`, hide: parseFloat(elevVal) === 0 && !elevPoint },
        { label: 'Calories Burned', val: `${stats.calories || '0'} kcal`, hide: !stats.calories || stats.calories === '0' },
        { label: 'Temperature', val: `${tempVal}°C`, hide: !tempVal || tempVal === '0' }
    ].filter(i => !i.hide);

    const startX = 60;
    const startY = 200; // More space from Scora logo
    const rowHeight = 125; // Tighter vertical rhythm

    ctx.save();
    ctx.fillStyle = textColor;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    // Header (Title Case)
    ctx.font = `700 68px ${mainFont}`;
    ctx.fillText(toTitleCase(stats.title || "Activity"), startX, startY);

    // Sub-header: "7:56 AM in Mexico"
    const timeRaw = (stats.startTime || '00:00 AM').toUpperCase();
    const location = stats.location || 'Mexico';
    ctx.font = `400 32px ${mainFont}`;
    ctx.globalAlpha = 0.8;
    ctx.fillText(`${timeRaw} in ${location}`, startX, startY + 80);

    // List Items (Label over Value)
    let currentY = startY + 180;
    items.forEach(item => {
        // Label (Top)
        ctx.globalAlpha = 0.8;
        ctx.font = `400 22px ${mainFont}`; // Slightly smaller label
        ctx.fillText(item.label, startX, currentY);

        // Value (Bottom)
        ctx.globalAlpha = 1.0;
        ctx.font = `700 56px ${mainFont}`; // Slightly smaller value
        ctx.fillText(item.val, startX, currentY + 30); // Tighter gap

        currentY += rowHeight;
    });

    ctx.restore();
}

export function drawGraffitiMap(ctx: CanvasRenderingContext2D, stats: any, textColor: string) {
    const { solid, trans, label: labelColor, accent: accentColor } = buildColors(textColor);
    const lineColor = textColor.startsWith('#') ? textColor : (textColor === 'black' ? '#000000' : '#ffffff');
    const secondaryColor = textColor === 'black' ? '#000000' : '#ffffff';

    if (stats.polyline) {
        const coords = decodePolyline(stats.polyline);
        if (coords && coords.length > 0) {
            // Anchor map to the top safe zone, no forced height container
            const mapBox = { x: 100, y: 220, w: 880 };

            let minLat = coords[0][0], maxLat = minLat, minLng = coords[0][1], maxLng = minLng;
            coords.forEach((p: any) => {
                if (p[0] < minLat) minLat = p[0]; if (p[0] > maxLat) maxLat = p[0];
                if (p[1] < minLng) minLng = p[1]; if (p[1] > maxLng) maxLng = p[1];
            });

            // Cap the scale so extremely vertical routes don't break the screen, but fit within width 880
            const maxH = 800;
            const scale = Math.min(mapBox.w / (maxLng - minLng), maxH / (maxLat - minLat));
            const actualMapHeight = (maxLat - minLat) * scale;

            const getXY = (p: [number, number]) => {
                const x = mapBox.x + (p[1] - minLng) * scale + (mapBox.w - ((maxLng - minLng) * scale)) / 2; // Horizontally centered
                const y = mapBox.y + actualMapHeight - ((p[0] - minLat) * scale); // Top-aligned vertically at mapBox.y
                return { x, y };
            };

            ctx.save();
            ctx.globalAlpha = 0.85;
            drawSprayPath(ctx, coords, getXY, lineColor);
            ctx.restore();

            // Store the dynamic map end Y so we can snap the text to it
            stats._dynamicMapEndY = mapBox.y + actualMapHeight;
        }
    }

    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic'; // Safari safe: prevents 'top' bounding box inconsistencies

    const safeW = 960;

    const unitText = "KM";
    ctx.font = "400 100px 'Permanent Marker'";
    const refWidthNum = ctx.measureText("999.99").width;
    const maxNumSize = Math.floor(100 * (safeW / refWidthNum));

    const refWidthUnit = ctx.measureText(unitText).width;
    // Cap the KM unit size so it doesn't become comically huge (e.g. max 300px)
    let maxUnitSize = Math.floor(100 * (safeW / refWidthUnit));
    if (maxUnitSize > 300) maxUnitSize = 300;

    const distNum = stats.distanceVal || '0.00';

    ctx.save();
    ctx.globalAlpha = 0.85;

    let finalNumSize = maxNumSize;
    ctx.font = `400 ${finalNumSize}px 'Permanent Marker'`;
    if (ctx.measureText(distNum).width > safeW) {
        finalNumSize = Math.floor(finalNumSize * (safeW / ctx.measureText(distNum).width));
    }

    ctx.font = `400 ${finalNumSize}px 'Permanent Marker'`;
    ctx.fillStyle = lineColor;

    // Snap text tightly beneath the actual physical map (with 40px breathing room)
    const textStartY = (stats._dynamicMapEndY || 250) + 40;

    // Calculate exact alphabetic baseline. Permanent Marker baseline is approx 85% of font size.
    const numBaseline = textStartY + (finalNumSize * 0.85);
    ctx.fillText(distNum, 540, numBaseline);
    ctx.restore();

    ctx.save();
    ctx.font = `400 ${maxUnitSize}px 'Permanent Marker'`;
    ctx.fillStyle = secondaryColor;
    ctx.globalAlpha = 1.0;
    // Snap KM tightly beneath the number
    const unitTop = textStartY + (finalNumSize * 0.8);
    const unitBaseline = unitTop + (maxUnitSize * 0.85);
    ctx.fillText(unitText, 540, unitBaseline);
    ctx.restore();
}

/**
 * ☕ COFFEE CLUB STICKER
 * Aesthetic: A hand-drawn poster vibe with cursive titles, typewriter data, and a sketched map.
 * Background: Semi-transparent pale yellow.
 */
export function drawCoffeeClub(ctx: CanvasRenderingContext2D, stats: any, textColor: string) {
    const cursiveFont = "'Shadows Into Light Two', cursive";
    const monoFont = "'Roboto Mono', monospace";

    // The texts and color (No background, just transparent)
    ctx.save();
    const mainColor = textColor.startsWith('#') ? textColor : (textColor === 'white' ? '#ffffff' : '#080706');
    ctx.fillStyle = mainColor;

    // 1. Big Cursive Title
    let titleText = (stats.title || 'Morning Run').trim();
    if (!titleText) titleText = 'Coffee Club';

    // Handle multi-word titles for the cursive font nicely
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    let titleFontSize = 240;
    ctx.font = `400 ${titleFontSize}px ${cursiveFont}`;

    // Simple wrap logic: Split by space, max 2 lines
    const words = titleText.split(' ');
    let line1 = words[0];
    let line2 = words.slice(1).join(' ');

    if (words.length > 3) {
        line1 = words.slice(0, 2).join(' ');
        line2 = words.slice(2).join(' ');
    }
    if (!line2) {
        line1 = titleText;
        line2 = '';
    }

    // Auto-scale lines
    while (ctx.measureText(line1).width > 800 && titleFontSize > 80) {
        titleFontSize -= 10;
        ctx.font = `400 ${titleFontSize}px ${cursiveFont}`;
    }

    const titleY = 220; // Pushed down to avoid Scora logo
    ctx.fillText(line1, 80, titleY);

    if (line2) {
        // slightly offset line 2
        ctx.fillText(line2, 100, titleY + titleFontSize * 0.9);
    }

    // Stack all data on the left
    ctx.font = `400 48px ${monoFont}`;
    ctx.textAlign = 'left';

    // 2. Date & Time
    const dateText = (stats.date || 'TODAY').toUpperCase();
    const startTime = (stats.startTime || '00:00 AM').toUpperCase();

    const midY = 800;
    ctx.fillText(dateText, 80, midY);
    ctx.fillText(startTime, 80, midY + 60);

    // 3. Pace & Duration
    const paceVal = (stats.subValue || '').split(' ')[0] || '0:00';
    const hasDist = stats.hasDistance !== false;
    let sec1 = hasDist ? `PACE ${paceVal}` : `AVG HR ${stats.avgHeartrate || '0'}`;
    let sec2 = `DUR ${(stats.timeStr || '0:00')}`.toUpperCase();

    const botY = 1100;
    ctx.fillText(sec1, 80, botY);
    ctx.fillText(sec2, 80, botY + 60);

    // 4. Distance / Calories
    const distVal = stats.distanceVal || '0.00';
    let primaryMetric1 = hasDist ? `${distVal} KM` : `${stats.calories || '0'} KCAL`;

    const distY = 1400;
    ctx.fillText(primaryMetric1, 80, distY);

    // 5. The Doodle Area (Hand-drawn mini-map)
    if (stats.polyline) {
        const coords = decodePolyline(stats.polyline);
        if (coords && coords.length > 0) {
            const mapBox = { x: 500, y: 1000, w: 450, h: 600 };
            let minLat = coords[0][0], maxLat = minLat, minLng = coords[0][1], maxLng = minLng;
            coords.forEach((p: any) => {
                if (p[0] < minLat) minLat = p[0]; if (p[0] > maxLat) maxLat = p[0];
                if (p[1] < minLng) minLng = p[1]; if (p[1] > maxLng) maxLng = p[1];
            });
            const scale = Math.min(mapBox.w / (maxLng - minLng), mapBox.h / (maxLat - minLat));

            const getXY = (p: [number, number]) => {
                const x = mapBox.x + (p[1] - minLng) * scale + (mapBox.w - ((maxLng - minLng) * scale)) / 2;
                const y = mapBox.y + mapBox.h - ((p[0] - minLat) * scale) - (mapBox.h - ((maxLat - minLat) * scale)) / 2;
                return { x, y };
            };

            ctx.save();
            ctx.beginPath();
            ctx.strokeStyle = mainColor; // Apply dynamic color to map too
            ctx.lineWidth = 5;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            coords.forEach((p: any, i: number) => {
                const pt = getXY(p);
                if (i === 0) ctx.moveTo(pt.x, pt.y);
                else ctx.lineTo(pt.x, pt.y);
            });
            ctx.stroke();

            // Draw a dot at the start
            const startPt = getXY(coords[0]);
            ctx.beginPath();
            ctx.fillStyle = mainColor;
            ctx.arc(startPt.x, startPt.y, 10, 0, Math.PI * 2);
            ctx.fill();

            ctx.restore();
        }
    }

    ctx.restore();
}

export function drawTempoGraph(ctx: CanvasRenderingContext2D, stats: any, textColor: string) {
    const sysFont = "'Inter', sans-serif";

    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.15)';
    ctx.shadowBlur = 40;
    ctx.shadowOffsetY = 15;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)'; // 50% opacity as requested

    const w = 900;
    const h = 300;
    const x = 540 - w / 2;
    const y = 200;

    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 30);
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    ctx.fillStyle = '#333333';
    ctx.font = `500 32px ${sysFont}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(stats.shortTitle || 'Activity', x + 40, y + 40);

    ctx.font = `800 46px ${sysFont}`;
    ctx.fillStyle = '#000000';
    ctx.fillText(stats.timeStr || '0:00', x + 160, y + 100);

    ctx.globalAlpha = 0.4;
    ctx.fillText(stats.distanceVal ? `${stats.distanceVal} km` : '- km', x + 450, y + 100);
    ctx.globalAlpha = 1.0;

    const tssVal = stats.avgHeartrate ? `${stats.avgHeartrate} BPM` : (stats.subValue || '0:00/km');
    ctx.fillText(tssVal, x + 680, y + 100);

    // Draw Graph
    const gX = x + 40;
    const gY = y + 260; // bottom baseline
    const gW = w - 80;
    const maxH = 80;

    ctx.fillStyle = '#c8d2e0'; // The grayish blue from image

    if (stats.splits && stats.splits.length > 0) {
        // ACTUAL SPLITS DATA
        let maxSec = 0;
        stats.splits.forEach((s: any) => { if (s.seconds > maxSec) maxSec = s.seconds; });

        const barW = (gW / stats.splits.length) - 4;
        stats.splits.forEach((s: any, i: number) => {
            let barH = (s.seconds / maxSec) * maxH;
            if (barH < 5) barH = 5;
            ctx.fillRect(gX + i * (barW + 4), gY - barH, barW, barH);
        });
    } else if (stats.polyline) {
        // ROUTE FINGERPRINT (Real data visualization)
        // If no splits, we map their route's latitude variance into an aesthetic curve graph
        const coords = decodePolyline(stats.polyline);
        if (coords && coords.length > 0) {
            let minLat = coords[0][0], maxLat = minLat;
            coords.forEach((p: any) => {
                if (p[0] < minLat) minLat = p[0]; if (p[0] > maxLat) maxLat = p[0];
            });
            const latRange = maxLat - minLat || 1;

            ctx.beginPath();
            ctx.moveTo(gX, gY);
            coords.forEach((p: any, i: number) => {
                const px = gX + (i / coords.length) * gW;
                // Normalize latitude to a height (0 to maxH)
                const py = gY - ((p[0] - minLat) / latRange) * maxH;
                ctx.lineTo(px, py);
            });
            ctx.lineTo(gX + gW, gY);
            ctx.closePath();

            // Premium gradient fill
            const grad = ctx.createLinearGradient(0, gY - maxH, 0, gY);
            grad.addColorStop(0, 'rgba(1, 73, 187, 0.4)');
            grad.addColorStop(1, 'rgba(1, 73, 187, 0)');
            ctx.fillStyle = grad;
            ctx.fill();

            ctx.strokeStyle = '#0149bb';
            ctx.lineWidth = 3;
            ctx.stroke();
        }
    } else {
        // Absolute fallback if absolutely no data is present
        ctx.fillRect(gX, gY - 4, gW, 4);
    }

    ctx.restore();
}

export function drawWavyQuote(ctx: CanvasRenderingContext2D, stats: any, textColor: string) {
    // ROUTE PATH TYPOGRAPHY - Writing text perfectly along the Strava polyline
    const mainColor = textColor.startsWith('#') ? textColor : (textColor === 'black' ? '#000000' : '#ffffff');
    ctx.save();

    if (stats.polyline) {
        const coords = decodePolyline(stats.polyline);
        if (coords && coords.length > 1) {
            // Setup map bounds to fill the center of the screen
            const mapBox = { x: 100, y: 300, w: 880, h: 1000 };
            let minLat = coords[0][0], maxLat = minLat, minLng = coords[0][1], maxLng = minLng;
            coords.forEach((p: any) => {
                if (p[0] < minLat) minLat = p[0]; if (p[0] > maxLat) maxLat = p[0];
                if (p[1] < minLng) minLng = p[1]; if (p[1] > maxLng) maxLng = p[1];
            });
            const scale = Math.min(mapBox.w / (maxLng - minLng), mapBox.h / (maxLat - minLat));
            const pts = coords.map((p: any) => ({
                x: mapBox.x + (p[1] - minLng) * scale + (mapBox.w - ((maxLng - minLng) * scale)) / 2,
                y: mapBox.y + mapBox.h - ((p[0] - minLat) * scale) - (mapBox.h - ((maxLat - minLat) * scale)) / 2
            }));

            // Calculate total distance of the polyline in pixels
            let totalPathDist = 0;
            const segments = [];
            for (let i = 0; i < pts.length - 1; i++) {
                const dx = pts[i + 1].x - pts[i].x;
                const dy = pts[i + 1].y - pts[i].y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist > 0.1) {
                    const angle = Math.atan2(dy, dx);
                    segments.push({ ...pts[i], dist, angle, dx, dy });
                    totalPathDist += dist;
                }
            }

            // Draw the actual route line (spine)
            ctx.beginPath();
            ctx.strokeStyle = mainColor;
            ctx.globalAlpha = 0.3;
            ctx.lineWidth = 4;
            ctx.lineJoin = 'round';
            ctx.lineCap = 'round';
            pts.forEach((p: any, i: number) => {
                if (i === 0) ctx.moveTo(p.x, p.y);
                else ctx.lineTo(p.x, p.y);
            });
            ctx.stroke();
            ctx.globalAlpha = 1.0;

            // The data string to repeat
            const dataStr = `${stats.shortTitle || 'ACTIVITY'} • ${stats.distanceVal ? stats.distanceVal + ' KM' : ''} • DUR ${stats.timeStr || ''} • PACE ${stats.subValue || ''} • `.toUpperCase();

            ctx.font = `800 24px 'Inter', sans-serif`;
            ctx.fillStyle = mainColor;
            ctx.textBaseline = 'middle';
            ctx.textAlign = 'center';

            let currentDist = 0;
            let charIdx = 0;
            let segIdx = 0;

            // Draw chars along path
            while (currentDist < totalPathDist && segIdx < segments.length) {
                const char = dataStr[charIdx % dataStr.length];
                const charW = ctx.measureText(char).width;
                const advance = charW + 4; // letter spacing

                // Find which segment we are currently on based on currentDist
                let accumulated = 0;
                let activeSeg = segments[0];
                let distIntoSeg = 0;

                for (let i = 0; i < segments.length; i++) {
                    if (currentDist >= accumulated && currentDist <= accumulated + segments[i].dist) {
                        activeSeg = segments[i];
                        distIntoSeg = currentDist - accumulated;
                        segIdx = i;
                        break;
                    }
                    accumulated += segments[i].dist;
                }

                if (accumulated + activeSeg.dist < currentDist) break; // Reached end

                // Interpolate exact X/Y
                const ratio = distIntoSeg / activeSeg.dist;
                const charX = activeSeg.x + activeSeg.dx * ratio;
                const charY = activeSeg.y + activeSeg.dy * ratio;

                ctx.save();
                ctx.translate(charX, charY);
                // We add PI to angle if the text would be drawn upside down, but for artistic maps, raw angle is fine
                ctx.rotate(activeSeg.angle);
                ctx.fillText(char, 0, -14); // Offset perpendicular to the path
                ctx.restore();

                currentDist += advance;
                charIdx++;
            }
        }
    } else {
        // Fallback if no polyline: standard title
        ctx.fillStyle = mainColor;
        ctx.font = `800 60px 'Inter', sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText("NO ROUTE DATA", 540, 960);
    }

    ctx.restore();
}

export function drawRetroDistance(ctx: CanvasRenderingContext2D, stats: any, textColor: string) {
    const mainColor = textColor.startsWith('#') ? textColor : (textColor === 'white' ? '#ffffff' : '#042a9b');

    ctx.save();

    // RUNNER'S BIB AESTHETIC at the bottom
    const cardW = 960;
    const cardH = 600;
    const cX = 60;
    const cY = 1260; // Bottom anchored

    // Bib Paper
    ctx.fillStyle = 'rgba(249, 246, 240, 0.5)'; // 50% opacity off-white
    ctx.shadowColor = 'rgba(0,0,0,0.3)';
    ctx.shadowBlur = 40;
    ctx.shadowOffsetY = 20;
    ctx.beginPath();
    ctx.roundRect(cX, cY, cardW, cardH, 20);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    // Bib Inner Border
    ctx.strokeStyle = '#111111';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.roundRect(cX + 20, cY + 20, cardW - 40, cardH - 40, 10);
    ctx.stroke();

    // Grid Dividers
    ctx.beginPath();
    ctx.moveTo(cX + 20, cY + 400);
    ctx.lineTo(cX + cardW - 20, cY + 400); // Horizontal split
    ctx.moveTo(cX + cardW / 3, cY + 400);
    ctx.lineTo(cX + cardW / 3, cY + cardH - 20); // Vert split 1
    ctx.moveTo(cX + (cardW / 3) * 2, cY + 400);
    ctx.lineTo(cX + (cardW / 3) * 2, cY + cardH - 20); // Vert split 2
    ctx.stroke();

    let mainValue = stats.distanceVal || '0.0';
    let mainLabel = "KILOMETERS";
    let cell2Label = "TIME";
    let cell2Value = stats.timeStr || '0:00';

    // If it's a workout with no distance, feature the duration instead
    if (!stats.distanceVal || parseFloat(stats.distanceVal) === 0) {
        mainValue = stats.timeStr || '0:00';
        mainLabel = "DURATION";
        cell2Label = "ACTIVITY";
        cell2Value = normalizeSport(stats.activityType || 'WORKOUT').toUpperCase();
    }

    // Distance/Duration (Main Block)
    ctx.fillStyle = mainColor; // Use dynamic color instead of hardcoded red
    ctx.font = `800 280px 'Asset', sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(mainValue, cX + cardW / 2, cY + 200, cardW - 120);

    ctx.fillStyle = '#111111';
    ctx.font = `400 40px 'Inter', sans-serif`;
    ctx.fillText(mainLabel, cX + cardW / 2, cY + 350);

    // Bottom Cells
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    ctx.font = `800 24px 'Inter', sans-serif`;

    // Cell 1: Date
    ctx.fillText("DATE", cX + 40, cY + 420);
    ctx.font = `400 42px 'Syne', sans-serif`;
    ctx.fillText((stats.dayAndNumber || 'APR 2').toUpperCase(), cX + 40, cY + 460, 260);

    // Cell 2: Time / Activity
    ctx.font = `800 24px 'Inter', sans-serif`;
    ctx.fillText(cell2Label, cX + cardW / 3 + 20, cY + 420);
    ctx.font = `400 42px 'Syne', sans-serif`;
    ctx.fillText(cell2Value, cX + cardW / 3 + 20, cY + 460);

    // Cell 3: Pace
    ctx.font = `800 24px 'Inter', sans-serif`;
    ctx.fillText("PACE", cX + (cardW / 3) * 2 + 20, cY + 420);
    ctx.font = `400 42px 'Syne', sans-serif`;
    ctx.fillText(stats.subValue || '0:00', cX + (cardW / 3) * 2 + 20, cY + 460);

    ctx.restore();
}

export function drawWaveTitle(ctx: CanvasRenderingContext2D, stats: any, textColor: string) {
    // FROSTED GLASSMORPHISM PLATE
    // Default to dark text (#111111) since the glass is now white
    const mainColor = textColor.startsWith('#') ? textColor : (textColor === 'white' ? '#111111' : '#111111');
    ctx.save();

    const cardW = 960;
    const cardH = 560; // Slightly taller to fit title safely
    const cX = 60;
    const cY = 1260; // Shifted up slightly

    // Glass Pane (Light / White)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.shadowColor = 'rgba(0,0,0,0.15)';
    ctx.shadowBlur = 40;
    ctx.shadowOffsetY = 20;
    ctx.beginPath();
    ctx.roundRect(cX, cY, cardW, cardH, 40);
    ctx.fill();

    // Glass Border
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)'; // Bright white specular edge
    ctx.lineWidth = 2;
    ctx.stroke();

    // Typography

    // Top Massive Title
    ctx.fillStyle = mainColor; // Dynamic color
    ctx.font = `800 120px 'Unbounded', sans-serif`; // Replaced Slack Sans Notch
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(normalizeSport(stats.activityType || 'RUN').toUpperCase(), 540, cY + 120, cardW - 80);

    // Separator line
    ctx.globalAlpha = 0.2;
    ctx.fillStyle = mainColor;
    ctx.fillRect(cX + 60, cY + 220, cardW - 120, 2);
    ctx.globalAlpha = 1.0;

    ctx.textBaseline = 'top';
    const rowY = cY + 260;

    // Date
    ctx.textAlign = 'left';
    ctx.font = `700 32px 'Inter', sans-serif`;
    ctx.fillText((stats.dayAndNumber || 'APR 2').toUpperCase(), cX + 60, rowY, 300);

    // Distance (Placed perfectly in the right available space)
    if (stats.distanceVal && parseFloat(stats.distanceVal) > 0) {
        ctx.textAlign = 'right';
        ctx.font = `600 24px 'Inter', sans-serif`;
        ctx.fillText("DISTANCE", cX + cardW - 60, rowY);
        ctx.font = `800 40px 'Inter', sans-serif`;
        ctx.fillText(stats.distanceVal + ' km', cX + cardW - 60, rowY + 30);
    } else if (stats.calories && stats.calories > 0) {
        ctx.textAlign = 'right';
        ctx.font = `600 24px 'Inter', sans-serif`;
        ctx.fillText("CALORIES", cX + cardW - 60, rowY);
        ctx.font = `800 40px 'Inter', sans-serif`;
        ctx.fillText(stats.calories + ' kcal', cX + cardW - 60, rowY + 30);
    }

    // Title (Moved to its own line to prevent overlap)
    const titleY = rowY + 60;
    ctx.textAlign = 'left'; // Fix alignment bug
    ctx.font = `800 48px 'Inter', sans-serif`;
    // Added maxWidth (cardW - 120) to ensure long titles shrink to fit
    ctx.fillText(stats.shortTitle || 'WORKSHOP', cX + 60, titleY, cardW - 120);

    // Bottom Details
    const row2Y = titleY + 90;
    ctx.textAlign = 'left';
    ctx.font = `600 24px 'Inter', sans-serif`;
    ctx.fillText("DURATION", cX + 60, row2Y);
    ctx.font = `800 40px 'Inter', sans-serif`;
    ctx.fillText(stats.timeStr || '1:20', cX + 60, row2Y + 30);

    ctx.textAlign = 'right';
    ctx.font = `600 24px 'Inter', sans-serif`;
    ctx.fillText((stats.subLabel || "AVG PACE").toUpperCase(), cX + cardW - 60, row2Y);
    ctx.font = `800 40px 'Inter', sans-serif`;
    ctx.fillText(stats.subValue || '0:00', cX + cardW - 60, row2Y + 30);

    ctx.restore();
}

// ── Template: Neon Glow ────────────────────────────────────────────────────
export function drawNeonGlow(ctx: CanvasRenderingContext2D, stats: StickerStats, textColor: string = 'white', showLogo: boolean = true) {
    const accentColor = textColor === 'black' ? '#ffffff' : textColor; 
    
    // Layout geometry
    const canvasWidth = 1080;
    const padding = 100;
    let dataY = 240;
    
    ctx.save();

    // Setup Text (No shadow as requested)
    ctx.shadowBlur = 0;
    ctx.fillStyle = accentColor;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    
    // Data List Setup
    const elevPoint = stats.dataPoints?.find(p => p.label.toUpperCase() === 'ELEVATION');
    const elevVal = stats.elevation || elevPoint?.value || '0';
    const timeRaw = (stats.startTime || '00:00 AM').toUpperCase();
    
    const d = new Date(stats.rawDate || Date.now());
    const monthStr = d.toLocaleString('en-US', { month: 'long' }).toUpperCase();
    const dayStr = d.toLocaleString('en-US', { weekday: 'long' }).toUpperCase();
    const dayNumStr = d.getDate().toString();
    const locationStr = (stats.location || 'LOCAL').toUpperCase();
    
    let items: { val: string, hide: boolean }[] = [];
    
    if (stats.polyline) {
        items = [
            { val: locationStr, hide: false },
            { val: `${monthStr}, ${dayStr} ${dayNumStr}`, hide: false },
            { val: timeRaw, hide: false },
            { val: `${stats.distanceVal || '0.00'} ${stats.distanceUnit || 'KM'}`, hide: false },
            { val: `${stats.subValue || '0:00'}`, hide: false },
            { val: `${stats.timeStr || '0:00'}`, hide: false }
        ];
    } else {
        items = [
            { val: `${monthStr}, ${dayStr} ${dayNumStr}`, hide: false },
            { val: `${stats.timeStr || stats.mainValue || '0:00'}`, hide: false },
            { val: `${stats.avgHeartrate || '--'} BPM`, hide: !stats.avgHeartrate }
        ];
    }
    
    items = items.filter(i => !i.hide);
    
    ctx.font = "800 65px 'Andika', sans-serif";
    const startX = 80;
    dataY = 180;
    
    items.forEach(item => {
        ctx.fillText(item.val.toUpperCase(), startX, dataY);
        dataY += 75; // Line height
    });
    
    dataY += 20; // Place map much closer to data
    
    // 5. Draw Glowing Map (if present)
    if (stats.polyline) {
        const coords = decodePolyline(stats.polyline);
        if (coords && coords.length > 0) {
            const mapBox = { x: padding, y: dataY, w: canvasWidth - padding * 2, h: 1800 - dataY - 120 };
            
            let minLat = coords[0][0], maxLat = minLat, minLng = coords[0][1], maxLng = minLng;
            coords.forEach(p => {
                if (p[0] < minLat) minLat = p[0]; if (p[0] > maxLat) maxLat = p[0];
                if (p[1] < minLng) minLng = p[1]; if (p[1] > maxLng) maxLng = p[1];
            });

            const scale = Math.min(mapBox.w / (maxLng - minLng), mapBox.h / (maxLat - minLat));

            const drawPath = () => {
                ctx.beginPath();
                coords.forEach((p, i) => {
                    const x = mapBox.x + (p[1] - minLng) * scale + (mapBox.w - ((maxLng - minLng) * scale)) / 2;
                    // Align map to the top of the box (with 40px padding) rather than vertical center
                    const y = mapBox.y + ((maxLat - p[0]) * scale) + 40;
                    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
                });
                ctx.stroke();
            };

            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            
            // 1. Massive Multi-Layer Glow (Pure Light Emission)
            ctx.globalCompositeOperation = 'source-over';
            ctx.strokeStyle = accentColor;
            ctx.shadowColor = accentColor;
            
            const coreWidth = 24; // The core energy line
            
            const auraLayers = [
                { blur: 180, alpha: 0.2 },
                { blur: 120, alpha: 0.4 },
                { blur: 70, alpha: 0.6 },
                { blur: 40, alpha: 0.8 },
                { blur: 15, alpha: 1.0 } // Tight intense color bleed
            ];
            
            auraLayers.forEach(layer => {
                ctx.shadowBlur = layer.blur;
                ctx.globalAlpha = layer.alpha;
                ctx.lineWidth = coreWidth; 
                drawPath();
            });
            
            // 2. The Burning White Core
            ctx.strokeStyle = '#ffffff';
            ctx.shadowColor = accentColor;
            ctx.shadowBlur = 10;
            ctx.globalAlpha = 1.0;
            ctx.lineWidth = coreWidth - 6; // Leave a tiny rim of intense color
            drawPath();
            
            // 3. Absolute sharp center
            ctx.shadowBlur = 0;
            ctx.lineWidth = coreWidth / 2;
            drawPath();
            
            ctx.globalAlpha = 1.0;
        }
    }
    
    ctx.restore();
}
