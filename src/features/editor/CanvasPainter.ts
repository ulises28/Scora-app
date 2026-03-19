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

// Strava polyline decoder → [lat, lng] coordinate array
export function decodePolyline(str) {
    if (!str) return [];
    let index = 0, lat = 0, lng = 0, coordinates = [], shift = 0, result = 0, byte = null, latitude_change, longitude_change, factor = 1e5;
    while (index < str.length) { byte = null; shift = 0; result = 0; do { byte = str.charCodeAt(index++) - 63; result |= (byte & 0x1f) << shift; shift += 5; } while (byte >= 0x20); latitude_change = ((result & 1) ? ~(result >> 1) : (result >> 1)); shift = result = 0; do { byte = str.charCodeAt(index++) - 63; result |= (byte & 0x1f) << shift; shift += 5; } while (byte >= 0x20); longitude_change = ((result & 1) ? ~(result >> 1) : (result >> 1)); lat += latitude_change; lng += longitude_change; coordinates.push([lat / factor, lng / factor]); }
    return coordinates;
}

// ─── Shared colour helpers ───────────────────────────────────────────────────

function buildColors(textColor: string) {
    const alphaValue = 0.45;
    const base = textColor === 'black' ? '0, 0, 0' : '255, 255, 255';
    return {
        solid: `rgb(${base})`,
        trans: `rgba(${base}, ${alphaValue})`,
        label: textColor === 'black' ? 'rgba(0,0,0,0.75)' : 'rgba(255,255,255,0.75)',
        accent: '#80cbc4',
    };
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function drawTemplate(
    canvasId: string,
    stats: any,
    templateType = 'minimal',
    textColor = 'white',
    showLogo = true
) {
    const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    // Standard Story resolution (1080 × 1920)
    canvas.width = 1080;
    canvas.height = 1920;

    // Transparent canvas (stickers have no background)
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // ── Optional SCORA branding ──────────────────────────────────────────────
    if (showLogo) {
        ctx.textAlign = 'left';
        ctx.fillStyle = '#80cbc4';
        ctx.beginPath();
        ctx.arc(80, 100, 10, 0, Math.PI * 2);
        ctx.fill();

        ctx.font = "700 42px 'Plus Jakarta Sans'";
        ctx.fillStyle = 'white';
        ctx.fillText('SCORA.', 110, 115);
    }

    // ── 8M special templates (override for any activity type) ────────────────
    if (templateType === '8m' || templateType === '8m2') {
        draw8MTemplate(ctx, stats, templateType, showLogo);
        return;
    }

    // ── Route to correct template renderer ──────────────────────────────────
    if (stats.hasDistance) {
        drawRunningTemplate(ctx, stats, templateType, textColor);
    } else {
        drawGymTemplate(ctx, stats, templateType, textColor);
    }
}


// ─── Template routers ─────────────────────────────────────────────────────────

function drawRunningTemplate(ctx, stats, templateType, textColor) {
    if (templateType === 'minimal') drawRunningMinimal(ctx, stats, textColor);
    else if (templateType === 'route') drawRunningRoute(ctx, stats, textColor);
    else if (templateType === 'dm') drawDMBubble(ctx, stats);
    else if (templateType === 'stats') drawStatsTemplate(ctx, stats, textColor);
    else if (templateType === 'modern-pill') drawModernPill(ctx, stats, textColor);
    else if (templateType === 'scora-stealth') drawScoraStealth(ctx, stats, textColor);
    else if (templateType === 'info-glass') drawInfoGlass(ctx, stats, textColor);
    else if (templateType === 'split-badge') drawSplitBadge(ctx, stats, textColor);
    else if (templateType === 'minimal-vertical') drawMinimalVertical(ctx, stats, textColor);
    else if (templateType === 'workout-receipt') drawWorkoutReceipt(ctx, stats, textColor);
    else if (templateType === 'neon-capsule') drawNeonCapsule(ctx, stats, textColor);
    else if (templateType === 'brutalist-bold') drawBrutalistBold(ctx, stats, textColor);
    else if (templateType === 'tech-hud') drawTechHUD(ctx, stats, textColor);
    else if (templateType === 'data-modular') drawDataModular(ctx, stats, textColor);
    else if (templateType === 'glass-slice') drawGlassSlice(ctx, stats, textColor);
    else if (templateType === 'vhs-retro') drawVHSRetro(ctx, stats, textColor);
    else if (templateType === 'award-badge') drawAwardBadge(ctx, stats, textColor);
    else if (templateType === 'stealth-bar') drawStealthBar(ctx, stats, textColor);
    else if (templateType === 'essential-italic') drawEssentialItalic(ctx, stats, textColor);
    else if (templateType === 'obsidian-bar') drawObsidianBar(ctx, stats, textColor);
    else if (templateType === 'track-record') drawTrackRecord(ctx, stats, textColor);
    else if (templateType === 'mono-split') drawMonoSplit(ctx, stats, textColor);
    else if (templateType === 'editorial-archive') drawEditorialArchive(ctx, stats, textColor);
    else if (templateType === 'social-float') drawSocialFloat(ctx, stats, textColor);
    else if (templateType === 'metric-thin') drawMetricThin(ctx, stats, textColor);
    else if (templateType === 'data-matrix') drawDataMatrix(ctx, stats, textColor);
    else if (templateType === 'vertical-label') drawVerticalLabel(ctx, stats, textColor);
    else if (templateType === 'frosted-minimal') drawFrostedMinimal(ctx, stats, textColor);
    else drawRunningData(ctx, stats, textColor);
}

// ─── 8M Special Templates ─────────────────────────────────────────────────────
// Feminist running stickers for International Women's Day (8M)

function draw8MTemplate(ctx, stats, templateType, showLogo) {
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
        const timeNum = timeStr.replace(/[a-zA-Z]+$/, '');
        const timeU = timeStr.replace(/^[0-9:]+/, '');

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

        // Draw Time (Right)
        ctx.font = "800 95px 'Plus Jakarta Sans'";
        const tNumW = ctx.measureText(timeNum).width;
        ctx.font = "700 65px 'Plus Jakarta Sans'";
        const tUW = ctx.measureText(timeU).width;

        let tSetStart = 780 - ((tNumW + gap + tUW) / 2);

        ctx.textAlign = 'left';
        ctx.font = "800 95px 'Plus Jakarta Sans'";
        ctx.fillStyle = c.trans;
        ctx.fillText(timeNum, tSetStart, 1680);
        ctx.font = "700 65px 'Plus Jakarta Sans'";
        ctx.fillStyle = c.solid;
        ctx.fillText(timeU, tSetStart + tNumW + gap, 1680);

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
function draw8MRoute(ctx, coords, mapBox, color) {
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


function drawRunningMinimal(ctx, stats, textColor = 'white') {
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

function drawRunningRoute(ctx, stats, textColor = 'white') {
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

function drawRunningData(ctx, stats, textColor = 'white') {
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

function drawMap(ctx, coords, mapBox) {
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

function drawGymTemplate(ctx, stats, templateType, textColor) {
    if (templateType === 'minimal') drawGymMinimal(ctx, stats, textColor);
    else if (templateType === 'route') drawGymEffort(ctx, stats, textColor);   // Max HR focus
    else if (templateType === 'dm') drawDMBubble(ctx, stats);
    else if (templateType === 'stats') drawGymStats(ctx, stats, textColor);    // Avg + Max HR
    else if (templateType === 'modern-pill') drawModernPill(ctx, stats, textColor);
    else if (templateType === 'scora-stealth') drawScoraStealth(ctx, stats, textColor);
    else if (templateType === 'info-glass') drawInfoGlass(ctx, stats, textColor);
    else if (templateType === 'split-badge') drawSplitBadge(ctx, stats, textColor);
    else if (templateType === 'minimal-vertical') drawMinimalVertical(ctx, stats, textColor);
    else if (templateType === 'workout-receipt') drawWorkoutReceipt(ctx, stats, textColor);
    else if (templateType === 'neon-capsule') drawNeonCapsule(ctx, stats, textColor);
    else if (templateType === 'brutalist-bold') drawBrutalistBold(ctx, stats, textColor);
    else if (templateType === 'tech-hud') drawTechHUD(ctx, stats, textColor);
    else if (templateType === 'data-modular') drawDataModular(ctx, stats, textColor);
    else if (templateType === 'glass-slice') drawGlassSlice(ctx, stats, textColor);
    else if (templateType === 'vhs-retro') drawVHSRetro(ctx, stats, textColor);
    else if (templateType === 'award-badge') drawAwardBadge(ctx, stats, textColor);
    else if (templateType === 'stealth-bar') drawStealthBar(ctx, stats, textColor);
    else if (templateType === 'essential-italic') drawEssentialItalic(ctx, stats, textColor);
    else if (templateType === 'obsidian-bar') drawObsidianBar(ctx, stats, textColor);
    else if (templateType === 'track-record') drawTrackRecord(ctx, stats, textColor);
    else if (templateType === 'mono-split') drawMonoSplit(ctx, stats, textColor);
    else if (templateType === 'editorial-archive') drawEditorialArchive(ctx, stats, textColor);
    else if (templateType === 'social-float') drawSocialFloat(ctx, stats, textColor);
    else if (templateType === 'metric-thin') drawMetricThin(ctx, stats, textColor);
    else if (templateType === 'data-matrix') drawDataMatrix(ctx, stats, textColor);
    else if (templateType === 'vertical-label') drawVerticalLabel(ctx, stats, textColor);
    else if (templateType === 'frosted-minimal') drawFrostedMinimal(ctx, stats, textColor);
    else drawGymData(ctx, stats, textColor);     // Duration + Heartrate
}

// ── Template 1: Minimal — Duration as hero ────────────────────────────────────
function drawGymMinimal(ctx, stats, textColor = 'white') {
    const c = buildColors(textColor);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';

    ctx.font = "600 50px 'Plus Jakarta Sans'";
    ctx.fillStyle = c.accent;
    ctx.fillText(stats.title || 'Workout', 540, 750);

    // Duration value split: "1h 11m" -> "1" (trans), "h " (solid), "11" (trans), "m" (solid)
    const rawDur = stats.mainValue || '0m';
    
    // We'll draw it as a single centered group
    ctx.font = "800 200px 'Plus Jakarta Sans'";
    const parts = [];
    // This regex catches numbers and units like "1h 11m" -> ["1", "h ", "11", "m"]
    const regex = /(\d+|[hm] ?)/g;
    let m;
    while ((m = regex.exec(rawDur)) !== null) {
        parts.push(m[0]);
    }

    // Measure total width
    let totalW = 0;
    const gap = 4;
    parts.forEach((p, i) => {
        const isNum = /^\d+$/.test(p.trim());
        ctx.font = isNum ? "800 200px 'Plus Jakarta Sans'" : "700 100px 'Plus Jakarta Sans'";
        totalW += ctx.measureText(p).width + (i < parts.length - 1 ? gap : 0);
    });

    let currentX = 540 - totalW / 2;

    parts.forEach((p, i) => {
        const isNum = /^\d+$/.test(p.trim());
        ctx.textAlign = 'left';
        ctx.font = isNum ? "800 200px 'Plus Jakarta Sans'" : "700 100px 'Plus Jakarta Sans'";
        ctx.fillStyle = isNum ? c.trans : c.solid;
        ctx.fillText(p, currentX, 1020);
        totalW += ctx.measureText(p).width + (i < parts.length - 1 ? gap : 0);
        currentX += ctx.measureText(p).width + gap;
    });

    ctx.textAlign = 'center';
    ctx.font = "500 40px 'Plus Jakarta Sans'";
    ctx.fillStyle = c.label;
    ctx.fillText(stats.mainLabel || 'Duration', 540, 1100);
}

// ── Template 2: Effort — Max Heartrate as hero ────────────────────────────────
function drawGymEffort(ctx, stats, textColor = 'white') {
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

    // Sub: duration as context
    ctx.font = "500 55px 'Plus Jakarta Sans'";
    ctx.fillStyle = c.trans;
    ctx.fillText(stats.timeStr, 540, 1250);

    ctx.font = "400 32px 'Plus Jakarta Sans'";
    ctx.fillStyle = c.label;
    ctx.fillText('Duration', 540, 1300);
}

// ── Template 3: Data — Duration + side-by-side HR ────────────────────────────
function drawGymData(ctx, stats, textColor = 'white') {
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
function drawGymStats(ctx, stats, textColor = 'white') {
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

function drawStatsTemplate(ctx, stats, textColor = 'white') {
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
    const paceLabel = stats.subLabel || stats.maxPaceLabel || 'Pace';

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
function drawIOSBubble(ctx, x: number, y: number, width: number, height: number) {
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

function drawDMBubble(ctx, stats) {
    let subStr = stats.subValue ? stats.subValue.replace(' /', '/') : '';
    const msgText = `${stats.mainValue}, ${subStr}`;
    const captionText = `Started ${stats.startTime || '7:08 AM'}`;

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

function drawModernPill(ctx, stats, textColor) {
    const c = buildColors(textColor);
    ctx.textBaseline = 'alphabetic';

    // Dist/Calorie Fallback -> Dist/Time Fallback
    const leftLabel = stats.hasDistance ? "DISTANCE" : "DURATION";
    const distText = stats.hasDistance ? (stats.distanceVal || '0.00') : (stats.timeStr || '0:00');
    const distUnit = stats.hasDistance ? 'km' : '';

    // Pace/HR Fallback
    const rightLabel = stats.subLabel || (stats.hasDistance ? "PACE" : "AVG HR");
    const paceParts = (stats.subValue || '').trim().split(' ');
    const paceText = paceParts[0] || (stats.avgHeartrate ? String(stats.avgHeartrate) : '0');
    let paceUnit = paceParts[1] || (stats.hasDistance ? (stats.type === 'Ride' ? 'km/h' : '/km') : 'bpm');
    if (paceUnit === 'min/km') paceUnit = '/km';

    const sysFont = "'Plus Jakarta Sans', sans-serif";
    const h = 130;
    const centerY = 1300;

    // Measure right side (Label)
    ctx.font = `800 24px ${sysFont}`;
    const head2W = ctx.measureText(rightLabel).width;
    ctx.font = `900 65px ${sysFont}`;
    const paceNumW = ctx.measureText(paceText).width;
    ctx.font = `600 65px ${sysFont}`;
    const paceUnitW = ctx.measureText(paceUnit).width;
    const rightSideW = Math.max(head2W, paceNumW + paceUnitW);

    // Measure left side (Distance/Calories)
    ctx.font = `800 24px ${sysFont}`;
    const head1W = ctx.measureText(leftLabel).width;
    ctx.font = `900 65px ${sysFont}`;
    const distNumW = ctx.measureText(distText).width;
    ctx.font = `600 65px ${sysFont}`;
    const distUnitW = ctx.measureText(` ${distUnit}`).width;
    const leftSideW = Math.max(head1W, distNumW + distUnitW);

    const gap = 60;
    const w = leftSideW + gap + rightSideW + 100;
    const startX = 540 - w / 2;

    // Draw Pill Background
    ctx.beginPath();
    ctx.roundRect(startX, centerY - h / 2, w, h, h / 2);
    ctx.fillStyle = textColor === 'black' ? 'rgba(255, 255, 255, 0.85)' : '#0ea5e9'; // standard cyan-ish blue from prototype

    ctx.shadowColor = 'rgba(0,0,0,0.3)';
    ctx.shadowBlur = 40;
    ctx.shadowOffsetY = 20;
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    ctx.strokeStyle = textColor === 'black' ? 'rgba(0,0,0,0.1)' : 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = textColor === 'black' ? 'black' : 'white';
    let currentX = startX + 50;

    // LEFT BLOCK (Distance/Calories)
    ctx.textAlign = 'left';
    ctx.font = `800 22px ${sysFont}`;
    ctx.globalAlpha = 0.7;
    ctx.fillText(leftLabel, currentX, centerY - 15);
    ctx.globalAlpha = 1.0;

    ctx.font = `900 60px ${sysFont}`;
    ctx.fillText(distText, currentX, centerY + 35);
    ctx.font = `600 60px ${sysFont}`;
    ctx.fillText(` ${distUnit}`, currentX + distNumW, centerY + 35);

    currentX += leftSideW + gap / 2;

    // SEPARATOR
    ctx.beginPath();
    ctx.moveTo(currentX, centerY - 25);
    ctx.lineTo(currentX, centerY + 25);
    ctx.strokeStyle = textColor === 'black' ? 'rgba(0,0,0,0.2)' : 'rgba(255, 255, 255, 0.2)';
    ctx.stroke();

    currentX += gap / 2;

    // RIGHT BLOCK (Pace/HR)
    ctx.font = `800 22px ${sysFont}`;
    ctx.globalAlpha = 0.7;
    ctx.fillText(rightLabel.toUpperCase(), currentX, centerY - 15);
    ctx.globalAlpha = 1.0;

    ctx.font = `900 60px ${sysFont}`;
    ctx.fillText(paceText, currentX, centerY + 35);
    ctx.font = `600 60px ${sysFont}`;
    ctx.fillText(paceUnit, currentX + paceNumW, centerY + 35);

    // BOTTOM CAPTION (Started at)
    ctx.textAlign = 'center';
    ctx.font = `700 30px ${sysFont}`;
    ctx.fillStyle = textColor === 'black' ? 'rgba(0, 0, 0, 0.9)' : 'rgba(255, 255, 255, 0.9)';
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 10;
    ctx.fillText(`STARTED ${stats.startTime || 'TODAY'}`, 540, centerY + h / 2 + 50);
    ctx.shadowBlur = 0;
}

function drawScoraStealth(ctx, stats, textColor) {
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

    const rightLabel = stats.subLabel || (stats.hasDistance ? "PACE" : "AVG HR");

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

function drawInfoGlass(ctx, stats, textColor) {
    const c = buildColors(textColor);
    ctx.textBaseline = 'middle';
    const sysFont = "'Plus Jakarta Sans', sans-serif";

    // Fallbacks
    const distLabel = stats.hasDistance ? "DISTANCE" : "DURATION";
    const distText = stats.hasDistance ? (stats.distanceVal || '0.00') : (stats.timeStr || '0:00');

    const paceLabel = stats.subLabel || (stats.hasDistance ? "PACE" : "AVG HR");
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
    ctx.fillText(distText, col1, centerY + 30);

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
    ctx.fillText(paceText, col2, centerY + 30);

    ctx.font = `800 22px ${sysFont}`;
    ctx.fillStyle = textColor === 'black' ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.6)';
    ctx.fillText(timeLabel, col3, centerY - 25);
    ctx.font = `900 60px ${sysFont}`;
    ctx.fillStyle = textColor === 'black' ? 'black' : 'white';
    ctx.fillText(timeText, col3, centerY + 30);
}

function drawSplitBadge(ctx, stats, textColor) {
    const sysFont = "'Plus Jakarta Sans', sans-serif";
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';

    const distLabel = stats.mainLabel || (stats.hasDistance ? "DISTANCE" : "DURATION");
    const distText = stats.hasDistance ? (stats.distanceVal || '0.00') : (stats.timeStr || '0:00');
    const distUnit = stats.hasDistance ? "KILOMETERS" : "";

    const paceLabel = stats.subLabel || (stats.hasDistance ? "PACE" : "AVG HR");
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

function drawMinimalVertical(ctx, stats, textColor) {
    const c = buildColors(textColor);
    ctx.textBaseline = 'alphabetic';
    const sysFont = "'Plus Jakarta Sans', sans-serif";
    const distText = stats.hasDistance ? (stats.distanceVal || '0.00') : (stats.timeStr || '0:00');
    const distUnit = stats.hasDistance ? 'km' : '';
    const paceParts = (stats.subValue || '').trim().split(' ');
    const paceText = paceParts[0] || (stats.avgHeartrate ? String(stats.avgHeartrate) : '0');
    let paceUnit = paceParts[1] || (stats.hasDistance ? '/km' : 'bpm');
    if (paceUnit === 'min/km') paceUnit = '/km';

    // Set origin
    const startX = 100;
    const startY = 1750;

    // Cyan left border
    ctx.fillStyle = '#22d3ee';
    ctx.beginPath();
    ctx.roundRect(startX, startY - 140, 10, 160, 5);
    ctx.fill();

    ctx.textAlign = 'left';
    ctx.fillStyle = textColor === 'black' ? 'black' : 'white';
    ctx.font = `italic 900 120px ${sysFont}`;
    ctx.fillText(distText, startX + 40, startY - 30);
    const wD = ctx.measureText(distText).width;

    if (distUnit) {
        ctx.font = `600 40px ${sysFont}`;
        ctx.fillStyle = textColor === 'black' ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.4)';
        ctx.fillText(distUnit.toUpperCase(), startX + 50 + wD, startY - 30);
    }

    ctx.font = `800 24px ${sysFont}`;
    ctx.letterSpacing = "4px";
    ctx.fillStyle = '#22d3ee'; // cyan-400
    const botText = `${paceText} ${paceUnit}`.toUpperCase();
    ctx.fillText(`${botText}   •   ${stats.timeStr}`, startX + 40, startY + 10);
    ctx.letterSpacing = "0px";
}

function drawWorkoutReceipt(ctx, stats, textColor) {
    ctx.textBaseline = 'alphabetic';
    const sysFont = "'Space Mono', monospace";

    const distLabel = stats.hasDistance ? "DISTANCE" : "DURATION";
    const distText = stats.hasDistance ? (stats.distanceVal || '0') + ' KM' : (stats.timeStr || '0:00');

    const paceLabel = stats.subLabel || (stats.hasDistance ? "PACE" : "AVG HR");
    const paceParts = (stats.subValue || '').trim().split(' ');
    const paceText = paceParts[0] || (stats.avgHeartrate ? String(stats.avgHeartrate) : '0');
    let paceUnit = paceParts[1] || (stats.hasDistance ? '/KM' : 'BPM');
    if (paceUnit.toLowerCase() === 'min/km') paceUnit = '/KM';

    const w = 600;
    const h = 400;
    const cx = 540;
    const cy = 1650;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-2 * Math.PI / 180);

    ctx.fillStyle = '#facc15'; // yellow-400
    ctx.shadowColor = 'rgba(0,0,0,0.3)';
    ctx.shadowBlur = 30;
    ctx.shadowOffsetY = 15;
    ctx.fillRect(-w / 2, -h / 2, w, h);
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    ctx.fillStyle = 'rgba(0,0,0,0.1)';
    ctx.font = `900 80px ${sysFont}`;
    ctx.textAlign = 'right';
    ctx.fillText("#", w / 2 - 20, -h / 2 + 80);

    ctx.fillStyle = 'black';
    ctx.textAlign = 'left';
    ctx.font = `900 22px ${sysFont}`;
    ctx.letterSpacing = "2px";
    ctx.fillText("SCORA VERIFIED RUN", -w / 2 + 40, -h / 2 + 60);
    ctx.letterSpacing = "0px";

    ctx.beginPath();
    ctx.moveTo(-w / 2 + 40, -h / 2 + 80);
    ctx.lineTo(w / 2 - 40, -h / 2 + 80);
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(0,0,0,0.1)';
    ctx.stroke();

    ctx.font = `700 32px ${sysFont}`;
    ctx.fillText(distLabel, -w / 2 + 40, 0);
    ctx.textAlign = 'right';
    ctx.fillText(distText, w / 2 - 40, 0);

    ctx.textAlign = 'left';
    ctx.fillText(paceLabel, -w / 2 + 40, 80);
    ctx.textAlign = 'right';
    ctx.fillText(`${paceText} ${paceUnit}`.trim(), w / 2 - 40, 80);

    ctx.textAlign = 'left';
    ctx.fillText("DURATION", -w / 2 + 40, 160);
    ctx.textAlign = 'right';
    ctx.fillText(stats.timeStr || '0:00', w / 2 - 40, 160);

    ctx.restore();
}

function drawNeonCapsule(ctx, stats, textColor) {
    const sysFont = "'Plus Jakarta Sans', sans-serif";
    ctx.textBaseline = 'middle';

    const distText = stats.hasDistance ? (stats.distanceVal || '0.00') : (stats.timeStr || '0:00');
    const distUnit = stats.hasDistance ? 'KM' : '';

    const paceParts = (stats.subValue || '').trim().split(' ');
    const paceText = paceParts[0] || (stats.avgHeartrate ? String(stats.avgHeartrate) : '0');
    let paceUnit = paceParts[1] || (stats.hasDistance ? '/KM' : 'BPM');
    if (paceUnit.toLowerCase() === 'min/km') paceUnit = '/KM';

    const cx = 540;
    const cy = 1750;
    const w = 600;
    const h = 140;

    // Glass Pill
    ctx.beginPath();
    ctx.roundRect(cx - w / 2, cy - h / 2, w, h, h / 2);
    ctx.fillStyle = textColor === 'black' ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)';
    ctx.shadowColor = 'rgba(0,0,0,0.2)';
    ctx.shadowBlur = 40;
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.lineWidth = 2;
    ctx.strokeStyle = textColor === 'black' ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)';
    ctx.stroke();

    // Cyan dot
    ctx.beginPath();
    ctx.arc(cx - w / 2 + 70, cy, 40, 0, Math.PI * 2);
    ctx.fillStyle = '#22d3ee';
    ctx.shadowColor = 'rgba(34,211,238,0.5)';
    ctx.shadowBlur = 20;
    ctx.fill();
    ctx.shadowBlur = 0;

    // Zap inside dot (simple triangle path to fake it)
    ctx.fillStyle = 'black';
    ctx.beginPath();
    ctx.moveTo(cx - w / 2 + 75, cy - 15);
    ctx.lineTo(cx - w / 2 + 60, cy + 5);
    ctx.lineTo(cx - w / 2 + 75, cy + 5);
    ctx.lineTo(cx - w / 2 + 65, cy + 18);
    ctx.lineTo(cx - w / 2 + 82, cy - 2);
    ctx.lineTo(cx - w / 2 + 67, cy - 2);
    ctx.fill();

    ctx.textAlign = 'left';
    ctx.fillStyle = textColor === 'black' ? 'black' : 'white';
    ctx.font = `italic 900 50px ${sysFont}`;
    ctx.fillText(`${distText} ${distUnit}`.trim(), cx - w / 2 + 150, cy - 15);

    ctx.font = `700 22px ${sysFont}`;
    ctx.letterSpacing = "2px";
    ctx.fillStyle = textColor === 'black' ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.5)';
    const botLabel = (stats.subLabel || (stats.hasDistance ? "PACE" : "AVG HR")).toUpperCase();
    ctx.fillText(`${paceText} ${paceUnit} ${botLabel}`.toUpperCase(), cx - w / 2 + 150, cy + 30);
    ctx.letterSpacing = "0px";
}

function drawBrutalistBold(ctx, stats, textColor) {
    const sysFont = "'Plus Jakarta Sans', sans-serif";
    ctx.textBaseline = 'alphabetic';

    const distText = stats.hasDistance ? (stats.distanceVal || '0.00') : (stats.timeStr || '0:00');

    const paceParts = (stats.subValue || '').trim().split(' ');
    const paceText = paceParts[0] || (stats.avgHeartrate ? String(stats.avgHeartrate) : '0');
    let paceUnit = paceParts[1] || (stats.hasDistance ? '/KM' : 'BPM');
    if (paceUnit.toLowerCase() === 'min/km') paceUnit = '/KM';

    const startX = 100;
    const startY = 1600;
    const w = 880;
    const h = 260;

    // White box shadow offset
    ctx.fillStyle = '#22d3ee';
    ctx.fillRect(startX + 15, startY + 15, w, h);

    ctx.fillStyle = 'white';
    ctx.fillRect(startX, startY, w, h);

    ctx.fillStyle = 'black';
    ctx.textAlign = 'left';
    ctx.font = `900 20px ${sysFont}`;
    ctx.letterSpacing = "1px";
    ctx.fillText("SESSION SUMMARY", startX + 50, startY + 50);
    ctx.letterSpacing = "0px";

    ctx.font = `italic 900 130px ${sysFont}`;
    ctx.fillText(distText, startX + 45, startY + 170);

    ctx.font = `900 24px ${sysFont}`;
    ctx.letterSpacing = "[-1px]";
    ctx.fillText(`${paceText} ${paceUnit}`.toUpperCase(), startX + 50, startY + 220);

    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillText(" / ", startX + 50 + ctx.measureText(`${paceText} ${paceUnit}`.toUpperCase()).width, startY + 220);

    ctx.fillStyle = 'black';
    const offset = startX + 50 + ctx.measureText(`${paceText} ${paceUnit} / `.toUpperCase()).width;
    ctx.fillText(stats.timeStr || '0:00', offset, startY + 220);
}

function drawTechHUD(ctx, stats, textColor) {
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

function drawDataModular(ctx, stats, textColor) {
    const sysFont = "'Plus Jakarta Sans', sans-serif";
    ctx.textBaseline = 'alphabetic';

    const distLabel = (stats.mainLabel || (stats.hasDistance ? "DISTANCE" : "DURATION")).toUpperCase();
    const distText = stats.hasDistance ? (stats.distanceVal || '0.00') : (stats.timeStr || '0:00');

    const paceLabel = (stats.subLabel || (stats.hasDistance ? "PACE" : "AVG HR")).toUpperCase();
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
    const panelBg = textColor === 'black' ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.5)';
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
    ctx.fillStyle = textColor === 'black' ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.5)';
    ctx.font = `900 14px ${sysFont}`;
    ctx.letterSpacing = "6px";
    ctx.fillText("SCORA PERFORMANCE LOG", cx + 3, startY + topH + 1 + botH / 2);

    ctx.restore();

    // Draw the outer border over everything
    ctx.beginPath();
    ctx.roundRect(cx - w / 2, cy - h / 2, w, h, r);
    ctx.lineWidth = 1;
    ctx.strokeStyle = textColor === 'black' ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)';
    ctx.stroke();
}

function drawGlassSlice(ctx, stats, textColor) {
    const sysFont = "'Plus Jakarta Sans', sans-serif";
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';

    const distText = stats.hasDistance ? (stats.distanceVal || '0.00') : (stats.timeStr || '0:00');
    const distUnit = (stats.mainLabel || (stats.hasDistance ? 'KM' : 'DURATION')).toUpperCase();

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

    // Left Unit
    ctx.fillStyle = textColor === 'black' ? 'black' : 'white';
    ctx.font = `italic 900 70px ${sysFont}`;
    ctx.fillText(distText, -w / 4, -10);
    ctx.fillStyle = textColor === 'black' ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.5)';
    ctx.font = `900 16px ${sysFont}`;
    ctx.fillText(distUnit, -w / 4, 40);

    // Divider
    ctx.fillStyle = textColor === 'black' ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.2)';
    ctx.fillRect(0, -40, 2, 80);

    // Right Unit
    ctx.fillStyle = textColor === 'black' ? 'black' : 'white';
    ctx.font = `italic 900 40px ${sysFont}`;
    ctx.fillText(paceText, w / 4, -10);
    ctx.fillStyle = textColor === 'black' ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.5)';
    ctx.font = `900 16px ${sysFont}`;
    ctx.fillText((stats.subLabel || (stats.hasDistance ? "PACE" : "HEART RATE")).toUpperCase(), w / 4, 40);

    ctx.restore();
}

function drawVHSRetro(ctx, stats, textColor) {
    const sysFont = "'Space Mono', monospace";
    ctx.textBaseline = 'alphabetic';

    const distLabel = (stats.mainLabel || (stats.hasDistance ? "DISTANCE" : "DURATION")).toUpperCase();
    const distText = stats.hasDistance ? `${stats.distanceVal || '0.00'}KM` : (stats.timeStr || '0:00');

    const paceLabel = (stats.subLabel || (stats.hasDistance ? "PACE" : "AVG HR")).toUpperCase();
    const paceParts = (stats.subValue || '').trim().split(' ');
    const paceText = paceParts[0] || (stats.avgHeartrate ? String(stats.avgHeartrate) : '0');

    const startX = 80;
    const startY = 1600;
    const w = 480;
    const h = 220;

    // Dark backdrop with red border
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(startX, startY, w, h);
    ctx.fillStyle = '#ef4444'; // red-500
    ctx.fillRect(startX, startY, 10, h);

    // REC dot
    ctx.fillStyle = '#dc2626'; // red-600
    ctx.beginPath();
    ctx.arc(startX + 40, startY + 50, 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.textAlign = 'left';
    ctx.fillStyle = 'white'; // Always white for VHS
    ctx.globalAlpha = 0.6;
    ctx.font = `700 20px ${sysFont}`;
    ctx.fillText("REC LIVE", startX + 60, startY + 56);
    ctx.globalAlpha = 1.0;

    ctx.font = `700 80px ${sysFont}`;
    ctx.letterSpacing = "-2px";
    ctx.fillText(stats.timeStr || '0:00', startX + 40, startY + 140);
    ctx.letterSpacing = "0px";

    ctx.globalAlpha = 0.8;
    ctx.font = `700 20px ${sysFont}`;
    ctx.fillText(`${distLabel} ${distText}`, startX + 40, startY + 190);

    ctx.textAlign = 'right';
    ctx.fillText(`${paceLabel} ${paceText}`, startX + w - 30, startY + 190);
    ctx.globalAlpha = 1.0;
}

function drawAwardBadge(ctx, stats, textColor) {
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

    ctx.fillStyle = textColor === 'black' ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.4)';
    ctx.font = `900 16px ${sysFont}`;
    ctx.letterSpacing = "2px";
    ctx.fillText(distUnit.toUpperCase(), cx, cy + 55);
    ctx.letterSpacing = "0px";
}

function drawStealthBar(ctx, stats, textColor) {
    const sysFont = "'Plus Jakarta Sans', sans-serif";
    ctx.textBaseline = 'middle';

    const distLabel = (stats.mainLabel || (stats.hasDistance ? "DISTANCE" : "DURATION")).toUpperCase();
    const distText = stats.hasDistance ? `${stats.distanceVal || '0.00'}KM` : (stats.timeStr || '0:00');

    const paceLabel = (stats.subLabel || (stats.hasDistance ? "PACE" : "AVG HR")).toUpperCase();
    const paceParts = (stats.subValue || '').trim().split(' ');
    const paceText = paceParts[0] || (stats.avgHeartrate ? String(stats.avgHeartrate) : '0');
    let paceUnit = paceParts[1] || (stats.hasDistance ? '/KM' : 'BPM');
    if (paceUnit.toLowerCase() === 'min/km') paceUnit = '/KM';

    const cx = 540;
    const cy = 1750;
    const w = 980;
    const h = 120;

    // Black/Dark wide pill
    ctx.beginPath();
    ctx.roundRect(cx - w / 2, cy - h / 2, w, h, h / 2);
    ctx.fillStyle = 'rgba(0,0,0,0.8)'; // Always bold stealth
    ctx.shadowColor = 'rgba(0,0,0,0.3)';
    ctx.shadowBlur = 40;
    ctx.shadowOffsetY = 15;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.stroke();

    // Left Cyan badge
    const badgeW = 200;
    ctx.beginPath();
    ctx.roundRect(cx - w / 2 + 10, cy - h / 2 + 10, badgeW, h - 20, (h - 20) / 2);
    ctx.fillStyle = '#22d3ee';
    ctx.fill();

    ctx.textAlign = 'center';
    ctx.fillStyle = 'black';
    ctx.font = `italic 900 24px ${sysFont}`;
    ctx.fillText("SCORA", cx - w / 2 + 10 + badgeW / 2, cy);

    // Data Columns Setup
    ctx.fillStyle = 'white';
    const colStarts = [cx - w / 2 + 300, cx - w / 2 + 550, cx - w / 2 + 800];
    const labels = [distLabel, paceLabel, "TIME"];
    const values = [distText, `${paceText}${paceUnit}`, stats.timeStr || '0:00'];

    ctx.textAlign = 'left';
    for (let i = 0; i < 3; i++) {
        // Fallback for Time (3rd col) on Gym workouts is Avg HR
        if (i === 2 && !stats.hasDistance) {
            labels[i] = (stats.subLabel || "AVG HR").toUpperCase();
            values[i] = stats.avgHeartrate ? `${stats.avgHeartrate} BPM` : "DONE";
        }

        ctx.globalAlpha = 0.4;
        ctx.font = `900 14px ${sysFont}`;
        ctx.letterSpacing = "2px";
        ctx.fillText(labels[i], colStarts[i], cy - 18);

        ctx.globalAlpha = 1.0;
        ctx.font = `italic 900 36px ${sysFont}`;
        ctx.letterSpacing = "0px";
        ctx.fillText(values[i], colStarts[i], cy + 20);
    }
}

// ─── Quiet Luxury / Editorial Templates ───────────────────────────────────────

function drawTrackGraphic(ctx, x, y, w, h) {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 4; i++) {
        const inset = i * 25;
        ctx.beginPath();
        ctx.roundRect(x + inset, y + inset, w - inset * 2, h - inset * 2, (w - inset * 2) / 2);
        ctx.stroke();
    }
}

function drawEssentialItalic(ctx: CanvasRenderingContext2D, stats: any, textColor: string) {
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

    // 2. Main Stat
    const heroValue = main.value;
    let fontSize = heroValue.length > 5 ? 180 : 350;
    ctx.font = `italic 900 ${fontSize}px ${sysFont}`;
    const textWidth = ctx.measureText(heroValue).width;
    const maxWidth = 940;
    if (textWidth > maxWidth) {
        fontSize *= (maxWidth / textWidth);
        ctx.font = `italic 900 ${fontSize}px ${sysFont}`;
    }
    ctx.fillStyle = textColor === 'black' ? 'black' : 'white';
    ctx.fillText(heroValue, cx - 10, cy);

    // 3. Footer
    ctx.save();
    ctx.font = `300 44px ${sysFont}`;
    ctx.fillStyle = textColor === 'black' ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.5)';
    if (typeof ctx.letterSpacing !== 'undefined') ctx.letterSpacing = "2px";
    
    const unitPart = (main.unit || main.label).toUpperCase();
    const subPart = sub.value && sub.value !== '-' ? ` // ${sub.value} ${sub.unit || sub.label}` : '';
    const footer = `${unitPart}${subPart}`.toLowerCase();
    
    ctx.fillText(footer, cx, cy + 90);
    ctx.restore();
}

function drawObsidianBar(ctx: CanvasRenderingContext2D, stats: any, textColor: string) {
    const sysFont = "'Plus Jakarta Sans', sans-serif";
    const p = stats.dataPoints || [];
    const p1 = p[0] || { value: '-', label: 'Dist', unit: '' };
    const p2 = p[1] || { value: '-', label: 'Pace', unit: '' };
    const p3 = p[2] || { value: '-', label: 'Time', unit: '' };

    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';

    const cx = 540;
    const cy = 1600;
    const w = 920;
    const h = 240;

    // Background Pill
    ctx.beginPath();
    ctx.roundRect(cx - w / 2, cy - h / 2, w, h, 120);
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.shadowColor = 'rgba(0,0,0,0.4)';
    ctx.shadowBlur = 60;
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.stroke();

    // Data - 3 Columns
    const colX = [cx - 280, cx, cx + 280];
    
    // Col 1
    ctx.textAlign = 'center';
    ctx.fillStyle = 'white';
    const isLong1 = p1.value.length > 5;
    ctx.font = `italic 900 ${isLong1 ? '60px' : '110px'} ${sysFont}`;
    ctx.fillText(p1.value, colX[0], cy - 10);
    ctx.font = `500 14px ${sysFont}`;
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.letterSpacing = "6px";
    ctx.fillText((p1.unit || p1.label).toUpperCase(), colX[0], cy + 60);

    // Separators
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.beginPath(); ctx.moveTo(cx - 140, cy - 40); ctx.lineTo(cx - 140, cy + 40); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx + 140, cy - 40); ctx.lineTo(cx + 140, cy + 40); ctx.stroke();

    // Col 2
    ctx.fillStyle = 'white';
    const isLong2 = p2.value.length > 5;
    ctx.font = `italic 900 ${isLong2 ? '60px' : '90px'} ${sysFont}`;
    ctx.fillText(p2.value, colX[1], cy - 10);
    ctx.font = `500 14px ${sysFont}`;
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.fillText(p2.label.toUpperCase(), colX[1], cy + 60);

    // Col 3
    ctx.textAlign = 'center'; // Changed from right to center for Obsidian consistency
    ctx.fillStyle = 'white';
    const isLong3 = p3.value.length > 5;
    ctx.font = `italic 900 ${isLong3 ? '60px' : '80px'} ${sysFont}`;
    ctx.fillText(p3.value, colX[2], cy - 10);
    ctx.font = `500 14px ${sysFont}`;
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.fillText(p3.label.toUpperCase(), colX[2], cy + 60);
    ctx.letterSpacing = "0px";
}

