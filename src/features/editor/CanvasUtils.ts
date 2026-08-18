/**
 * CanvasUtils.ts — Helpers to reduce boilerplate in Scora stickers.
 */

export interface ThemeColors {
    solid: string;
    trans: string;
    label: string;
    accent: string;
}

/**
 * Builds a theme palette based on the target text color.
 */
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

export function getThemeColors(textColor: string): ThemeColors {
    const alphaValue = 0.8;
    let base = '255, 255, 255';
    if (textColor === 'black') base = '0, 0, 0';
    else if (textColor.startsWith('#')) base = hexToRgb(textColor);

    const isDark = isColorDark(textColor.startsWith('#') ? textColor : (textColor === 'black' ? '#000000' : '#ffffff'));
    const accent = textColor.startsWith('#') ? textColor : (textColor === 'black' ? '#000000' : '#ffffff');

    return {
        solid: `rgb(${base})`,
        trans: `rgba(${base}, ${alphaValue})`,
        label: isDark ? 'rgba(0,0,0,0.75)' : 'rgba(255,255,255,0.75)',
        accent: accent,
    };
}

/**
 * Draws a primary stat with its unit efficiently.
 * Handles spacing and font shifts automatically.
 */
export function drawStatWithUnit(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    value: string,
    unit: string,
    options: {
        valueFont: string;
        unitFont: string;
        valueColor: string;
        unitColor: string;
        gap?: number;
        align?: 'left' | 'center' | 'right';
    }
) {
    const gap = options.gap ?? 15;
    const align = options.align ?? 'left';

    ctx.save();

    // Measure total width
    ctx.font = options.valueFont;
    const valWidth = ctx.measureText(value).width;
    ctx.font = options.unitFont;
    const unitWidth = unit ? ctx.measureText(unit).width : 0;
    const totalWidth = valWidth + (unit ? gap + unitWidth : 0);

    // Calculate start X based on alignment
    let startX = x;
    if (align === 'center') startX = x - totalWidth / 2;
    else if (align === 'right') startX = x - totalWidth;

    // Draw Value
    ctx.textAlign = 'left';
    ctx.fillStyle = options.valueColor;
    ctx.font = options.valueFont;
    ctx.fillText(value, startX, y);

    // Draw Unit
    if (unit) {
        ctx.fillStyle = options.unitColor;
        ctx.font = options.unitFont;
        ctx.fillText(unit, startX + valWidth + gap, y);
    }

    ctx.restore();
    return totalWidth;
}

/**
 * Decodes Google's Encoded Polyline Algorithm Format.
 * Returns an array of [lat, lng] coordinates.
 */
export function decodePolyline(str: string) {
    if (!str) return [];
    let index = 0, lat = 0, lng = 0, coordinates: [number, number][] = [],
        shift = 0, result = 0, byte = null, latitude_change, longitude_change, factor = 1e5;
    while (index < str.length) {
        byte = null; shift = 0; result = 0;
        do { byte = str.charCodeAt(index++) - 63; result |= (byte & 0x1f) << shift; shift += 5; } while (byte >= 0x20);
        latitude_change = ((result & 1) ? ~(result >> 1) : (result >> 1));
        shift = result = 0;
        do { byte = str.charCodeAt(index++) - 63; result |= (byte & 0x1f) << shift; shift += 5; } while (byte >= 0x20);
        longitude_change = ((result & 1) ? ~(result >> 1) : (result >> 1));
        lat += latitude_change; lng += longitude_change;
        coordinates.push([lat / factor, lng / factor]);
    }
    return coordinates;
}

/**
 * Draws a dynamic route path based on a polyline string.
 * Automatically centers and scales to fit the specified size.
 */
export function drawRoutePath(ctx: CanvasRenderingContext2D, polyline: string, x: number, y: number, size: number, options: { color: string, strokeWidth: number }) {
    const points = decodePolyline(polyline);
    if (points.length < 2) return;

    // Find bounding box
    let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
    points.forEach(([lat, lng]) => {
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
        if (lng < minLng) minLng = lng;
        if (lng > maxLng) maxLng = lng;
    });

    const latRange = maxLat - minLat;
    const lngRange = maxLng - minLng;
    const maxRange = Math.max(latRange, lngRange);

    const padding = 10;
    const scale = (size - padding * 2) / (maxRange || 1);

    const xOffset = (size - lngRange * scale) / 2;
    const yOffset = (size - latRange * scale) / 2;

    ctx.save();
    ctx.translate(x - size / 2, y - size / 2); // Center of the coordinate system
    ctx.beginPath();
    ctx.strokeStyle = options.color;
    ctx.lineWidth = options.strokeWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    points.forEach(([lat, lng], i) => {
        const px = xOffset + (lng - minLng) * scale;
        const py = size - (yOffset + (lat - minLat) * scale); // Flip Y
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
    });

    ctx.stroke();
    ctx.restore();
}

