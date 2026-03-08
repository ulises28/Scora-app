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
    if (stats.hasMap) {
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
    else drawRunningData(ctx, stats, textColor);
}

// ─── 8M Special Templates ─────────────────────────────────────────────────────
// Feminist running stickers for International Women's Day (8M)
// Colors: purple (justice/dignity), green (hope/progress), white (solidarity)

function draw8MTemplate(ctx, stats, templateType, showLogo) {

    // ── Background: deep purple radial gradient ───────────────────────────────
    const grad = ctx.createRadialGradient(540, 700, 60, 540, 960, 1100);
    grad.addColorStop(0, '#3B0764');   // rich purple centre
    grad.addColorStop(0.5, '#1E0338'); // deep mid
    grad.addColorStop(1, '#0A0014');   // near-black edge
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1080, 1920);

    // ── ♀ 8M — massive hero, very transparent purple ──────────────────────────
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.font = "900 380px 'Plus Jakarta Sans'";
    ctx.fillStyle = 'rgba(168, 85, 247, 0.18)'; // ultra-transparent purple
    ctx.fillText('♀ 8M', 540, 640);

    // ── Activity title ────────────────────────────────────────────────────────
    ctx.font = "500 44px 'Plus Jakarta Sans'";
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fillText(stats.title || 'Run', 540, 720);

    // ── Stats ─────────────────────────────────────────────────────────────────
    const hasDistance = stats.distanceVal && parseFloat(stats.distanceVal) > 0;

    if (hasDistance) {
        // Distance (big transparent white number + white unit)
        const distNum = stats.distanceVal || '0.00';
        const distUnit = 'km';

        ctx.font = "800 220px 'Plus Jakarta Sans'";
        const dW = ctx.measureText(distNum).width;

        ctx.font = "700 110px 'Plus Jakarta Sans'";
        const duW = ctx.measureText(distUnit).width;

        const gap = 10;
        const dTotal = dW + gap + duW;
        const dStart = 540 - dTotal / 2;

        ctx.textAlign = 'left';
        ctx.font = "800 220px 'Plus Jakarta Sans'";
        ctx.fillStyle = 'rgba(255,255,255,0.20)';
        ctx.fillText(distNum, dStart, 1020);

        ctx.font = "700 110px 'Plus Jakarta Sans'";
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.fillText(distUnit, dStart + dW + gap, 1020);

        ctx.textAlign = 'center';
        ctx.font = "500 36px 'Plus Jakarta Sans'";
        ctx.fillStyle = '#86EFAC'; // green — movement colour
        ctx.fillText('Distance', 540, 1080);

        // Pace (medium transparent white)
        const paceStr = stats.subValue || stats.maxPace || '0:00';
        const paceClean = paceStr.replace(' /km', '').replace(' km/h', '');
        const paceUnit = (stats.maxPaceUnit === 'km/h') ? 'km/h' : '/km';

        ctx.font = "700 120px 'Plus Jakarta Sans'";
        const pW = ctx.measureText(paceClean).width;

        ctx.font = "600 60px 'Plus Jakarta Sans'";
        const puW = ctx.measureText(paceUnit).width;

        const pTotal = pW + gap + puW;
        const pStart = 540 - pTotal / 2;

        ctx.textAlign = 'left';
        ctx.font = "700 120px 'Plus Jakarta Sans'";
        ctx.fillStyle = 'rgba(255,255,255,0.20)';
        ctx.fillText(paceClean, pStart, 1270);

        ctx.font = "600 60px 'Plus Jakarta Sans'";
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.fillText(paceUnit, pStart + pW + gap, 1270);

        ctx.textAlign = 'center';
        ctx.font = "500 36px 'Plus Jakarta Sans'";
        ctx.fillStyle = '#86EFAC';
        ctx.fillText(stats.subLabel || 'Pace', 540, 1325);

        // Route — drawn in purple if available
        if (stats.polyline) {
            const coords = decodePolyline(stats.polyline);
            draw8MRoute(ctx, coords, { x: 90, y: 1380, w: 900, h: 420 });
        }

    } else {
        // Gym fallback: Duration + HR
        ctx.font = "800 190px 'Plus Jakarta Sans'";
        ctx.fillStyle = 'rgba(255,255,255,0.20)';
        ctx.textAlign = 'center';
        ctx.fillText(stats.timeStr || '0m', 540, 1050);

        ctx.font = "500 40px 'Plus Jakarta Sans'";
        ctx.fillStyle = '#86EFAC';
        ctx.fillText('Duration', 540, 1120);

        if (stats.maxHeartrate) {
            ctx.font = "700 110px 'Plus Jakarta Sans'";
            ctx.fillStyle = 'rgba(255,255,255,0.18)';
            ctx.fillText(String(stats.maxHeartrate), 540, 1370);

            ctx.font = "500 55px 'Plus Jakarta Sans'";
            ctx.fillStyle = 'rgba(255,255,255,0.85)';
            ctx.fillText('bpm', 540, 1435);

            ctx.font = "400 36px 'Plus Jakarta Sans'";
            ctx.fillStyle = '#86EFAC';
            ctx.fillText('Max Heartrate', 540, 1490);
        }
    }

    // ── Tagline ───────────────────────────────────────────────────────────────
    const tagline = templateType === '8m2' ? 'Corremos Juntas ✊' : 'Run Like a Girl';

    ctx.textAlign = 'center';
    ctx.font = "600 italic 58px 'Plus Jakarta Sans'";
    ctx.fillStyle = 'rgba(168, 85, 247, 0.70)'; // translucent purple

    const tagY = hasDistance && stats.polyline ? 1870 : 1650;
    ctx.fillText(tagline, 540, tagY);

    // ── #8M marker ───────────────────────────────────────────────────────────
    ctx.font = "500 32px 'Plus Jakarta Sans'";
    ctx.fillStyle = 'rgba(255,255,255,0.30)';
    ctx.fillText('#8M · 8 de Marzo', 540, tagY + 48);

    // Redraw logo in teal at top (overridden inside drawTemplate already if showLogo=false)
    // logo is already drawn by the outer drawTemplate call — nothing to do here
}