function drawTrackRecord(ctx: CanvasRenderingContext2D, stats: any, textColor: string) {
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
    ctx.font = `italic 900 ${isLong ? '100px' : '230px'} ${sysFont}`;
    ctx.fillStyle = textColor === 'black' ? 'black' : 'white';
    ctx.fillText(heroValue, cx, cy - 20);

    // Label
    ctx.font = `900 24px ${sysFont}`;
    ctx.fillStyle = textColor === 'black' ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.3)';
    ctx.letterSpacing = "12px";
    const label = (main.unit || main.label).toUpperCase();
    ctx.fillText(label, cx + 6, cy + 100);
    ctx.letterSpacing = "0px";
}

function drawMonoSplit(ctx: CanvasRenderingContext2D, stats: any, textColor: string) {
    const sysFont = "'Plus Jakarta Sans', sans-serif";
    const p = stats.dataPoints || [];
    const p1 = p[0] || { value: '0.00', label: 'Dist', unit: 'km' };
    const p2 = p[1] || { value: '0:00', label: 'Pace', unit: '/km' };

    const cx = 540;
    const cy = 1600;
    const w = 400; // base width for half
    const h = 280;

    // Left Half (White)
    ctx.beginPath();
    ctx.roundRect(cx - w, cy - h / 2, w, h, [60, 0, 0, 60]);
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.fill();

    // Right Half (Black/Transparent)
    ctx.beginPath();
    ctx.roundRect(cx, cy - h / 2, w, h, [0, 60, 60, 0]);
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.stroke();

    // Left Data
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'black';
    const isLong1 = p1.value.length > 5;
    ctx.font = `italic 900 ${isLong1 ? '60px' : '100px'} ${sysFont}`;
    ctx.fillText(p1.value, cx - w / 2, cy - 15);
    ctx.font = `900 14px ${sysFont}`;
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.letterSpacing = "4px";
    ctx.fillText((p1.unit || p1.label).toUpperCase(), cx - w / 2, cy + 60);

    // Right Data
    ctx.fillStyle = 'white';
    const isLong2 = p2.value.length > 5;
    ctx.font = `italic 900 ${isLong2 ? '60px' : '100px'} ${sysFont}`;
    ctx.globalAlpha = 0.8;
    ctx.fillText(p2.value, cx + w / 2, cy - 15);
    ctx.font = `900 14px ${sysFont}`;
    ctx.globalAlpha = 0.3;
    ctx.fillText(p2.label.toUpperCase(), cx + w / 2, cy + 60);
    ctx.globalAlpha = 1.0;
    ctx.letterSpacing = "0px";
}

