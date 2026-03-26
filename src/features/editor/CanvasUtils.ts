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
export function getThemeColors(textColor: string): ThemeColors {
    const alphaValue = 0.45;
    const base = textColor === 'black' ? '0, 0, 0' : '255, 255, 255';
    return {
        solid: `rgb(${base})`,
        trans: `rgba(${base}, ${alphaValue})`,
        label: textColor === 'black' ? 'rgba(0,0,0,0.75)' : 'rgba(255,255,255,0.75)',
        accent: '#80cbc4',
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
    const regex = /(\d+)\s*([a-zA-Z]+)?/g;
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
        ctx.globalAlpha = options.labelAlpha ?? 0.4;
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
 * Extracts and formats the best 2-3 stats for a given activity type.
 * Standardizes mapping from raw stats to display-ready objects.
 */
export function getDynamicStats(stats: any) {
    const hasDistance = stats.hasDistance || (stats.distanceVal && parseFloat(stats.distanceVal) > 0);
    const type = stats.type || (hasDistance ? 'Run' : 'Workout');
    const hasMap = !!stats.polyline;

    // Standard properties from TemplateManager/TestUtils
    const distText = stats.distanceVal || '0.00';
    const paceText = (stats.subValue || '').split(' ')[0] || '0:00';
    const paceLabel = (stats.subLabel || (type === 'Ride' ? 'KM/H' : 'PACE')).toUpperCase();
    const timeText = stats.timeStr || '0:00';

    // Default Running Stats
    let s1 = { value: distText, label: 'KM' };
    let s2 = { value: paceText, label: paceLabel };
    let s3 = { value: timeText, label: 'TIME' };

    if (!hasDistance) {
        // Gym / Workout / Stationary
        s1 = { value: timeText, label: 'DURATION' };
        s2 = { value: stats.avgHeartrate ? `${stats.avgHeartrate}` : (stats.subValue?.split(' ')[0] || '0'), label: 'BPM' };
        s3 = { value: stats.calories ? `${stats.calories}` : '0', label: 'KCAL' };
    }

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