/**
 * Parses a duration string (e.g., "1h 11m", "45m", "1:22:33") into numeric and unit parts.
 * Used for consistent styling (transparent numbers, solid units).
 */
export function parseDurationParts(durationStr: string) {
    const parts: { val: string; unit: string }[] = [];
    if (!durationStr) return parts;

    // Handle HH:MM:SS format
    if (durationStr.includes(':')) {
        parts.push({ val: durationStr, unit: '' });
        return parts;
    }

    // Handle "1h 11m" format
    // Match numbers and their following units (if any)
    const regex = /(\d+(?:\.\d+)?)\s*([a-zA-Z]+)?/g;
    let m;
    while ((m = regex.exec(durationStr)) !== null) {
        parts.push({
            val: m[1],
            unit: m[2] || ''
        });
    }

    // Fallback if no numbers found
    if (parts.length === 0) {
        parts.push({ val: durationStr, unit: '' });
    }

    return parts;
}

/**
 * Sets letter spacing with a fallback for older browsers.
 */
export function setLetterSpacing(ctx: any, spacing: string) {
    if (typeof ctx.letterSpacing !== 'undefined') {
        ctx.letterSpacing = spacing;
    }
}
/**
 * Draws a standardized metric block (Label atop Value+Unit).
 * Centralizes the layout logic for the new "Component-Based" architecture.
 */
export function drawMetricBlock(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    label: string,
    value: string,
    unit: string,
    options: {
        labelFont: string;
        valueFont: string;
        unitFont: string;
        color: string;
        labelAlpha?: number;
        showLabel?: boolean;
        spacing?: number;
        unitGap?: number;
    }
) {
    const spacing = options.spacing ?? 15;
    const showLabel = options.showLabel ?? true;

    ctx.save();
    ctx.translate(x, y);

    // 1. Label (Optional, Top)
    if (showLabel) {
        ctx.save();
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';
        ctx.font = options.labelFont;
        ctx.fillStyle = options.color;
        ctx.globalAlpha = options.labelAlpha ?? 0.8;
        setLetterSpacing(ctx, "0.15em");
        ctx.fillText(label.toUpperCase(), 0, -spacing);
        ctx.restore();
    }

    // 2. Value + Unit (Aligned to baseline)
    drawStatWithUnit(ctx, 0, 0, value, unit, {
        valueFont: options.valueFont,
        unitFont: options.unitFont,
        valueColor: options.color,
        unitColor: options.color,
        gap: options.unitGap ?? 10,
        align: 'left'
    });

    ctx.restore();
}

/**
 * Normalizes activity types to shorter, layout-safe labels.
 * Standardizes mapping from raw Strava types to Scora "Studio Precision" labels.
 */
export function normalizeSport(type: string): string {
    if (!type) return 'Workout';
    const lower = type.toLowerCase();
    
    // 1. TRAINING (HIIT, Gym, Crossfit, etc.)
    if (lower.includes('weight') || lower.includes('workout') || lower.includes('gym') || 
        lower.includes('training') || lower.includes('crossfit') || lower.includes('hiit') || 
        lower.includes('yoga') || lower.includes('pilates')) {
        return 'Workout';
    }
    // 2. RIDE (The "Action" word for all Cycling)
    if (lower.includes('ride') || lower.includes('cycle') || lower.includes('bike')) {
        return 'Ride';
    }
    // 3. RUN (Trail, Virtual, etc.)
    if (lower.includes('run') || lower.includes('walk') || lower.includes('hike')) {
        return 'Run';
    }
    // 4. SWIM
    if (lower.includes('swim')) {
        return 'Swim';
    }
    // 5. SKI
    if (lower.includes('ski') || lower.includes('snowboard')) {
        return 'Ski';
    }
    
    // Fallback to Title Case
    return type.charAt(0).toUpperCase() + type.slice(1).toLowerCase();
}

/**
 * Extracts and formats the best 2-3 stats for a given activity type.
 * Standardizes mapping from raw stats to display-ready objects.
 */