function drawEditorialArchive(ctx: CanvasRenderingContext2D, stats: any, textColor: string) {
    const sysFont = "'Plus Jakarta Sans', sans-serif";
    const p = stats.dataPoints || [];
    const p1 = p[0] || { value: '0.00', label: 'Dist', unit: 'km' };
    const p2 = p[1] || { value: '0:00', label: 'Pace', unit: '/km' };
    const p3 = p[2] || { value: '0m', label: 'Time', unit: '' };

    const cx = 540;
    const cy = 1500;
    const w = 700;
    const h = 600;

    // Paper-like background (very subtle)
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.fillRect(cx - w / 2, cy - h / 2, w, h);

    ctx.textAlign = 'left';
    ctx.fillStyle = 'black';

    // Date - Use dataPoints[9] (Date) if available
    const datePoint = p.find(x => x.label === 'Date') || { value: stats.date || 'MAR 08' };
    ctx.font = `italic 700 14px ${sysFont}`;
    ctx.globalAlpha = 0.4;
    ctx.letterSpacing = "4px";
    ctx.fillText(datePoint.value.toUpperCase(), cx - w / 2 + 60, cy - h / 2 + 80);
    ctx.letterSpacing = "0px";
    ctx.globalAlpha = 1.0;

    // Row 1: Primary
    const isLong1 = p1.value.length > 5;
    ctx.font = `italic 900 ${isLong1 ? '120px' : '240px'} ${sysFont}`;
    ctx.fillText(p1.value, cx - w / 2 + 50, cy + 50);

    // Label Divider
    ctx.strokeStyle = 'rgba(0,0,0,0.1)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(cx - w / 2 + 60, cy + 100); ctx.lineTo(cx + w / 2 - 60, cy + 100); ctx.stroke();

    ctx.font = `900 18px ${sysFont}`;
    ctx.letterSpacing = "4px";
    const labelMain = (p1.unit || p1.label).toUpperCase();
    ctx.fillText(`${labelMain} // PERFORMANCE DATA`, cx - w / 2 + 60, cy + 140);

    // Row 2: Secondary stats
    ctx.beginPath(); ctx.moveTo(cx - w / 2 + 60, cy + 200); ctx.lineTo(cx + w / 2 - 60, cy + 200); ctx.stroke();
    
    ctx.font = `italic 800 48px ${sysFont}`;
    ctx.fillText(p2.value, cx - w / 2 + 60, cy + 260);

    ctx.textAlign = 'right';
    ctx.fillText(p3.value, cx + w / 2 - 60, cy + 260);
    ctx.letterSpacing = "0px";
}