// Purple route line for 8M templates
function draw8MRoute(ctx, coords, mapBox) {
    if (!coords || coords.length === 0) return;

    let minLat = coords[0][0], maxLat = minLat;
    let minLng = coords[0][1], maxLng = minLng;
    coords.forEach(p => {
        if (p[0] < minLat) minLat = p[0];
        if (p[0] > maxLat) maxLat = p[0];
        if (p[1] < minLng) minLng = p[1];
        if (p[1] > maxLng) maxLng = p[1];
    });

    const latRange = maxLat - minLat || 0.001;
    const lngRange = maxLng - minLng || 0.001;
    const scale = Math.min(mapBox.w / lngRange, mapBox.h / latRange) * 0.85;
    const offX = mapBox.x + mapBox.w / 2 - ((minLng + maxLng) / 2 - minLng) * scale - (lngRange * scale) / 2;
    const offY = mapBox.y + mapBox.h / 2 + ((minLat + maxLat) / 2 - minLat) * scale - (latRange * scale) / 2;

    ctx.beginPath();
    ctx.strokeStyle = 'rgba(168, 85, 247, 0.85)'; // purple route
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    coords.forEach((p, i) => {
        const x = offX + (p[1] - minLng) * scale;
        const y = offY - (p[0] - minLat) * scale;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();
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

    // Duration value split: "1h 11m" → "1h 11" + "m" (or "71" + "m")
    const rawDur = stats.mainValue || '0m';
    const durMatch = rawDur.match(/^([\dh ]+?)(m)?$/);
    const numText = durMatch ? durMatch[1].trimEnd() : rawDur;
    const unitText = 'm';

    ctx.font = "800 200px 'Plus Jakarta Sans'";
    const numW = ctx.measureText(numText).width;

    ctx.font = "700 100px 'Plus Jakarta Sans'";
    const unitW = ctx.measureText(unitText).width;

    const gap = 8;
    const totalW = numW + gap + unitW;
    const startX = 540 - totalW / 2;

    ctx.textAlign = 'left';

    ctx.font = "800 200px 'Plus Jakarta Sans'";
    ctx.fillStyle = c.trans;
    ctx.fillText(numText, startX, 1020);

    ctx.font = "700 100px 'Plus Jakarta Sans'";
    ctx.fillStyle = c.solid;
    ctx.fillText(unitText, startX + numW + gap, 1020);

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
        ctx.fillText('Avg HR', 300, hrY + 115);

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
    ctx.fillText('Avg Heartrate', 540, 870);

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
    ctx.fillText('Distance', 540, distY + 70);

    // ── Max Pace / Max Speed (sport-aware) ───────────────────────────────────
    const paceY = 1050;
    const paceText = stats.maxPace || '0:00';
    const paceUnit = stats.maxPaceUnit || 'min/km';
    const paceLabel = stats.maxPaceLabel || 'Max Pace';

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
    const reentryX = x + width - 20;  // Where the tail re-enters the bubble bottom

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
    const captionText = 'Started 7:08 AM';

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

// ─── Export ───────────────────────────────────────────────────────────────────

export function exportCanvas(canvasId: string) {
    const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
    const link = document.createElement('a');
    link.download = `scora_${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
}