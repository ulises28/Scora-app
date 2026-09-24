// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { drawGlassNumbers, drawGlassNumbersV2 } from '../../src/features/editor/CanvasPainter';
import { drawLiquidGlyphs, drawGlassText, glassSsaa, paintContinuousRim } from '../../src/features/editor/GlassText';

/**
 * Safari glass buffer budget.
 *
 * Compensated Faux-Stroke allocates several full-size offscreens per glyph.
 * On thumbs those buffers used to stay story-sized (SSAA 3 × font 1100) and
 * were never released — Safari "significant memory" reload.
 *
 * Contract:
 *  1. Thumb draws stay under a tight peak-pixel budget.
 *  2. Temp glass canvases are released (width → 0) after composite.
 *  3. Main preview keeps the dense CFS rim (256-step orbit + micro-blur).
 *  4. Thumb draws use a cheaper rim orbit than main.
 */

type Tracked = {
    canvas: HTMLCanvasElement;
    peak: number;
};

const runStats = {
    hasDistance: true,
    distanceVal: '10.05',
    distanceUnit: 'km',
    timeStr: '41m',
    rawDate: '2026-03-22T10:00:00Z',
    dayNumber: 1,
};

const workoutStats = {
    hasDistance: false,
    timeStr: '52m',
    rawDate: '2026-03-21T08:00:00Z',
    dayNumber: 1,
};

function installCanvasTracker() {
    const created: HTMLCanvasElement[] = [];
    let livePixels = 0;
    let peakPixels = 0;
    let fillTextCount = 0;
    let blurFilterSets = 0;

    const origCreate = document.createElement.bind(document);
    const track = (c: HTMLCanvasElement) => {
        created.push(c);
        let w = c.width;
        let h = c.height;
        const recompute = () => {
            // Rebuild live total from all tracked canvases
            livePixels = 0;
            for (const el of created) {
                livePixels += (el.width || 0) * (el.height || 0);
            }
            if (livePixels > peakPixels) peakPixels = livePixels;
        };
        Object.defineProperty(c, 'width', {
            configurable: true,
            get: () => w,
            set: (v: number) => {
                w = v | 0;
                recompute();
            },
        });
        Object.defineProperty(c, 'height', {
            configurable: true,
            get: () => h,
            set: (v: number) => {
                h = v | 0;
                recompute();
            },
        });
        recompute();
        return c;
    };

    document.createElement = ((tag: string, options?: any) => {
        const el = origCreate(tag, options);
        if (String(tag).toLowerCase() === 'canvas') track(el as HTMLCanvasElement);
        return el;
    }) as typeof document.createElement;

    const origGet = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, kind: string) {
        const ctx = origGet.call(this, kind as any) as any;
        if (!ctx || kind !== '2d') return ctx;
        if (!ctx.__budgetWrapped) {
            const origFillText = ctx.fillText?.bind(ctx);
            ctx.fillText = (...args: any[]) => {
                fillTextCount += 1;
                return origFillText?.(...args);
            };
            let filterValue = 'none';
            Object.defineProperty(ctx, 'filter', {
                configurable: true,
                get: () => filterValue,
                set: (v: string) => {
                    filterValue = v;
                    if (typeof v === 'string' && v.includes('blur')) blurFilterSets += 1;
                },
            });
            ctx.__budgetWrapped = true;
        }
        return ctx;
    } as any;

    return {
        created,
        get peakPixels() {
            return peakPixels;
        },
        get fillTextCount() {
            return fillTextCount;
        },
        get blurFilterSets() {
            return blurFilterSets;
        },
        resetCounters() {
            fillTextCount = 0;
            blurFilterSets = 0;
            peakPixels = 0;
            livePixels = 0;
            for (const el of created) {
                // ignore dest; only temps get released
            }
        },
        restore() {
            document.createElement = origCreate;
            HTMLCanvasElement.prototype.getContext = origGet;
        },
        tempCanvases(dest: HTMLCanvasElement) {
            return created.filter(c => c !== dest);
        },
    };
}

function makeCanvas(w: number, h: number): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.id = w <= 640 ? 'grid-canvas-test' : 'storyCanvas';
    c.width = w;
    c.height = h;
    return c;
}