function drawSocialFloat(ctx: CanvasRenderingContext2D, stats: any, textColor: string) {
    const sysFont = "'Plus Jakarta Sans', sans-serif";
    const p = stats.dataPoints || [];
    const main = p[0] || { value: '0.00', label: 'Dist', unit: 'km' };
    const p2 = p[1] || { value: '0:00', label: 'Pace', unit: '/km' };
    const p3 = p[2] || { value: '0m', label: 'Time', unit: '' };

    const cx = 540;
    const cy = 960;

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Start Time (top)
    ctx.font = `700 32px ${sysFont}`;
    ctx.fillStyle = textColor === 'black' ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.3)';
    ctx.letterSpacing = "10px";
    ctx.fillText(stats.startTime || "07:08", cx, cy - 300);
    ctx.letterSpacing = "0px";

    // Massive Primary Stat (with decimal split effect)
    const heroValue = main.value;
    const [whole, frac] = heroValue.includes('.') ? heroValue.split('.') : [heroValue, ""];
    
    // integer part (bold italic)
    const wholeSize = heroValue.length > 5 ? 240 : 440;
    ctx.font = `italic 900 ${wholeSize}px ${sysFont}`;
    ctx.fillStyle = textColor === 'black' ? 'black' : 'white';
    const wholeW = ctx.measureText(whole).width;
    
    // fractional part (subtle color)
    const fracSize = heroValue.length > 5 ? 80 : 140;
    ctx.font = `italic 900 ${fracSize}px ${sysFont}`;
    const fracW = frac ? ctx.measureText(`.${frac}`).width : 0;
    const totalW = wholeW + (frac ? fracW + 10 : 0);

    ctx.textAlign = 'left';
    ctx.font = `italic 900 ${wholeSize}px ${sysFont}`;
    ctx.fillText(whole, cx - totalW / 2, cy + 40);
    
    if (frac) {
        ctx.fillStyle = textColor === 'black' ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.15)';
        ctx.font = `italic 900 ${fracSize}px ${sysFont}`;
        ctx.fillText(`.${frac}`, cx - totalW / 2 + wholeW + 10, cy + 40);
    }

    // Divider
    ctx.strokeStyle = textColor === 'black' ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(cx - 150, cy + 180); ctx.lineTo(cx + 150, cy + 180); ctx.stroke();

    // Bottom Stats
    ctx.textAlign = 'center';
    ctx.font = `italic 300 100px ${sysFont}`;
    ctx.fillStyle = textColor === 'black' ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.6)';
    ctx.letterSpacing = "-2px";
    // Show P2 and P3 side by side
    ctx.fillText(`${p2.value}    ${p3.value}`, cx, cy + 320);
    ctx.letterSpacing = "0px";
}

