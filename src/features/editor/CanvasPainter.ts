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
import { StickerStats } from '../../api/strava';
import { STICKER_REGISTRY } from './StickerRegistry';

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
    const alphaValue = 0.85;
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
export function drawTemplate(
    canvasId: string,
    stats: any,
    templateType = 'minimal',
    textColor = 'white',
    showLogo = true
) {
    (window as any)._scoraIsSettled = false;
    const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;

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
    if (showLogo) {
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
    sticker.render(ctx, stats, textColor);

    ctx.restore();

    // ARCHITECT NOTE: Deterministic synchronization signal for E2E tests
    // Using requestAnimationFrame ensures the signal triggers ONLY after the browser paints the pixels.
    requestAnimationFrame(() => {
        (window as any)._scoraIsSettled = true;
        (window as any)._scoraDrawCount = ((window as any)._scoraDrawCount || 0) + 1;
    });
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

// ─── Gym templates ────────────────────────────────────────────────────────────


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
        const subSub = stats.date || stats.type || 'Gym';
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
    const centerY = 1300;
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
    const cy = 1300;

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
    ctx.font = `italic 900 130px ${sysFont}`;
    ctx.fillStyle = textColor === 'black' ? 'black' : 'white';
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
    ctx.fillStyle = textColor === 'black' ? 'black' : 'white';
    ctx.fillText(paceText, rightX - pUnitW, bottomY);
}

export function drawInfoGlass(ctx, stats, textColor) {
    const c = buildColors(textColor);
    ctx.textBaseline = 'middle';
    const sysFont = "'Plus Jakarta Sans', sans-serif";

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

    ctx.beginPath();
    ctx.roundRect(startX, centerY - h / 2, w, h, 40);
    ctx.fillStyle = textColor === 'black' ? 'rgba(0, 0, 0, 0.1)' : 'rgba(255, 255, 255, 0.15)';
    ctx.fill();
    ctx.strokeStyle = textColor === 'black' ? 'rgba(0, 0, 0, 0.2)' : 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 2;
    ctx.stroke();

    const col1 = startX + w / 6;
    const col2 = startX + w / 2;
    const col3 = startX + 5 * w / 6;

    ctx.fillStyle = textColor === 'black' ? 'black' : 'white';
    ctx.textAlign = 'center';

    ctx.font = `800 22px ${sysFont}`;
    ctx.fillStyle = textColor === 'black' ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.6)';
    ctx.fillText(distLabel, col1, centerY - 25);
    ctx.font = `900 60px ${sysFont}`;
    ctx.fillStyle = textColor === 'black' ? 'black' : 'white';

    // Add Units to main value
    const distWithUnit = stats.hasDistance ? `${distText} KM` : distText;
    ctx.fillText(distWithUnit, col1, centerY + 30);

    ctx.beginPath();
    ctx.moveTo(startX + w / 3, centerY - 60);
    ctx.lineTo(startX + w / 3, centerY + 60);
    ctx.moveTo(startX + 2 * w / 3, centerY - 60);
    ctx.lineTo(startX + 2 * w / 3, centerY + 60);
    ctx.strokeStyle = textColor === 'black' ? 'rgba(0, 0, 0, 0.15)' : 'rgba(255, 255, 255, 0.15)';
    ctx.stroke();

    ctx.font = `800 22px ${sysFont}`;
    ctx.fillStyle = textColor === 'black' ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.6)';
    ctx.fillText(paceLabel, col2, centerY - 25);
    ctx.font = `900 60px ${sysFont}`;
    ctx.fillStyle = textColor === 'black' ? 'black' : 'white';

    // Add Units to pace/HR value
    const paceUnit = stats.hasDistance ? (stats.type === 'Ride' ? 'KM/H' : '/KM') : 'BPM';
    const paceWithUnit = `${paceText} ${paceUnit}`;
    ctx.fillText(paceWithUnit, col2, centerY + 30);

    ctx.font = `800 22px ${sysFont}`;
    ctx.fillStyle = textColor === 'black' ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.6)';
    ctx.fillText(timeLabel, col3, centerY - 25);
    ctx.font = `900 60px ${sysFont}`;
    ctx.fillStyle = textColor === 'black' ? 'black' : 'white';

    // Time/Max HR unit logic
    const timeUnit = stats.hasDistance ? '' : 'BPM';
    const timeWithUnit = timeUnit ? `${timeText} ${timeUnit}` : timeText;
    ctx.fillText(timeWithUnit, col3, centerY + 30);
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
    const sysFont = "'Plus Jakarta Sans', sans-serif";
    const p = stats.dataPoints || [];
    const main = p[0] || { value: '0.00', label: 'Dist', unit: 'km' };
    const p2 = p[1] || { value: '0:00', label: 'Pace', unit: '' };

    const cx = 540;
    const cy = 1750;
    const w = 940;
    const h = 280;

    // "Rectangle background should have a little transparency"
    ctx.save();
    ctx.translate(cx, cy);

    // Main background with transparency
    ctx.fillStyle = textColor === 'black' ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.85)';
    ctx.fillRect(-w / 2, -h / 2, w, h);

    // Accent line (left)
    ctx.fillStyle = '#ff3b30'; // Red accent
    ctx.fillRect(-w / 2, -h / 2, 10, h);

    // Data - Left Column
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = textColor === 'black' ? 'black' : 'white';

    ctx.font = `italic 900 120px ${sysFont}`;
    const mainVal = main.value;
    ctx.fillText(mainVal, -w / 2 + 50, -20);
    const mainW = ctx.measureText(mainVal).width;

    ctx.font = `800 32px ${sysFont}`;
    ctx.globalAlpha = 1.0; // "without opacity"
    ctx.fillText((main.unit || main.label).toUpperCase(), -w / 2 + 65 + mainW, 10);

    // Data - Right Column
    ctx.textAlign = 'right';
    ctx.font = `900 85px ${sysFont}`;
    ctx.fillText(p2.value, w / 2 - 50, -20);

    ctx.font = `800 24px ${sysFont}`;
    const fullPaceLabel = `${p2.label}${p2.unit ? ` (${p2.unit})` : ''}`.toUpperCase();
    ctx.fillText(fullPaceLabel, w / 2 - 50, 45);

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

    ctx.fillStyle = textColor === 'black' ? 'black' : 'white';
    ctx.font = `italic 900 70px ${sysFont}`;
    ctx.fillText(distText, cx, cy + 15);

    ctx.fillStyle = textColor === 'black' ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.4)';
    ctx.font = `700 20px ${sysFont}`;
    ctx.letterSpacing = "3px";
    ctx.fillText(hrText, cx + 1.5, cy + 70);
    ctx.letterSpacing = "0px";
}

