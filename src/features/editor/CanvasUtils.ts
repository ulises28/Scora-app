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
 * Sets letter spacing with a fallback for older browsers.
 */
export function setLetterSpacing(ctx: any, spacing: string) {
    if (typeof ctx.letterSpacing !== 'undefined') {
        ctx.letterSpacing = spacing;
    }
}