function drawMetricThin(ctx: CanvasRenderingContext2D, stats: any, textColor: string) {
    const sysFont = "'Plus Jakarta Sans', sans-serif";
    const p = stats.dataPoints || [];
    const main = p[0] || { value: '0.00', label: 'Dist', unit: 'km' };
    const sub = p[1] || { value: '0:00', label: 'Pace', unit: '/km' };

    const cx = 100;
    const cy = 1720;

    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';

    // Massive Thin Number - Aggressive scaling to fit
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
    ctx.fillText(heroValue, cx, cy);

    // Bottom row
    const rowY = cy + 110;
    ctx.save();
    ctx.font = `900 24px ${sysFont}`;
    ctx.fillStyle = textColor === 'black' ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.2)';
    if (typeof ctx.letterSpacing !== 'undefined') ctx.letterSpacing = "15px";
    const labelMain = (main.unit || main.label).toUpperCase();
    ctx.fillText(labelMain, cx + 5, rowY);
    ctx.restore();

    ctx.font = `italic 100 110px ${sysFont}`;
    ctx.fillStyle = textColor === 'black' ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.5)';
    ctx.fillText(sub.value, cx + 240, rowY + 15);
}

function drawDataMatrix(ctx: CanvasRenderingContext2D, stats: any, textColor: string) {
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

function drawVerticalLabel(ctx: CanvasRenderingContext2D, stats: any, textColor: string) {
    const sysFont = "'Plus Jakarta Sans', sans-serif";
    const p = stats.dataPoints || [];
    const main = p[0] || { value: '0.00', label: 'Dist', unit: 'km' };
    const p2 = p[1] || { value: '0:00', label: 'Pace', unit: '' };
    const p3 = p[2] || { value: '0m', label: 'Time', unit: '' };

    const cx = 540;
    const cy = 950; 
    const boxW = 440;
    const boxH_top = 750;
    const boxH_bot = 620;

    // 1. Top Section (Black)
    ctx.fillStyle = 'black';
    ctx.fillRect(cx - boxW / 2, cy - boxH_top, boxW, boxH_top);

    // 2. Vertical Hero
    ctx.save();
    ctx.translate(cx, cy - boxH_top * 0.55);
    ctx.rotate(Math.PI / 2); 
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'white';
    let fontSize = 210;
    ctx.font = `italic 900 ${fontSize}px ${sysFont}`;
    const textW = ctx.measureText(main.value).width;
    if (textW > boxH_top * 0.8) {
        fontSize *= (boxH_top * 0.8 / textW);
        ctx.font = `italic 900 ${fontSize}px ${sysFont}`;
    }
    if (typeof ctx.letterSpacing !== 'undefined') ctx.letterSpacing = "-8px";
    ctx.fillText(main.value, 0, 0);
    ctx.restore();

    // 3. KM Unit (Small and stylized)
    ctx.save();
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.font = `900 24px ${sysFont}`;
    if (typeof ctx.letterSpacing !== 'undefined') ctx.letterSpacing = "16px";
    const labelMain = (main.unit || main.label).toUpperCase();
    ctx.fillText(labelMain, cx + 8, cy - 80);
    ctx.restore();

    // 4. Bottom Section (White)
    ctx.fillStyle = 'white';
    ctx.fillRect(cx - boxW / 2, cy, boxW, boxH_bot);

    // 5. Secondary Data Points (Condensed)
    const renderBotCell = (data, yOffset, size, opacity, weight) => {
        ctx.save();
        ctx.translate(cx, cy + yOffset);
        ctx.textAlign = 'center';
        ctx.fillStyle = 'black';
        ctx.font = `italic ${weight} ${size}px ${sysFont}`;
        ctx.fillText(data.value, 0, 0);
        
        ctx.font = `900 18px ${sysFont}`;
        ctx.fillStyle = `rgba(0,0,0,${opacity})`;
        if (typeof ctx.letterSpacing !== 'undefined') ctx.letterSpacing = "10px";
        ctx.fillText(data.label.toUpperCase(), 0, 55);
        ctx.restore();
    };

    renderBotCell(p2, 170, 100, 0.2, 900); // Pace
    renderBotCell(p3, 400, 80, 0.1, 300);  // Time
}

function drawFrostedMinimal(ctx: CanvasRenderingContext2D, stats: any, textColor: string) {
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
    const isLong = main.value.length > 5;
    ctx.font = `italic 900 ${isLong ? '70px' : '140px'} ${sysFont}`;
    const dW = ctx.measureText(main.value).width;
    ctx.fillText(main.value, cx - w / 2 + 80, cy);
    
    ctx.font = `900 18px ${sysFont}`;
    ctx.globalAlpha = 0.2;
    ctx.letterSpacing = "8px";
    const labelMain = (main.unit || main.label).toUpperCase();
    ctx.fillText(labelMain, cx - w / 2 + 80 + dW + 20, cy + 10);
    ctx.letterSpacing = "0px";
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
    ctx.letterSpacing = "10px";
    ctx.fillText(p2.label.toUpperCase(), cx + 80, cy + 40);
    ctx.letterSpacing = "0px";
    ctx.globalAlpha = 1.0;
}

// ─── Export ───────────────────────────────────────────────────────────────────

export function exportCanvas(canvasId: string) {
    const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
    const link = document.createElement('a');
    link.download = `scora_${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
}