export function drawDataModular(ctx, stats, textColor) {
    const sysFont = "'Plus Jakarta Sans', sans-serif";
    ctx.textBaseline = 'alphabetic';

    const distLabel = (stats.mainLabel || (stats.hasDistance ? "DISTANCE" : "DURATION")).toUpperCase();
    const distText = stats.hasDistance ? (stats.distanceVal || '0.00') : (stats.timeStr || '0:00');

    const paceLabel = (stats.subLabel || (stats.hasDistance ? (stats.type === 'Ride' ? "Avg Speed" : "Pace") : "Avg HR")).toUpperCase();
    const paceParts = (stats.subValue || '').trim().split(' ');
    const paceText = paceParts[0] || (stats.avgHeartrate ? String(stats.avgHeartrate) : '0');
    let paceUnit = paceParts[1] || (stats.hasDistance ? (stats.type === 'Ride' ? 'KM/H' : '/KM') : 'BPM');
    if (paceUnit.toLowerCase() === 'min/km') paceUnit = '/KM';

    const cx = 540;
    const cy = 1600;
    const w = 900;
    const h = 240;
    const r = 32;

    ctx.save();

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
    const panelBg = textColor === 'black' ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.4)'; // Slightly more transparent
    const bottomBg = textColor === 'black' ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.05)';

    // Top Left Panel (Sharp rects! Clipping handles the outer curve)
    ctx.fillStyle = panelBg;
    ctx.fillRect(startX, startY, w / 2 - 0.5, topH);

    // Top Right Panel
    ctx.fillRect(startX + w / 2 + 0.5, startY, w / 2 - 0.5, topH);

    // Bottom Panel
    ctx.fillStyle = bottomBg;
    ctx.fillRect(startX, startY + topH + 1, w, botH);

    // Text for Top Left
    ctx.textAlign = 'left';
    ctx.fillStyle = '#22d3ee';
    ctx.font = `900 18px ${sysFont}`;
    ctx.letterSpacing = "2px";
    ctx.fillText(distLabel, startX + 50, startY + 50);

    ctx.fillStyle = textColor === 'black' ? 'black' : 'white';
    ctx.font = `italic 900 70px ${sysFont}`;
    ctx.letterSpacing = "0px";
    ctx.fillText(distText, startX + 50, startY + 130);

    // Text for Top Right
    ctx.fillStyle = '#22d3ee';
    ctx.font = `900 18px ${sysFont}`;
    ctx.letterSpacing = "2px";
    ctx.fillText(paceLabel, startX + w / 2 + 50, startY + 50);

    ctx.fillStyle = textColor === 'black' ? 'black' : 'white';
    ctx.font = `italic 900 70px ${sysFont}`;
    ctx.letterSpacing = "0px";
    ctx.fillText(`${paceText} ${paceUnit}`.toUpperCase(), startX + w / 2 + 50, startY + 130);

    // Text for Bottom
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = textColor === 'black' ? 'rgba(0,0,0,0.85)' : 'rgba(255,255,255,0.85)';
    ctx.font = `900 14px ${sysFont}`;
    ctx.letterSpacing = "6px";
    ctx.fillText("SCORA PERFORMANCE LOG", cx + 3, startY + topH + 1 + botH / 2);

    ctx.restore();

    // Draw the outer border over everything
    ctx.beginPath();
    ctx.roundRect(cx - w / 2, cy - h / 2, w, h, r);
    ctx.lineWidth = 1;
    ctx.strokeStyle = textColor === 'black' ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.3)';
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
    const distanceVal = stats.distanceVal || '0.00';

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
    drawVCR(`${distanceVal} KM`, trX, trY + 110, 'right', 'top', 40);

    // --- BOTTOM LEFT: Timestamps ---
    drawVCR(timeStr, margin, canvasH - margin - 65, 'left', 'bottom', 36);
    drawVCR(dateStr, margin, canvasH - margin, 'left', 'bottom', 36);

    // --- BOTTOM RIGHT: Data ---
    drawVCR(`${paceVal} /KM`, canvasW - margin, canvasH - margin - 65, 'right', 'bottom', 36);
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
    ctx.fillStyle = textColor === 'black' ? 'black' : 'white';

    // Strategy: Render Value, then Unit with a safer gap to avoid 'destruction'
    ctx.font = `italic 900 84px ${sysFont}`; // Increased slightly for punch
    const distValStr = String(distText);
    const valWidth = ctx.measureText(distValStr).width;

    // Centered but shifted left to make room for unit
    const startXVal = -w / 4 - 20;
    ctx.fillText(distValStr, startXVal, -15);

    // Unit (KM) - Studio Grade Alignment
    ctx.font = `italic 800 28px ${sysFont}`;
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
    ctx.fillStyle = textColor === 'black' ? 'black' : 'white';
    ctx.font = `italic 900 84px ${sysFont}`; // Increased to match Left
    ctx.fillText(paceText, startXR, -15);

    const paceWidth = ctx.measureText(paceText).width;
    ctx.font = `italic 800 28px ${sysFont}`;
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
    ctx.font = `italic 900 16px ${sysFont}`;
    ctx.letterSpacing = "4px";
    ctx.fillText("ATHLETE", cx + 2, cy - r); // +2 kerning fix
    ctx.letterSpacing = "0px";

    ctx.fillStyle = textColor === 'black' ? 'black' : 'white';
    ctx.font = `italic 900 80px ${sysFont}`;
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
    const sysFont = "'Plus Jakarta Sans', sans-serif";
    const monoFont = "'Space Mono', monospace";
    const p = stats.dataPoints || [];

    const cx = 540;
    const cy = 1100;
    const w = 640;
    const h = 750;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-1.5 * Math.PI / 180); // -1.5deg rotation

    // Shadow
    ctx.shadowBlur = 40;
    ctx.shadowColor = 'rgba(0,0,0,0.2)';
    ctx.shadowOffsetY = 20;

    // Thermal Background (Yellow)
    ctx.fillStyle = '#facc15';
    ctx.fillRect(-w / 2, -h / 2, w, h);

    // Completely clear shadow so inner text has no shadow bleeding
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    ctx.shadowColor = 'transparent';

    // Header Line
    ctx.textAlign = 'left';
    ctx.fillStyle = 'black';

    // Day and Number Day (Requested)
    const dateStr = (stats.dayAndNumber || stats.date || '').toUpperCase();
    ctx.font = `900 24px ${monoFont}`;
    if (typeof ctx.letterSpacing !== 'undefined') ctx.letterSpacing = "10px";
    ctx.fillText(dateStr, -w / 2 + 60, -h / 2 + 80);
    ctx.letterSpacing = "0px";

    // Header divider
    ctx.globalAlpha = 0.1;
    ctx.fillRect(-w / 2 + 60, -h / 2 + 105, w - 120, 4);
    ctx.globalAlpha = 1.0;

    // Main Row: Distance
    const main = p[0] || { value: '0.00', unit: 'km' };
    ctx.save();
    ctx.font = `700 24px ${monoFont}`;
    ctx.globalAlpha = 0.4;
    ctx.fillText("DISTANCE", -w / 2 + 60, -h / 2 + 200);

    ctx.textAlign = 'right';
    ctx.globalAlpha = 1.0;
    ctx.font = `italic 900 85px ${sysFont}`;
    ctx.fillText(`${main.value} ${main.unit || ''}`, w / 2 - 60, -h / 2 + 200);
    ctx.restore();

    // Sub Row 1: Average
    const pace = p[1] || { value: '0:00', unit: '/km' };
    ctx.save();
    ctx.globalAlpha = 0.1;
    ctx.fillRect(-w / 2 + 60, -h / 2 + 260, w - 120, 2);
    ctx.globalAlpha = 0.4;
    ctx.font = `700 24px ${monoFont}`;
    ctx.fillText("AVERAGE", -w / 2 + 60, -h / 2 + 330);

    ctx.textAlign = 'right';
    ctx.globalAlpha = 1.0;
    ctx.font = `italic 900 50px ${sysFont}`;
    ctx.fillText(`${pace.value} ${pace.unit || ''}`, w / 2 - 60, -h / 2 + 330);
    ctx.restore();

    // Sub Row 2: Duration
    const duration = p[2] || { value: '0:00' };
    ctx.save();
    ctx.globalAlpha = 0.1;
    ctx.fillRect(-w / 2 + 60, -h / 2 + 390, w - 120, 2);
    ctx.globalAlpha = 0.4;
    ctx.font = `700 24px ${monoFont}`;
    ctx.fillText("DURATION", -w / 2 + 60, -h / 2 + 460);

    ctx.textAlign = 'right';
    ctx.globalAlpha = 1.0;
    ctx.font = `italic 900 50px ${sysFont}`;
    ctx.fillText(duration.value, w / 2 - 60, -h / 2 + 460);
    ctx.restore();

    // Footer - Dashed divider
    ctx.save();
    ctx.setLineDash([10, 10]);
    ctx.strokeStyle = 'rgba(0,0,0,0.1)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-w / 2 + 60, h / 2 - 120);
    ctx.lineTo(w / 2 - 60, h / 2 - 120);
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.font = `900 18px ${monoFont}`;
    ctx.globalAlpha = 0.3;
    if (typeof ctx.letterSpacing !== 'undefined') ctx.letterSpacing = "15px";

    // Replace branding with activity name
    const footerText = (stats.shortTitle || stats.title || 'SCORA RECORD').toUpperCase().substring(0, 22);
    ctx.fillText(footerText, 0 + 7.5, h / 2 - 60);
    ctx.restore();

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
    ctx.font = `italic 700 28px ${sysFont}`;
    ctx.fillStyle = textColor === 'black' ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.3)';
    if (typeof ctx.letterSpacing !== 'undefined') ctx.letterSpacing = "10px";
    // Distance from baseline of main text to date baseline
    ctx.fillText(datePoint.value.toUpperCase(), cx, cy - 350);
    ctx.restore();

    // 2. Main value + unit inline (e.g. "8.02" in hero + "km" as inline tag)
    const heroValue = main.value;
    let fontSize = heroValue.length > 5 ? 180 : 350;
    ctx.font = `italic 900 ${fontSize}px ${sysFont}`;
    const textWidth = ctx.measureText(heroValue).width;
    const maxWidth = 840; // leave room for unit
    if (textWidth > maxWidth) {
        fontSize *= (maxWidth / textWidth);
        ctx.font = `italic 900 ${fontSize}px ${sysFont}`;
    }
    ctx.fillStyle = textColor === 'black' ? 'black' : 'white';
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
    const sysFont = "'Plus Jakarta Sans', sans-serif";
    const p = stats.dataPoints || [];
    const p1 = p[0] || { value: '0.00', label: 'Dist', unit: 'km' };
    const p2 = p[1] || { value: '0:00', label: 'Pace', unit: '' };
    const p3 = p[2] || { value: '0m', label: 'Time', unit: '' };

    const cx = 540;
    const cy = 1750;
    const barW = 880;
    const barH = 160;

    // Background - solid pill (user asked for no opacity)
    ctx.fillStyle = textColor === 'black' ? 'black' : 'white';
    const radius = 20;
    ctx.beginPath();
    ctx.roundRect(cx - barW / 2, cy - barH / 2, barW, barH, radius);
    ctx.fill();

    const drawCell = (data: any, x: number) => {
        ctx.save();
        ctx.translate(x, cy);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Main Value
        ctx.fillStyle = textColor === 'black' ? 'white' : 'black';
        ctx.font = `600 55px ${sysFont}`;
        ctx.fillText(data.value, 0, -20);

        ctx.font = `800 24px ${sysFont}`;
        if (typeof ctx.letterSpacing !== 'undefined') ctx.letterSpacing = "6px";
        const labelText = (data.unit || data.label).toUpperCase();
        ctx.fillText(labelText, 0, 35);
        ctx.restore();
    };

    drawCell(p1, cx - 280);
    drawCell(p2, cx);
    drawCell(p3, cx + 280);
}