describe('glass buffer budget (Safari P0)', () => {
    let tracker: ReturnType<typeof installCanvasTracker>;

    beforeEach(() => {
        tracker = installCanvasTracker();
    });

    afterEach(() => {
        tracker.restore();
    });

    it('releases temp glass canvases after drawGlassNumbers', () => {
        const dest = makeCanvas(1080, 1920);
        const ctx = dest.getContext('2d')!;
        drawGlassNumbers(ctx, runStats, 'white');
        const temps = tracker.tempCanvases(dest);
        expect(temps.length).toBeGreaterThan(0);
        for (const t of temps) {
            expect(t.width * t.height).toBe(0);
        }
    });

    it('releases temp glass canvases after drawLiquidGlyphs', () => {
        const dest = makeCanvas(1080, 1920);
        const ctx = dest.getContext('2d')!;
        drawLiquidGlyphs(ctx, {
            text: '10.05',
            x: 540,
            y: 780,
            fontFamily: 'Outfit',
            fontWeight: '300',
            fontSize: 520,
            fill: 'rgba(255,255,255,0.92)',
        });
        const temps = tracker.tempCanvases(dest);
        expect(temps.length).toBeGreaterThan(0);
        for (const t of temps) {
            expect(t.width * t.height).toBe(0);
        }
    });

    it('thumb glass-numbers peak pixels stay far below main', () => {
        const thumb = makeCanvas(180, 320);
        drawGlassNumbers(thumb.getContext('2d')!, runStats, 'white');
        const thumbPeak = tracker.peakPixels;
        const thumbFills = tracker.fillTextCount;

        tracker.restore();
        tracker = installCanvasTracker();
        const main = makeCanvas(1080, 1920);
        drawGlassNumbers(main.getContext('2d')!, runStats, 'white');
        const mainPeak = tracker.peakPixels;

        expect(thumbPeak).toBeGreaterThan(0);
        expect(mainPeak).toBeGreaterThan(0);
        // Thumbs must not allocate story-scale multi-buffer stacks
        expect(thumbPeak).toBeLessThan(mainPeak * 0.45);
        expect(thumbFills).toBeLessThan(120);
    });

    it('glass quality tier: thumbs use SSAA 1, main SSAA 2', () => {
        expect(glassSsaa({ canvas: { width: 1080 } } as CanvasRenderingContext2D)).toBe(2);
        expect(glassSsaa({ canvas: { width: 180 } } as CanvasRenderingContext2D)).toBe(1);
    });

    it('main glass-numbers paints continuous rim via blur (no 256-orbit)', () => {
        const main = makeCanvas(1080, 1920);
        expect(main.width).toBe(1080);
        const ctx = main.getContext('2d')!;
        expect(ctx.canvas?.width).toBe(1080);
        drawGlassNumbers(ctx, runStats, 'white');
        // Continuous rim + bevel micro-blur — O(1) fills, not 256 anisotropic orbits
        expect(tracker.blurFilterSets).toBeGreaterThan(0);
        expect(tracker.fillTextCount).toBeLessThan(80);
        expect(tracker.fillTextCount).toBeGreaterThan(4);
    });

    it('main glass-numbers-v2 paints continuous rim via blur (no 256-orbit)', () => {
        const main = makeCanvas(1080, 1920);
        expect(main.width).toBe(1080);
        const ctx = main.getContext('2d')!;
        expect(ctx.canvas?.width).toBe(1080);
        drawGlassNumbersV2(ctx, workoutStats, 'white');
        expect(tracker.blurFilterSets).toBeGreaterThan(0);
        expect(tracker.fillTextCount).toBeLessThan(80);
        expect(tracker.fillTextCount).toBeGreaterThan(4);
    });

    it('paintContinuousRim cuts interior after blur dilate', () => {
        const c = document.createElement('canvas');
        c.width = 200;
        c.height = 100;
        const ctx = c.getContext('2d')!;
        paintContinuousRim(ctx, '8', 100, 50, 'white', 4);
        expect(tracker.blurFilterSets).toBeGreaterThan(0);
    });

    it('thumb drawGlassText does not scan dest with getImageData', () => {
        const thumb = makeCanvas(180, 320);
        const ctx = thumb.getContext('2d')!;
        const spy = vi.spyOn(ctx, 'getImageData');
        drawGlassText(ctx, {
            text: '11:11',
            x: 90,
            y: 160,
            fontFamily: 'Outfit',
            fontWeight: '300',
            fontSize: 80,
            aspectScaleX: 0.9,
            color: { r: 255, g: 255, b: 255 },
        });
        expect(spy).not.toHaveBeenCalled();
    });
});