export function getDynamicStats(stats: any) {
    const hasDistance = stats.hasDistance || (stats.distanceVal && parseFloat(stats.distanceVal) > 0);
    const rawType = stats.type || (hasDistance ? 'Run' : 'Workout');
    const type = normalizeSport(rawType);
    const hasMap = !!stats.polyline;

    // Create a pool of available unique data points to avoid duplication
    const pool: { value: string; unit: string; label: string }[] = [];
    
    // Parse time/duration correctly (e.g. from "1h 11m" into "71" and "min")
    const timeText = stats.timeStr || '0:00';
    let durationVal = timeText;
    let durationUnit = '';
    
    // Attempt to convert "1h 11m" -> "71", "min"
    if (timeText.includes('h') || timeText.includes('m')) {
        const hMatch = timeText.match(/(\d+)h/);
        const mMatch = timeText.match(/(\d+)m/);
        let totalMins = 0;
        if (hMatch) totalMins += parseInt(hMatch[1]) * 60;
        if (mMatch) totalMins += parseInt(mMatch[1]);
        if (totalMins > 0) {
            durationVal = String(totalMins);
            durationUnit = 'min';
        }
    }

    if (hasDistance) {
        // Distance
        const distText = stats.distanceVal || '0.00';
        pool.push({ value: distText, unit: 'km', label: 'DISTANCE' });

        // Pace / Speed
        const subValFull = stats.subValue || '';
        const paceVal = subValFull.split(' ')[0] || '0:00';
        
        const uType = type.toUpperCase();
        if (uType === 'RIDE' || uType === 'BIKE' || uType === 'SKI') {
            pool.push({ value: paceVal, unit: 'km/h', label: 'SPEED' });
        } else if (uType === 'SWIM') {
            pool.push({ value: paceVal, unit: '/100m', label: 'PACE' });
        } else {
            // Run, Walk, Hike
            pool.push({ value: paceVal, unit: '/km', label: 'PACE' });
        }

        // Duration
        pool.push({ value: durationVal, unit: durationUnit, label: 'DURATION' });
    } else {
        // Duration
        pool.push({ value: durationVal, unit: durationUnit, label: 'DURATION' });

        // Heart Rate
        const hr = stats.hr || stats.avgHeartrate || (stats.average_heartrate ? Math.round(stats.average_heartrate) : null);
        if (hr) {
            pool.push({ value: `${hr}`, unit: 'bpm', label: 'HEART RATE' });
        }
        
        // Suffer Score / Max HR
        const maxHr = stats.max_heartrate || stats.maxHeartrate || (stats.max_hr ? Math.round(stats.max_hr) : null);
        const sufferScore = stats.suffer_score || stats.sufferScore;
        if (maxHr) {
            pool.push({ value: `${maxHr}`, unit: 'bpm', label: 'MAX HR' });
        } else if (sufferScore) {
            pool.push({ value: `${sufferScore}`, unit: '', label: 'RELATIVE EFFORT' });
        }
    }

    // Secondary Fallbacks (Metadata) to avoid duplication or empty slots
    const metaPool = [
        { value: stats.startTime || '', unit: '', label: 'START' },
        { value: stats.date || '', unit: '', label: 'DATE' },
        { value: (stats.location && stats.location !== 'Unknown') ? stats.location : '', unit: '', label: 'LOCATION' }
    ];

    metaPool.forEach(m => {
        if (m.value && !pool.some(p => p.value === m.value)) {
            pool.push(m);
        }
    });

    // Final Slot Extraction
    const s1 = pool[0] || { value: '-', unit: '', label: '' };
    const s2 = pool[1] || { value: '-', unit: '', label: '' };
    const s3 = pool[2] || { value: '-', unit: '', label: '' };

    return { s1, s2, s3, hasMap, type };
}

/**
 * Draws a sequence of duration parts (val/unit) with alternating alpha/fonts.
 * Returns the total width drawn.
 */
export function drawDurationSequence(
    ctx: CanvasRenderingContext2D,
    startX: number,
    y: number,
    parts: { val: string; unit: string }[],
    options: {
        valFont: string;
        unitFont: string;
        valColor: string;
        unitColor: string;
        gap: number;
        unitGap: number;
    }
) {
    let currentX = startX;
    parts.forEach((p, i) => {
        // Draw Value
        ctx.font = options.valFont;
        ctx.fillStyle = options.valColor;
        ctx.fillText(p.val, currentX, y);
        currentX += ctx.measureText(p.val).width + options.unitGap;

        // Draw Unit
        if (p.unit) {
            ctx.font = options.unitFont;
            ctx.fillStyle = options.unitColor;
            ctx.fillText(p.unit, currentX, y);
            currentX += ctx.measureText(p.unit).width + (i < parts.length - 1 ? options.gap : 0);
        }
    });
    return currentX - startX;
}