export function drawModernPill(ctx: CanvasRenderingContext2D, stats: any, textColor: string) {
    const sysFont = "'Plus Jakarta Sans', sans-serif";
    const p = stats.dataPoints || [];
    const main = p[0] || { value: '0.00', label: 'Dist', unit: 'km' };
    const sub = p[1] || { value: '0:00', label: 'Pace', unit: '/km' };

    const cx = 540;
    const cy = 1750;
    const w = 920;
    const h = 200;
    const radius = 100; // Full pill caps

    ctx.save();

    // 1. Black/Glass Background
    ctx.beginPath();
    ctx.roundRect(cx - w / 2, cy - h / 2, w, h, radius);
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; // Matching React's bg-black/60
    ctx.fill();

    // Border
    ctx.strokeStyle = 'rgba(255,255,255,0.1)'; // white/10%
    ctx.lineWidth = 2;
    ctx.stroke();

    // 2. Data
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillStyle = 'white';

    // Main Stat (Distance)
    ctx.font = `italic 900 130px ${sysFont}`; // text-5xl equivalent on canvas
    const valText = main.value;
    const valW = ctx.measureText(valText).width;
    ctx.fillText(valText, cx - w / 2 + 80, cy - 10);

    // Main Unit
    ctx.font = `900 20px ${sysFont}`; // text-[9px] equivalent
    ctx.fillStyle = 'rgba(255,255,255,0.2)'; // white/20%
    if (typeof ctx.letterSpacing !== 'undefined') ctx.letterSpacing = "8px";
    ctx.fillText((main.unit || main.label).toUpperCase(), cx - w / 2 + 80, cy + 60);
    ctx.letterSpacing = "0px";

    // Separator Line
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.fillRect(cx - w / 2 + 80 + valW + 50, cy - 40, 2, 80);

    // Sub Stat (Pace)
    ctx.fillStyle = 'rgba(255,255,255,0.8)'; // white/80%
    ctx.font = `italic 900 85px ${sysFont}`; // text-3xl
    const subX = cx - w / 2 + 80 + valW + 110;
    ctx.fillText(sub.value, subX, cy - 10);

    // Sub Unit (PACE label)
    ctx.font = `900 20px ${sysFont}`;
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    if (typeof ctx.letterSpacing !== 'undefined') ctx.letterSpacing = "8px";
    ctx.fillText((sub.label || sub.unit || "PACE").toUpperCase(), subX, cy + 60);
    ctx.letterSpacing = "0px";

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
    ctx.font = `italic 900 ${isLong ? '100px' : '235px'} ${sysFont}`;
    ctx.fillStyle = textColor === 'black' ? 'black' : 'white';
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
    const sysFont = "'Plus Jakarta Sans', sans-serif";
    const p = stats.dataPoints || [];
    const p1 = p[0] || { value: '0.00', label: 'Dist', unit: 'km' };
    const p2 = p[1] || { value: '0:00', label: 'Pace', unit: '/km' };

    const cx = 540;
    const cy = 1750;
    const w = 880;
    const h = 160;
    const radius = 20;

    // Left Half (White)
    ctx.beginPath();
    ctx.roundRect(cx - w / 2, cy - h / 2, w / 2, h, [radius, 0, 0, radius]);
    ctx.fillStyle = textColor === 'black' ? 'white' : 'black';
    ctx.fill();

    // Right Half (Black/Transparent)
    ctx.beginPath();
    ctx.roundRect(cx, cy - h / 2, w / 2, h, [0, radius, radius, 0]);
    ctx.fillStyle = textColor === 'black' ? 'black' : 'white';
    ctx.fill();

    // Left Data
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = textColor === 'black' ? 'black' : 'white';
    ctx.font = `600 55px ${sysFont}`;
    ctx.fillText(p1.value, cx - w / 4, cy - 20);
    ctx.font = `800 24px ${sysFont}`;
    if (typeof ctx.letterSpacing !== 'undefined') ctx.letterSpacing = "6px";
    ctx.fillText((p1.unit || p1.label).toUpperCase(), cx - w / 4, cy + 35);

    // Right Data
    ctx.fillStyle = textColor === 'black' ? 'white' : 'black';
    ctx.font = `600 55px ${sysFont}`;
    ctx.fillText(p2.value, cx + w / 4, cy - 20);
    ctx.font = `800 24px ${sysFont}`;
    if (typeof ctx.letterSpacing !== 'undefined') ctx.letterSpacing = "6px";
    ctx.fillText(p2.label.toUpperCase(), cx + w / 4, cy + 35);
    ctx.letterSpacing = "0px";
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
    ctx.font = `italic 900 18px ${sysFont}`;
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
    ctx.font = `italic 900 230px ${sysFont}`;
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
    ctx.font = `italic 900 55px ${sysFont}`;
    ctx.fillText(p2.value, -w / 2 + 50, footerY + 20);

    // Time column
    ctx.textAlign = 'right';
    ctx.globalAlpha = 0.3;
    ctx.font = `900 14px ${sysFont}`;
    ctx.fillText("TIME", w / 2 - 50, footerY - 25);
    ctx.globalAlpha = 1.0;
    ctx.font = `italic 900 55px ${sysFont}`;
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

    ctx.fillStyle = textColor === 'black' ? 'black' : 'white';
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
    ctx.font = `italic 100 110px ${sysFont}`;
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
        ctx.fillStyle = textColor === 'black' ? 'black' : 'white';
        let fontSize = size;
        ctx.font = `italic 900 ${fontSize}px ${sysFont}`;
        const w = ctx.measureText(data.value).width;
        if (w > colW - 20) fontSize *= ((colW - 20) / w);
        ctx.font = `italic 900 ${fontSize}px ${sysFont}`;
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
    ctx.font = `italic 900 ${fontSize}px ${sysFont}`;
    const textW = ctx.measureText(main.value).width;
    if (textW > boxH_top * 0.75) { // Tighter constraint (was 0.8)
        fontSize *= (boxH_top * 0.75 / textW);
        ctx.font = `italic 900 ${fontSize}px ${sysFont}`;
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
        ctx.font = `italic ${weight} ${size}px ${sysFont}`;
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
    ctx.fillStyle = textColor === 'black' ? 'black' : 'white';
    const isLongStr = main.value.length > 5;
    ctx.font = `italic 900 ${isLongStr ? '70px' : '140px'} ${sysFont}`;
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
    const serifFont = "'Libertinus Math', serif";
    const highlightColor = "#FFD644";
    const bgColor = "#fbf9f4"; // Tactile off-white
    const textCol = "#1a1a1a";

    const cx = 540;
    const cy = 960;

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

    const isWorkout = activityLower.includes('workout') || activityLower.includes('training') || activityLower.includes('gym');

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
    ctx.fillStyle = "#ffffff";
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
            const hH = baseFontSize * 1.05; // Thicker highlight
            // Slightly irregular highlight for "marker" feel
            ctx.fillRect(x - 8, y - hH / 2 + 5, width + 16, hH);
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
    const cy = 960;
    const startX = 110; // Studio Standard Left Alignment
    const rightCol = 580;

    // 1. Unified Sizing Constants (v13.0 Solid Unification)
    const HEADER_SIZE = 90;
    const DATA_SIZE = 65; // Universal scale for all metrics
    const UNIT_SIZE = 24;
    const UNIT_OFFSET = 100;
    const ROW_GAP = 220;

    const isDarkStr = textColor === 'white';
    const baseColor = isDarkStr ? '#FFFFFF' : '#000000'; // 100% Solid

    // 2. Data Intelligence
    const rawDate = stats.rawDate ? new Date(stats.rawDate) : new Date();
    const weekday = new Intl.DateTimeFormat('es-ES', { weekday: 'long' }).format(rawDate).toUpperCase();
    const dayNum = rawDate.getDate().toString().padStart(2, '0');
    const startTimeResult = (stats.startTime || '10:24 PM').toUpperCase();
    const isWorkout = stats.type === 'Workout';
    const distValueResult = isWorkout ? (stats.timeStr || '0m') : (stats.distanceVal || '0.00');
    const distUnitResult = isWorkout ? 'DURATION' : (parseFloat(distValueResult) === 1 ? 'KILOMETER' : 'KILOMETERS');
    const paceValueResult = (stats.subValue || '').split(' ')[0] || '0:00';
    const paceUnitResult = (stats.subValue || '').split(' ')[1] || (stats.type === 'Ride' ? 'KM/H' : '/KM');
    const paceLabelResult = (stats.subLabel || (stats.type === 'Ride' ? 'Avg Speed' : 'Pace')).toUpperCase();
    const locationNameResult = (stats.location || 'MEXICO').toUpperCase();

    // 3. Rendering Engine
    ctx.save();

    // NO SHADOWS, NO TRANSPARENCY - 100% FLAT STICKER LOOK
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = baseColor;

    function renderSolidItem(text: string, x: number, y: number, size: number, weight = '900', spacing = '-0.05em') {
        ctx.font = `${weight} ${size}px 'Inter', sans-serif`;
        (ctx as any).letterSpacing = spacing;
        ctx.fillText(text, x, y);
    }

    function renderSolidUnit(text: string, x: number, y: number) {
        ctx.font = `800 ${UNIT_SIZE}px 'Inter', sans-serif`;
        (ctx as any).letterSpacing = "0.15em";
        ctx.fillText(text, x, y);
    }

    let currY = cy - 500;

    // A. HEADER: DAY + NUMBER (Solid & Identical)
    renderSolidItem(weekday, startX, currY, HEADER_SIZE, '800', '-0.06em');
    currY += 90;
    renderSolidItem(dayNum, startX, currY, HEADER_SIZE, '800', '-0.06em');
    currY += 240;

    // B. GRID ROW 1: TIME | DISTANCE
    renderSolidItem(startTimeResult, startX, currY, DATA_SIZE, '900', '-0.05em');
    renderSolidUnit("LOCAL TIME", startX, currY + UNIT_OFFSET);

    renderSolidItem(distValueResult, rightCol, currY, DATA_SIZE, '900', '-0.05em');
    renderSolidUnit(distUnitResult, rightCol, currY + UNIT_OFFSET);

    currY += ROW_GAP;

    // C. GRID ROW 2: PACE | LOCATION
    renderSolidItem(paceValueResult, startX, currY, DATA_SIZE, '900', '-0.05em');
    renderSolidUnit(`${paceLabelResult} (${paceUnitResult})`, startX, currY + UNIT_OFFSET);

    // Location with Smart Scaling
    const locMaxW = 400; // Available space in the right column
    ctx.font = `900 ${DATA_SIZE}px 'Inter', sans-serif`;
    let locFontSize = DATA_SIZE;
    const locWidth = ctx.measureText(locationNameResult).width;
    if (locWidth > locMaxW) {
        locFontSize = Math.floor(DATA_SIZE * (locMaxW / locWidth));
    }
    renderSolidItem(locationNameResult, rightCol, currY, locFontSize, '900', '-0.05em');
    renderSolidUnit("LOCATION", rightCol, currY + UNIT_OFFSET);

    ctx.restore();
}

// ─── New Stickers Support Helpers ──────────────────────────────────────────

export function drawStackedEditorial(ctx: CanvasRenderingContext2D, stats: any, textColor: string) {
    const colors = getThemeColors(textColor);
    const { s1, s2, hasMap } = getDynamicStats(stats);

    const cx = 540;
    const cy = 960; // adjusted for center
    const aestheticFont = "'Outfit', sans-serif";

    ctx.save();

    // 1. Title (Top, Clean Sans, Spaced)
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `500 50px ${aestheticFont}`;
    ctx.fillStyle = colors.solid;
    setLetterSpacing(ctx, "0.1em");
    ctx.fillText((stats.title || "Activity").toUpperCase(), cx, 200);
    setLetterSpacing(ctx, "0px");
    // 2. Map (Large, Center)
    if (hasMap) {
        drawRoutePath(ctx, stats.polyline, cx, 850, 650, {
            color: colors.solid,
            strokeWidth: 2.5
        });
    }

    // 3. Stats (Small in bottom-right corner)
    const drawCompactStat = (data, x, y) => {
        ctx.save();
        ctx.translate(x, y);
        ctx.textAlign = 'right';

        // Value
        ctx.font = `700 90px ${aestheticFont}`;
        ctx.fillStyle = colors.solid;
        ctx.fillText(data.value, 0, 0);

        // Label - Increased visibility
        ctx.font = `700 32px ${aestheticFont}`;
        ctx.fillStyle = colors.label;
        ctx.globalAlpha = 0.9;
        setLetterSpacing(ctx, "0.3em");
        ctx.fillText(data.label.toUpperCase(), 0, 55);
        ctx.restore();
    };

    const cornerX = 980;
    const cornerY = 1750;

    // For this compact sticker, we prefer shorter labels
    const displayS2 = { ...s2 };
    if (displayS2.label === 'AVG SPEED') displayS2.label = 'KM/H';
    if (displayS2.label === 'AVG HEARTRATE') displayS2.label = 'BPM';

    drawCompactStat(displayS2, cornerX, cornerY); // Pace / Speed / HR
    drawCompactStat(s1, cornerX - 320, cornerY); // Distance / Duration (Increased gap to 320px)

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
    ctx.textBaseline = 'middle';

    const { s1, s2, s3, hasMap } = getDynamicStats(stats);

    const cx = 540;
    const cy = 1000;
    const serifFont = "'Playfair Display', serif";
    const sansFont = "'Plus Jakarta Sans', sans-serif";

    ctx.save();
    // 1. Header (Top, Small Sans, Wide)
    ctx.font = `800 24px ${sansFont}`;
    ctx.fillStyle = colors.label;
    ctx.globalAlpha = 0.6;
    setLetterSpacing(ctx, "0.5em");
    ctx.fillText((stats.title || "Activity").toUpperCase(), cx, cy - 400);
    setLetterSpacing(ctx, "0px");
    ctx.globalAlpha = 1.0;

    // 2. Map Backdrop (Massive) - Only if exists
    if (hasMap) {
        ctx.globalAlpha = 0.45; // Increased visibility from 0.2
        drawRoutePath(ctx, stats.polyline, cx, cy, 600, {
            color: colors.solid,
            strokeWidth: 2
        });
        ctx.globalAlpha = 1.0;
    }

    // 3. Hero Value - Dynamic scaling for large distances (Studio Precision)
    let vFontSize = 480;
    ctx.font = `italic 500 ${vFontSize}px ${serifFont}`;
    const vWidth = ctx.measureText(s1.value).width;
    ctx.font = `italic 700 80px ${serifFont}`;
    const uWidth = ctx.measureText(s1.label).width;
    const totalW = vWidth + 30 + uWidth;

    if (totalW > 960) {
        vFontSize = Math.floor(vFontSize * (960 / totalW));
    }

    drawStatWithUnit(ctx, cx, cy, s1.value, s1.label, {
        valueFont: `italic 500 ${vFontSize}px ${serifFont}`,
        unitFont: `italic 700 ${Math.max(40, Math.floor(vFontSize * 0.16))}px ${serifFont}`,
        valueColor: colors.solid,
        unitColor: colors.trans,
        gap: Math.max(10, Math.floor(vFontSize * 0.06)),
        align: 'center'
    });

    // 4. Footer Row - Increased visibility
    const footY = cy + 300;
    ctx.font = `italic 500 60px ${serifFont}`;
    ctx.fillStyle = colors.solid; // Solid
    setLetterSpacing(ctx, "0.15em");
    const footerText = `${s2.value} ${s2.label} / ${s3.value} ${s3.label}`;
    ctx.fillText(footerText.toUpperCase(), cx, footY);
    setLetterSpacing(ctx, "0px");

    ctx.restore();
}

export function drawMicroSerif(ctx: CanvasRenderingContext2D, stats: any, textColor: string) {
    const colors = getThemeColors(textColor);
    const { s1, s2, hasMap } = getDynamicStats(stats);

    // EB Garamond (italic for values, normal for units)
    const serifFont = "'EB Garamond', serif";
    const startX = 80; // Shifted left (was 120)
    const bottomY = 1850;

    ctx.save();

    // 1. Drop Shadow
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 4;

    // 2. Measure for dynamic spacing
    ctx.font = `italic 500 120px ${serifFont}`;
    const v1W = ctx.measureText(s1.value).width;
    const v2W = ctx.measureText(s2.value).width;
    ctx.font = `400 48px ${serifFont}`;
    const u1W = ctx.measureText(s1.label.toLowerCase()).width;
    const paceUnit = s2.label === 'TIME' ? '' : (s2.label === 'BPM' ? 'bpm' : (s2.label === 'KM/H' ? 'km/h' : '/km'));
    const u2W = ctx.measureText(paceUnit).width;

    const block1W = v1W + 20 + u1W;
    const s2X = startX + block1W + 80; // 80px gap between blocks
    const block2W = v2W + 20 + u2W;
    const mapX = s2X + block2W + 80; // 80px gap before map

    // 3. Distance Block
    drawMetricBlock(ctx, startX, bottomY, 'Distance', s1.value, s1.label.toLowerCase(), {
        showLabel: false,
        labelFont: `400 32px ${serifFont}`,
        valueFont: `italic 500 120px ${serifFont}`,
        unitFont: `400 48px ${serifFont}`,
        color: 'white',
        unitGap: 20
    });

    // 4. Pace/Speed Block
    drawMetricBlock(ctx, s2X, bottomY, s2.label, s2.value, paceUnit, {
        showLabel: false,
        labelFont: `400 32px ${serifFont}`,
        valueFont: `italic 500 120px ${serifFont}`,
        unitFont: `400 48px ${serifFont}`,
        color: 'white',
        unitGap: 20
    });

    // 5. Map Route Block
    if (hasMap) {
        ctx.save();
        ctx.globalAlpha = 0.9;
        // Vertically aligned with values
        drawRoutePath(ctx, stats.polyline, mapX + 80, bottomY - 35, 160, {
            color: 'white',
            strokeWidth: 3.5
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
        ctx.font = `italic 900 ${valSize}px ${interFont}`;
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
    ctx.font = `italic 900 120px ${interFont}`;
    ctx.fillText(stats.distanceVal || '0.0', padding, footerY + 60);

    // Footer: Avg Pace
    ctx.textAlign = 'right';
    ctx.fillStyle = trans;
    ctx.font = `900 22px ${interFont}`;
    setLetterSpacing(ctx, '4px');
    ctx.fillText('PACE', canvasW - padding, footerY - 10);
    setLetterSpacing(ctx, '0px');

    ctx.fillStyle = solid;
    ctx.font = `italic 900 120px ${interFont}`;
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
    const startY = 960 - (pillH / 2);

    // ... (Background draw unchanged)
    const isDark = textColor === 'white';
    const bgFill = isDark ? 'rgba(20, 20, 22, 0.95)' : 'rgba(255, 255, 255, 0.95)';
    const shadowC = isDark ? 'rgba(0, 0, 0, 0.6)' : 'rgba(0, 0, 0, 0.2)';
    const mainFill = isDark ? '#ffffff' : '#000000';
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
        // (Icon draw unchanged)
        ctx.save();
        ctx.translate(currentX + 8, startY + 32);
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

    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';

    // Left Border 
    ctx.fillStyle = c.accent;
    ctx.fillRect(80, 1400, 16, 320);

    const mainVal = stats.mainValue ? stats.mainValue.replace(/[a-zA-Z]/g, '').trim() : stats.distanceVal || '0.00';
    const mainUnit = stats.mainValue ? stats.mainValue.replace(/[0-9.]/g, '').trim() || (stats.hasDistance ? 'km' : 'm') : 'km';

    ctx.font = "italic 900 180px 'Plus Jakarta Sans'";
    ctx.fillStyle = c.solid;
    ctx.fillText(mainVal, 140, 1580);

    const valW = ctx.measureText(mainVal).width;

    ctx.font = "900 60px 'Plus Jakarta Sans'";
    ctx.fillStyle = c.trans;
    ctx.fillText(mainUnit.toUpperCase(), 140 + valW + 20, 1580);

    // Sub grid
    ctx.font = "800 35px 'Plus Jakarta Sans'";
    if ((ctx as any).letterSpacing !== undefined) {
        (ctx as any).letterSpacing = "6px";
    }
    // Using opacity
    ctx.globalAlpha = 0.8;
    ctx.fillStyle = c.accent;

    // Split subValue (e.g. "4:27 /km") into its parts to avoid double-appending the unit.
    const subParts = (stats.subValue || '').trim().split(' ');
    const subVal = subParts[0] || '';
    const subUnit = subParts[1] || (subVal.includes(':') ? '/km' : '');
    const subString = `${subVal} ${subUnit}  ·  ${stats.startTime || ''}`.toUpperCase();
    ctx.fillText(subString, 140, 1680);
    ctx.globalAlpha = 1.0;
    if ((ctx as any).letterSpacing !== undefined) {
        (ctx as any).letterSpacing = "0px";
    }
}

// ─── SCORA 20 COLLECTION ────────────────────────────────────────────────────────

export function drawMassiveSerif(ctx: CanvasRenderingContext2D, stats: any, textColor = 'white') {
    const isDark = textColor === 'white';
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
        ctx.font = `italic 900 ${fontSize}px 'Playfair Display'`;

        // Auto-scale
        while (ctx.measureText(displayVal).width > 900 && fontSize > 150) {
            fontSize -= 20;
            ctx.font = `italic 900 ${fontSize}px 'Playfair Display'`;
        }

        if ((ctx as any).letterSpacing !== undefined) { (ctx as any).letterSpacing = "-0.05em"; }
        ctx.fillText(displayVal, cx, cy + 40);
    } else {
        // From React #01: Value is massive, unit is far below and spaced out
        const mainVal = String(rawVal).replace(/[a-zA-Z]/g, '').trim();
        const mainUnit = (String(rawVal).replace(/[0-9.]/g, '').trim() || 'km').toUpperCase();

        let fontSize = 520;
        ctx.font = `italic 900 ${fontSize}px 'Playfair Display'`;

        // Auto-scale
        while (ctx.measureText(mainVal).width > 920 && fontSize > 200) {
            fontSize -= 40;
            ctx.font = `italic 900 ${fontSize}px 'Playfair Display'`;
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

    ctx.font = "italic 900 40px 'Plus Jakarta Sans'";
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
    const isDark = textColor === 'white';
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
    ctx.font = "italic 900 40px 'Plus Jakarta Sans'";
    ctx.fillText(mainVal, currentX, startY + 62);

    if (mainUnit) {
        currentX += valW + 8;
        ctx.font = "800 24px 'Plus Jakarta Sans'";
        ctx.fillText(mainUnit.toUpperCase(), currentX, startY + 62);
    }
}

export function drawStatement(ctx: CanvasRenderingContext2D, stats: any, textColor = 'white') {
    const isDark = textColor === 'white';
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
    ctx.font = "italic 500 70px 'EB Garamond'";

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
    const isDark = textColor === 'white';
    const cSolid = isDark ? '#ffffff' : '#000000';
    const cOpposite = isDark ? '#000000' : '#ffffff';

    const rawVal = stats.mainValue || stats.distanceVal || '0.00';
    const displayVal = String(rawVal).trim();

    let type = stats.type || stats.activityType || 'Run';
    const baseActivity = normalizeSport(type);
    type = applyActivityCasing(baseActivity, 'brutalist-letters');

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Giant Background Type
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = cSolid;

    // Dynamic Scale for large labels (WORKOUT is longer than RUN)
    let fontSize = 380;
    ctx.font = `900 ${fontSize}px 'Plus Jakarta Sans'`;
    if ((ctx as any).letterSpacing !== undefined) { (ctx as any).letterSpacing = "-0.05em"; }
    let textWidth = ctx.measureText(type).width;
    const maxW = 980; // 1080 - 100 margin

    if (textWidth > maxW) {
        fontSize = Math.floor(fontSize * (maxW / textWidth));
        ctx.font = `900 ${fontSize}px 'Plus Jakarta Sans'`;
    }

    ctx.fillText(type, 540, 960);
    if ((ctx as any).letterSpacing !== undefined) { (ctx as any).letterSpacing = "0px"; }
    ctx.globalAlpha = 1.0;

    // Foreground Box
    ctx.font = "italic 900 80px 'Plus Jakarta Sans'";
    if ((ctx as any).letterSpacing !== undefined) { (ctx as any).letterSpacing = "-0.05em"; }
    const txtW = ctx.measureText(displayVal).width;
    const txtH = 100;

    ctx.fillStyle = cSolid;
    ctx.fillRect(540 - (txtW / 2) - 40, 960 + 50, txtW + 80, txtH);

    ctx.fillStyle = cOpposite;
    ctx.fillText(displayVal, 540, 960 + 105);
    if ((ctx as any).letterSpacing !== undefined) { (ctx as any).letterSpacing = "0px"; }
}

export function drawTinyGPS(ctx: CanvasRenderingContext2D, stats: any, textColor = 'white') {
    const isDark = textColor === 'white';
    const cSolid = isDark ? '#ffffff' : '#000000';

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
    ctx.fillText(coordStr.toUpperCase(), 540, 880);
    if ((ctx as any).letterSpacing !== undefined) { (ctx as any).letterSpacing = "0px"; }

    // Tiny Accent Line
    ctx.globalAlpha = 0.3;
    ctx.fillRect(440, 930, 200, 2);

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
    ctx.fillText(fullText, 540, 995);
    if ((ctx as any).letterSpacing !== undefined) { (ctx as any).letterSpacing = "0px"; }
}

export function drawMagCover(ctx: CanvasRenderingContext2D, stats: any, textColor = 'white') {
    const isDark = textColor === 'white';
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
    ctx.font = "italic 900 160px 'Playfair Display'";
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
    const isDark = textColor === 'white';
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
    ctx.font = "italic 900 65px 'Plus Jakarta Sans'";

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
    const isDark = textColor === 'white';
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
    const isDark = textColor === 'white';
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
    ctx.font = "italic 900 85px 'Plus Jakarta Sans'";
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
    const isDark = textColor === 'white';
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
    ctx.font = "italic 400 65px 'EB Garamond'";
    ctx.fillText(tagline, cx, cy - 100);

    // 2. Massive Value
    ctx.globalAlpha = 1.0;
    ctx.font = "italic 900 180px 'Playfair Display'";
    if ((ctx as any).letterSpacing !== undefined) { (ctx as any).letterSpacing = "-0.05em"; }
    ctx.fillText(displayVal, cx, cy + 40);

    ctx.shadowBlur = 0;
    if ((ctx as any).letterSpacing !== undefined) { (ctx as any).letterSpacing = "0px"; }
}

export function drawMonoGhost(ctx: CanvasRenderingContext2D, stats: any, textColor = 'white') {
    const isDark = textColor === 'white';
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
    ctx.font = "italic 300 240px 'JetBrains Mono'";
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
    const isDark = textColor === 'white';
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
    ctx.font = "italic 900 110px 'Playfair Display'";
    ctx.fillText(displayVal, 540, cy + 20);
}


export function drawMarginalia(ctx: CanvasRenderingContext2D, stats: any, textColor = 'white') {
    const isDark = textColor === 'white';
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
    ctx.font = "italic 400 80px 'EB Garamond'";
    ctx.fillText(stats.title || 'Workout', 50, -40);

    ctx.globalAlpha = 0.3;
    ctx.fillText(mainVal, 50, 40);

    ctx.restore();
}

export function drawTypewriterMono(ctx: CanvasRenderingContext2D, stats: any, textColor = 'white') {
    const isDark = textColor === 'white';
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
    ctx.font = "bold italic 85px 'Courier Prime'";
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
    const isDark = textColor === 'white';
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
    ctx.font = "italic 900 140px 'Plus Jakarta Sans'";
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
    const isDark = textColor === 'white';
    const bgFill = isDark ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.7)';
    const cSolid = isDark ? '#ffffff' : '#000000';
    const borderFill = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const displayVal = (stats.mainValue || stats.distanceVal || '0.00').toString().trim();
    ctx.font = "italic 300 85px 'JetBrains Mono'";
    const txtW = ctx.measureText(displayVal).width;
    const boxW = Math.max(txtW + 120, 340);
    const boxH = 180;
    const cx = 540;
    const cy = 960;

    // Box
    ctx.fillStyle = bgFill;
    ctx.beginPath();
    ctx.rect(cx - boxW / 2, cy - boxH / 2, boxW, boxH);
    ctx.fill();

    ctx.strokeStyle = borderFill;
    ctx.lineWidth = 2;
    ctx.stroke();

    let type = stats.type || stats.activityType || 'Run';
    type = applyActivityCasing(normalizeSport(type), 'mono-minimal');

    // Text
    ctx.fillStyle = cSolid;
    ctx.globalAlpha = 0.3;
    ctx.font = "400 20px 'JetBrains Mono'";
    if ((ctx as any).letterSpacing !== undefined) { (ctx as any).letterSpacing = "0.2em"; }
    ctx.fillText(type, cx, cy - 35);
    if ((ctx as any).letterSpacing !== undefined) { (ctx as any).letterSpacing = "0px"; }

    ctx.globalAlpha = 1.0;
    ctx.font = "italic 300 85px 'JetBrains Mono'";
    ctx.fillText(displayVal, cx, cy + 30);
}

export function drawSwissMinimal(ctx: CanvasRenderingContext2D, stats: any, textColor = 'white') {
    const isDark = textColor === 'white';
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
    const isDark = textColor === 'white';
    const cSolid = isDark ? '#ffffff' : '#000000';
    const borderFill = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const cx = 540;
    const cy = 960;

    const mainVal = (stats.mainValue || stats.distanceVal || (stats.timeStr ? stats.timeStr : '0.00')).toString().trim();
    const mainUnit = stats.mainValue ? stats.mainValue.replace(/[0-9.]/g, '').trim() || 'km' : (stats.timeStr && !stats.distanceVal ? 'time' : 'km');

    let subVal = '0:00';
    let subUnit = 'pace';
    if (stats.dataPoints) {
        const pacePt = stats.dataPoints.find((p: any) => p.label === 'Pace' || p.label === 'Avg Speed');
        if (pacePt) {
            subVal = pacePt.value;
            subUnit = pacePt.label === 'Avg Speed' ? 'km/h' : 'pace';
        } else {
            const timePt = stats.dataPoints.find((p: any) => p.label === 'Time' || p.label === 'Duration');
            if (timePt) {
                subVal = timePt.value;
                subUnit = (timePt.label || 'TIME').toLowerCase();
            }
        }
    }

    const hr = stats.avgHeartrate || stats.maxHeartrate || '-';

    const rowW = 800;
    const rowH = 140;

    // Borders
    ctx.fillStyle = borderFill;
    ctx.fillRect(cx - rowW / 2, cy - rowH / 2, rowW, 2);
    ctx.fillRect(cx - rowW / 2, cy + rowH / 2 - 2, rowW, 2);

    // Columns
    const colW = rowW / 3;

    for (let i = 0; i < 3; i++) {
        const x = cx - rowW / 2 + (i * colW) + colW / 2;

        let v = '', u = '';
        if (i === 0) { v = mainVal; u = mainUnit; }
        if (i === 1) { v = subVal; u = subUnit; }
        if (i === 2) { v = hr.toString(); u = 'bpm'; }

        ctx.globalAlpha = 1.0;
        ctx.fillStyle = cSolid;
        ctx.font = "italic 900 50px 'Playfair Display'";
        ctx.fillText(v, x, cy - 10);

        ctx.globalAlpha = 0.3;
        ctx.font = "800 16px 'Plus Jakarta Sans'";
        if ((ctx as any).letterSpacing !== undefined) { (ctx as any).letterSpacing = "0.2em"; }
        ctx.fillText(u.toUpperCase(), x, cy + 40);
        if ((ctx as any).letterSpacing !== undefined) { (ctx as any).letterSpacing = "0px"; }
    }
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
        ctx.fillText(stats.avgTemp + '°', 1000, 150);
    }

    ctx.font = "900 24px 'Plus Jakarta Sans'";
    ctx.fillStyle = c.trans;
    ctx.fillText('LOCAL TIME', 1000, 220);

    ctx.font = "700 32px 'Plus Jakarta Sans'";
    ctx.fillStyle = c.solid;
    const timeDisplay = (stats.startTime || '--:--').toUpperCase();
    const durDisplay = stats.timeStr ? ` | ${stats.timeStr.toUpperCase()}` : '';
    ctx.fillText(`${timeDisplay}${durDisplay}`, 1000, 265);

    // 2. Vertical Day Headline
    ctx.save();
    ctx.translate(900, 1000);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';

    // Dynamic Greeting
    ctx.font = "900 28px 'Inter'";
    ctx.fillStyle = c.trans;
    setLetterSpacing(ctx, '12px');
    ctx.fillText(getGreeting(stats.startTime), 0, -290);
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
    ctx.fillText(dayStr, 0, -125);
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
    const mainUnit = stats.hasDistance ? 'KM' : 'TIME';

    drawStatWithUnit(ctx, 100, bottomY + 70, mainVal, mainUnit, { // 80 -> 70
        valueFont: "900 84px 'Inter'",
        unitFont: "700 32px 'Plus Jakarta Sans'",
        valueColor: c.solid,
        unitColor: c.trans,
        gap: 20,
        align: 'left'
    });
}

export function drawSciencePro(ctx: CanvasRenderingContext2D, stats: any, textColor: string) {
    const accent = '#A3FFD6';
    ctx.textAlign = 'center';

    // 1. Header (Ultra-Compact + Scaled)
    const title = (stats.title || stats.type || 'Activity').toUpperCase();
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

    const isWorkout = stats.type?.toLowerCase().includes('workout') || stats.type?.toLowerCase().includes('training') || !stats.hasDistance;
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
    ctx.font = `italic 900 320px ${sysFont}`;
    ctx.fillStyle = textColor === 'black' ? 'black' : '#fbbf24';
    ctx.fillText(valText, cx, cy - 140);

    // 2. Unit
    ctx.font = `italic 900 140px ${sysFont}`;
    ctx.fillStyle = textColor === 'black' ? 'rgba(0,0,0,0.85)' : 'white';
    ctx.fillText(unitText, cx, cy + 80);

    // 3. Location (Subtitle)
    ctx.shadowOffsetX = 3;
    ctx.shadowOffsetY = 3;
    ctx.font = `italic 900 58px ${sysFont}`;
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
    ctx.font = `italic 900 85px ${sysFont}`;
    ctx.fillStyle = grad;

    ctx.shadowColor = 'rgba(22, 78, 99, 0.8)';
    ctx.shadowOffsetX = 5;
    ctx.shadowOffsetY = 5;
    ctx.shadowBlur = 0;
    ctx.fillText(activity, 0, -60);

    // 3. Values (Width-Aware Fit)
    let fontSize = 120;
    ctx.font = `italic 900 ${fontSize}px ${sysFont}`;

    // Safety check: ensure combined text fits in width
    while (ctx.measureText(fullMainText).width > w - 100 && fontSize > 40) {
        fontSize -= 5;
        ctx.font = `italic 900 ${fontSize}px ${sysFont}`;
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
    ctx.font = `italic 900 ${fontSize}px ${sysFont}`;

    // Width awareness to keep inside the seal core
    while (ctx.measureText(fullValText).width > 480 && fontSize > 60) {
        fontSize -= 5;
        ctx.font = `italic 900 ${fontSize}px ${sysFont}`;
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
            const mapBox = { x: 100, y: 150, w: 880, h: 1050 };

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
            drawSprayPath(ctx, coords, getXY, lineColor);
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
    ctx.shadowColor = isDarkAccent ? 'rgba(255, 255, 255, 0.45)' : 'rgba(0, 0, 0, 0.6)';
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 4;
    ctx.globalAlpha = 0.85;
    ctx.font = "900 140px 'BBH Bartle'";
    ctx.fillStyle = customColor;
    ctx.fillText(distNum, 540, 1460);
    ctx.restore();

    // Units (Solid - 100% Opacity)
    ctx.save();
    ctx.font = "800 32px 'Plus Jakarta Sans'";
    ctx.fillStyle = secondaryColor;
    ctx.globalAlpha = 1.0;
    ctx.shadowColor = isDarkSecondary ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.6)';
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 2;
    if (typeof (ctx as any).letterSpacing !== 'undefined') (ctx as any).letterSpacing = "15px";
    ctx.fillText("KILOMETERS", 540, 1515);
    if (typeof (ctx as any).letterSpacing !== 'undefined') (ctx as any).letterSpacing = "0px";
    ctx.restore();

    // Secondary Data (Pace & Time - 85% Opacity)
    ctx.save();
    ctx.shadowColor = isDarkAccent ? 'rgba(255, 255, 255, 0.45)' : 'rgba(0, 0, 0, 0.6)';
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 3;
    ctx.globalAlpha = 0.85;
    ctx.font = "900 55px 'BBH Bartle'";
    ctx.fillStyle = customColor;
    ctx.fillText(stats.subValue || '0:00 /km', 310, 1700);
    ctx.fillText(stats.timeStr || '0h 00m', 770, 1700);
    ctx.restore();

    // Labels (Solid - 100% Opacity)
    ctx.save();
    ctx.font = "800 24px 'Plus Jakarta Sans'";
    ctx.fillStyle = secondaryColor;
    ctx.globalAlpha = 1.0;
    ctx.shadowColor = isDarkSecondary ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.6)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 2;
    if (typeof (ctx as any).letterSpacing !== 'undefined') (ctx as any).letterSpacing = "10px";

    const paceLabel = sport === 'Ride' ? 'AVG. SPEED' : 'PACE';
    ctx.fillText(paceLabel, 310, 1740);
    ctx.fillText("TOTAL DURATION", 770, 1740);
    if (typeof (ctx as any).letterSpacing !== 'undefined') (ctx as any).letterSpacing = "0px";
    ctx.restore();
}

/**
 * GRAFFITI BRAND — Grid Centered Edition.
 * Surgical centering within an imagined 1x2 layout grid.
 */
export function drawGraffitiBrand(ctx: CanvasRenderingContext2D, stats: any, textColor: string) {
    const { accent: accentColor } = buildColors(textColor);
    const isDarkAccent = isColorDark(accentColor);

    // Canvas Constants
    const midX = 540; 
    const colX1 = 270; // Center of Left Box (540/2)
    const colX2 = 810; // Center of Right Box (540 + 270)
    
    // Vertical Box Targets
    let heroY = 280; 
    let row2Y = 580;

    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';

    const applyDeepShadow = (blur = 30) => {
        ctx.shadowColor = isDarkAccent ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.9)';
        ctx.shadowBlur = blur;
        ctx.shadowOffsetY = 6;
    };

    // 3. Logic: Check if Workout/Non-Distance
    const isWorkout = stats.type?.toLowerCase().includes('workout') || stats.type?.toLowerCase().includes('training') || !stats.hasDistance;

    // 1. Hero Metric (BOX 1 - Centered)
    const heroVal = (isWorkout ? (stats.timeStr || '0:00') : (stats.distanceVal || '0.00')).toUpperCase();
    ctx.save();
    applyDeepShadow(35);
    ctx.globalAlpha = 1.0; 
    ctx.font = "900 135px 'BBH Bartle'"; 
    ctx.fillStyle = accentColor; 
    ctx.fillText(heroVal, midX, heroY);
    ctx.restore();

    // 2. Main Unit (BOX 1 - Sub label)
    const heroLabel = isWorkout ? "DURATION" : "KILOMETERS";
    ctx.save();
    applyDeepShadow(15);
    ctx.font = "800 32px 'Michroma'"; 
    ctx.fillStyle = accentColor;
    ctx.globalAlpha = 1.0; 
    if (typeof (ctx as any).letterSpacing !== 'undefined') (ctx as any).letterSpacing = "15px";
    ctx.fillText(heroLabel, midX, heroY + 65);
    ctx.restore();

    // 3. Activity Statistics (Data Prep)
    const isRide = stats.type === 'Ride' || stats.type === 'EBikeRide';

    let m1Value = ''; let m1Label = '';
    let m2Value = ''; let m2Label = '';

    if (isWorkout) {
        m1Value = stats.avgHeartrate ? `${stats.avgHeartrate} BPM` : (stats.calories ? `${stats.calories} KCAL` : 'WORKOUT');
        m1Label = stats.avgHeartrate ? 'AVG HEART RATE' : (stats.calories ? 'CALORIES' : 'SESSION');
        m2Value = (stats.timeStr || '0M').toUpperCase();
        m2Label = 'TOTAL DURATION';
    } else {
        m1Value = (stats.subValue || '0:00 /KM').toUpperCase();
        m1Label = isRide ? 'AVG. SPEED' : 'PACE';
        m2Value = (stats.timeStr || '0M').toUpperCase();
        m2Label = 'TOTAL DURATION';
    }

    // 4. Sub-Metrics (BOX 2 & 3 - Column Centering)
    const maxSubW = 500; // Allow slightly more width since we are centered perfectly

    const drawGridMetric = (val: string, label: string, x: number, y: number) => {
        // Value
        ctx.save();
        applyDeepShadow();
        ctx.fillStyle = accentColor;
        ctx.globalAlpha = 1.0;
        
        let subFontSize = 85; 
        ctx.font = `900 ${subFontSize}px 'BBH Bartle'`;
        // Safety Auto-Scaling
        while (ctx.measureText(val).width > maxSubW && subFontSize > 40) {
            subFontSize -= 2;
            ctx.font = `900 ${subFontSize}px 'BBH Bartle'`;
        }
        ctx.fillText(val, x, y);
        ctx.restore();

        // Label
        ctx.save();
        applyDeepShadow(10);
        ctx.font = "800 24px 'Michroma'";
        ctx.fillStyle = accentColor;
        ctx.globalAlpha = 1.0;
        ctx.fillText(label, x, y + 55);
        ctx.restore();
    };

    drawGridMetric(m1Value, m1Label, colX1, row2Y);
    drawGridMetric(m2Value, m2Label, colX2, row2Y);
}

/**
 * Renders the "Journal Grid" sticker.
 * A high-fidelity, data-dense variant with top-aligned stats and a large Day indicator.
 */
export function drawJournalGrid(ctx: CanvasRenderingContext2D, stats: any, textColor: string) {
    const c = buildColors(textColor);
    const lineColor = textColor.startsWith('#') ? textColor : (textColor === 'black' ? '#000000' : '#ffffff');
    const isDark = isColorDark(lineColor);
    const sport = normalizeSport(stats.type);

    ctx.save();
    ctx.globalAlpha = 0.9;

    // Apply Bi-Directional Readability Shadow (Anti-Ghosting)
    ctx.save();
    ctx.shadowColor = isDark ? 'rgba(255, 255, 255, 0.45)' : 'rgba(0, 0, 0, 0.6)';
    ctx.shadowBlur = 20;
    ctx.shadowOffsetY = 4;

    // 1. DAY Indicator (Top Left) - Moved down to sit under default logo
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = lineColor;

    // Day Name (e.g., TUESDAY) under logo
    const dayLabel = (stats.dayName || "ACTIVITY").toUpperCase();
    ctx.font = "800 52px 'Merriweather'";
    ctx.fillText(dayLabel, 60, 190);

    // Month Day (e.g., 24) under Day Name
    const monthDay = stats.rawDate ? new Date(stats.rawDate).getDate() : "1";
    ctx.font = "900 170px 'Merriweather'";
    ctx.fillText(String(monthDay), 60, 240);

    // 2. Stats Grid (Top Right)
    const gridX = 540;
    const gridY = 80;
    const col2X = 810;
    const rowHeight = 90;

    ctx.textAlign = 'left';

    const drawGridItem = (x: number, y: number, label: string, value: string, unit: string) => {
        // Label
        ctx.font = "700 22px 'Plus Jakarta Sans'"; // Labels stay clean sans-serif for contrast
        ctx.globalAlpha = 0.6;
        ctx.fillText(label.toUpperCase(), x, y);

        // Value with Smart Scaling
        ctx.globalAlpha = 0.9;
        const baseSize = 42;
        ctx.font = `bold ${baseSize}px 'Merriweather'`;
        
        let fontSize = baseSize;
        const maxW = 250; // Grid column limit
        let valWidth = ctx.measureText(value).width;
        
        if (valWidth > maxW) {
            fontSize = Math.floor(baseSize * (maxW / valWidth));
            ctx.font = `bold ${fontSize}px 'Merriweather'`;
            valWidth = ctx.measureText(value).width;
        }

        ctx.fillText(value, x, y + 30);

        // Unit
        if (unit) {
            ctx.font = "700 20px 'Plus Jakarta Sans'";
            ctx.fillText(unit, x + valWidth + 8, y + 45);
        }
    };

    // Find Elevation in dataPoints
    const elevPoint = stats.dataPoints?.find(p => p.label.toLowerCase().includes('elevation')) || { value: '0', unit: 'm' };
    
    // HR Logic: Explicitly prioritize Avg over Max for the Journal entry
    const hrPoint = stats.dataPoints?.find(p => p.label.toLowerCase().includes('avg')) || 
                    { value: stats.avgHeartrate || (stats.dataPoints?.find(p => p.label.includes('HR'))?.value) || '-', unit: 'bpm' };
                    
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

    const lineColor = textColor === 'black' ? '#000000' : '#ffffff';
    const isDark = textColor === 'black';

    ctx.save();

    // 1. Clock Backplate (Industrial feel)
    const boxW = 920;
    const boxH = 420;
    const boxY = cy - 100;

    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 40;
    ctx.fillStyle = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.4)'; // More transparent (40% vs 70%)
    ctx.beginPath();
    ctx.roundRect(cx - boxW / 2, boxY - boxH / 2, boxW, boxH, 210); // Full pill shape (boxH / 2)
    ctx.fill();

    // Gloss/Bevel effect
    ctx.strokeStyle = isDark ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // 2. The Time (LED/Dot Matrix)
    const timeVal = stats.timeStr || "0:00:00";
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = lineColor;

    // Apply Neon Glow for 'Next Level' aesthetic
    ctx.shadowColor = lineColor;
    ctx.shadowBlur = isDark ? 0 : 25;

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
    ctx.globalAlpha = 0.85; // Brighter for impact
    ctx.letterSpacing = "15px"; // Wide cinematic tracking
    ctx.fillText("FINISH TIME", cx, boxY - (boxH / 2) + 55);
    ctx.restore();

    // 4. Secondary Metrics (Distance & Pace)
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
        ctx.font = "700 22px 'Plus Jakarta Sans'";
        ctx.textBaseline = 'top'; // Push label down from the number's baseline
        ctx.globalAlpha = 0.6;
        ctx.letterSpacing = "6px";
        ctx.fillText(label.toUpperCase(), 0, 20); // 20px buffer from the bottom of the number

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

    const secondaryColor = textColor === 'black' ? '#000000' : '#ffffff';
    const isDarkAccent = isColorDark(accentColor);
    const isDarkSecondary = isColorDark(secondaryColor);

    ctx.save();
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';

    const startX = 70; // Shifted left for more gutter
    let currentY = 320;

    const isWorkout = stats.type === 'Workout' || stats.type === 'WeightTraining';
    const isRide = stats.type === 'Ride' || stats.type === 'EBikeRide';

    // ── 1. Hero Block (Level 2) ──────────────────────────────────────────────
    let heroValue = stats.distanceVal || '0.00';
    let heroUnit = (stats.distanceUnit || 'kilometers').toUpperCase();

    if (isWorkout) {
        heroValue = stats.timeStr || '0m';
        heroUnit = 'DURATION';
    }

    // Hero Data (Distance/Duration - 85% Opacity)
    let heroFontSize = 210; // Reduced from 240
    if (heroValue.length > 4) heroFontSize = 170; // Earlier trigger for 99.99
    if (heroValue.length > 6) heroFontSize = 130;
    if (heroValue.length > 8) heroFontSize = 110;

    ctx.save();
    ctx.shadowColor = isDarkAccent ? 'rgba(255, 255, 255, 0.45)' : 'rgba(0, 0, 0, 0.6)';
    ctx.shadowBlur = 20;
    ctx.shadowOffsetY = 4;
    ctx.globalAlpha = 0.85;
    ctx.font = `800 ${heroFontSize}px 'Russo One'`;
    ctx.fillStyle = accentColor;
    ctx.fillText(heroValue, startX, currentY);
    ctx.restore();

    // Hero Unit (Medium, Ultra)
    currentY += 80;
    ctx.save();
    ctx.font = "800 65px 'Russo One'";
    ctx.fillStyle = secondaryColor;
    ctx.globalAlpha = 1.0;
    ctx.shadowColor = isDarkSecondary ? 'rgba(255, 255, 255, 0.45)' : 'rgba(0, 0, 0, 0.6)';
    ctx.shadowBlur = 15;
    ctx.shadowOffsetY = 3;
    if (typeof (ctx as any).letterSpacing !== 'undefined') {
        (ctx as any).letterSpacing = "4px";
    }
    ctx.fillText(heroUnit, startX, currentY);
    if (typeof (ctx as any).letterSpacing !== 'undefined') {
        (ctx as any).letterSpacing = "0px";
    }
    ctx.restore();

    // ── 2. Grid Row (Level 3) ────────────────────────────────────────────────
    // Side-by-side metrics row starting below the Hero block
    currentY += 180;

    // Metric 1: Pace/Speed or HR
    let m1Value = '';
    let m1Unit = '';
    let m1Label = '';

    if (isWorkout) {
        m1Value = stats.avgHeartrate ? String(stats.avgHeartrate) : (stats.calories || '0');
        m1Unit = stats.avgHeartrate ? 'BPM' : 'KCAL';
        m1Label = stats.avgHeartrate ? 'AVG HEART RATE' : 'CALORIES';
    } else {
        m1Value = (stats.subValue || '').split(' ')[0] || '0:00';
        m1Unit = isRide ? 'KM/H' : '/KM';
        m1Label = isRide ? 'AVG. SPEED' : 'PACE';
    }

    // Value 1 (Data - 85% Opacity)
    ctx.save();
    ctx.shadowColor = isDarkAccent ? 'rgba(255, 255, 255, 0.45)' : 'rgba(0, 0, 0, 0.6)';
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 4;
    ctx.globalAlpha = 0.85;
    ctx.font = "800 100px 'Russo One'";
    ctx.fillStyle = accentColor;
    ctx.fillText(m1Value.toUpperCase(), startX, currentY);
    const m1ValW = ctx.measureText(m1Value.toUpperCase()).width;
    ctx.restore();

    // Unit 1
    if (m1Unit) {
        ctx.save();
        ctx.font = "800 48px 'Russo One'";
        ctx.fillStyle = secondaryColor;
        ctx.globalAlpha = 1.0;
        ctx.shadowColor = isDarkSecondary ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.6)';
        ctx.shadowBlur = 15;
        ctx.shadowOffsetY = 3;
        ctx.fillText(m1Unit.toUpperCase(), startX + m1ValW + 15, currentY);
        ctx.restore();
    }

    // Label 1
    ctx.save();
    ctx.font = "800 26px 'Russo One'";
    ctx.fillStyle = secondaryColor;
    ctx.globalAlpha = 1.0;
    ctx.shadowColor = isDarkSecondary ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.6)';
    ctx.shadowBlur = 15;
    ctx.shadowOffsetY = 3;
    if (typeof (ctx as any).letterSpacing !== 'undefined') {
        (ctx as any).letterSpacing = "2px";
    }
    ctx.fillText(m1Label, startX, currentY + 45);
    if (typeof (ctx as any).letterSpacing !== 'undefined') {
        (ctx as any).letterSpacing = "0px";
    }
    ctx.restore();

    // Metric 2: Duration or meta (Shift horizontally)
    const midX = 570; // Shifted right for more gutter

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
            // Complex duration like "1h 30m" -> Keep as one string in Value
            m2Value = fullTime.toUpperCase();
            m2Unit = '';
        } else {
            // Simple duration like "42m" -> "42" and "M"
            m2Value = fullTime.replace(/[a-zA-Z]+$/, '').trim();
            m2Unit = (fullTime.match(/[a-zA-Z]+$/)?.[0] || 'm').toUpperCase();
        }
        m2Label = 'TOTAL DURATION';
    }

    // Value 2 (Data - 85% Opacity)
    ctx.save();
    ctx.shadowColor = isDarkAccent ? 'rgba(255, 255, 255, 0.45)' : 'rgba(0, 0, 0, 0.6)';
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 4;
    ctx.globalAlpha = 0.85;
    ctx.font = "800 100px 'Russo One'";
    ctx.fillStyle = accentColor;
    ctx.fillText(m2Value.toUpperCase(), midX, currentY);
    const m2ValW = ctx.measureText(m2Value.toUpperCase()).width;
    ctx.restore();

    // Unit 2
    if (m2Unit) {
        ctx.save();
        ctx.font = "800 48px 'Russo One'";
        ctx.fillStyle = secondaryColor;
        ctx.globalAlpha = 1.0;
        ctx.shadowColor = isDarkSecondary ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.6)';
        ctx.shadowBlur = 15;
        ctx.shadowOffsetY = 3;
        ctx.fillText(m2Unit.toUpperCase(), midX + m2ValW + 15, currentY);
        ctx.restore();
    }

    // Label 2
    ctx.save();
    ctx.font = "800 26px 'Russo One'";
    ctx.fillStyle = secondaryColor;
    ctx.globalAlpha = 1.0;
    ctx.shadowColor = isDarkSecondary ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.6)';
    ctx.shadowBlur = 15;
    ctx.shadowOffsetY = 3;
    if (typeof (ctx as any).letterSpacing !== 'undefined') {
        (ctx as any).letterSpacing = "2px";
    }
    ctx.fillText(m2Label, midX, currentY + 45);
    if (typeof (ctx as any).letterSpacing !== 'undefined') {
        (ctx as any).letterSpacing = "0px";
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
    const paddingY = 30;
    
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
