// @vitest-environment jsdom
/**
 * Metric composition eval (code detector) — impossible value+unit patterns.
 *
 * Contract: a metric is VALUE + UNIT + LABEL (e.g. 10 + km + Distance).
 * Production formatters EMBED units in values (formatPace → "4:09 /km",
 * formatDuration → "1h 12m", formatSpeedKmh → "25.5 km/h", HR → "167 bpm"),
 * so renderers that also append a unit produce impossible doubles:
 *   "4:09 /km" + "/km"  → "/km /km"     (wavy_quote bug)
 *   "1h 12m"  + "min"   → "1h 12m min"
 *   "167 bpm" + "bpm"   → "bpm bpm"
 * These can NEVER appear in a render. This eval renders every sticker with
 * production-shaped (compound) stats, captures every fillText, and flags
 * doubled units in single strings, value/units drawn side-by-side whose value
 * already ends with that unit, and char-run ribbons (wavy_quote draws per-char).
 */
import { describe, it, expect } from 'vitest';
import { STICKER_REGISTRY } from '../../src/features/editor/StickerRegistry';

interface DrawnText {
    text: string;
    x: number;
    y: number;
    width: number;
    left: number;
}

function createCaptureCtx(canvasW = 1080, canvasH = 1920, shared?: DrawnText[]) {
    const drawn: DrawnText[] = shared ?? [];
    let font = '500 40px sans-serif';
    let tx = 0, ty = 0, sx = 1, sy = 1;
    const stack: { tx: number; ty: number; sx: number; sy: number }[] = [];

    const fontSize = () => {
        const m = /(\d+(?:\.\d+)?)px/.exec(font);
        return m ? parseFloat(m[1]) : 16;
    };
    const measure = (s: string) => s.length * fontSize() * 0.52;

    const noop = () => undefined;
    const ctx: any = {
        canvas: { width: canvasW, height: canvasH },
        get font() { return font; },
        set font(v: string) { font = v; },
        fillStyle: '', strokeStyle: '', lineWidth: 1, lineCap: 'butt', lineJoin: 'miter',
        textAlign: 'start', textBaseline: 'alphabetic', globalAlpha: 1,
        globalCompositeOperation: 'source-over', filter: '',
        shadowBlur: 0, shadowColor: '', shadowOffsetX: 0, shadowOffsetY: 0,
        letterSpacing: '0px', wordSpacing: '0px', direction: 'ltr',
        fillText(text: any, x = 0, y = 0) {
            const s = String(text);
            const w = measure(s) * sx;
            const ex = x * sx + tx;
            // Box left edge depends on alignment — pair checks need true edges
            const align = ctx.textAlign;
            const left = align === 'center' ? ex - w / 2 : align === 'right' ? ex - w : ex;
            drawn.push({ text: s, x: ex, y: y * sy + ty, width: w, left });
        },
        strokeText: noop,
        measureText(t: any) {
            const s = String(t);
            return {
                width: measure(s),
                actualBoundingBoxAscent: fontSize() * 0.75,
                actualBoundingBoxDescent: fontSize() * 0.25,
                fontBoundingBoxAscent: fontSize() * 0.8,
                fontBoundingBoxDescent: fontSize() * 0.2,
            };
        },
        fillRect: noop, strokeRect: noop, clearRect: noop, roundRect: noop,
        beginPath: noop, closePath: noop, moveTo: noop, lineTo: noop,
        bezierCurveTo: noop, quadraticCurveTo: noop, arc: noop, arcTo: noop,
        ellipse: noop, rect: noop, fill: noop, stroke: noop, clip: noop,
        rotate: noop,
        translate(x: number, y: number) { tx += x * sx; ty += y * sy; },
        scale(x: number, y: number) { sx *= x; sy *= y; },
        transform: noop,
        setTransform(a: number, _b: number, _c: number, d: number, e: number, f: number) {
            sx = a || 1; sy = d || 1; tx = e || 0; ty = f || 0;
        },
        resetTransform() { tx = 0; ty = 0; sx = 1; sy = 1; },
        getTransform: () => ({ a: sx, b: 0, c: 0, d: sy, e: tx, f: ty }),
        save() { stack.push({ tx, ty, sx, sy }); },
        restore() {
            const s = stack.pop();
            if (s) { tx = s.tx; ty = s.ty; sx = s.sx; sy = s.sy; }
        },
        createLinearGradient: () => ({ addColorStop: noop }),
        createRadialGradient: () => ({ addColorStop: noop }),
        createPattern: () => ({}),
        createImageData: () => ({ data: new Uint8ClampedArray(4) }),
        getImageData: () => ({ data: new Uint8ClampedArray(canvasW * canvasH * 4) }),
        putImageData: noop, drawImage: noop, setLineDash: noop,
        getLineDash: () => [],
        isPointInPath: () => false,
    };
    return { ctx, drawn };
}

// ─── Impossible patterns ─────────────────────────────────────────────────────
const UNIT_LIKE = /^(?:\/km|km\/h|\/100m|km|mi|m|min|mins|bpm|spm|kcal|%)$/i;

const SINGLE_STRING_PATTERNS: { name: string; re: RegExp }[] = [
    { name: 'doubled "/km"', re: /(\/\s*km)\s*[·,\/]?\s*\/?\s*km\b/i },
    { name: 'doubled "km/h"', re: /(km\s*\/\s*h)\s*[·,]?\s*km\s*\/\s*h/i },
    { name: 'doubled unit word', re: /\b(km|mi|m|min|bpm|spm|kcal)\s+\1\b/i },
    { name: 'time value + time unit', re: /\b\d+\s*(?:h\s*\d*\s*)?(?:min|m)\s+(?:min|m)\b/i },
];

function findStringViolations(text: string, where: string): string[] {
    const out: string[] = [];
    for (const p of SINGLE_STRING_PATTERNS) {
        if (p.re.test(text)) out.push(`${where}: ${p.name} in "${text}"`);
    }
    return out;
}

/** Value drawn beside a unit it already carries ("4:09 /km" + "/km", "1h 12m" + "min").
 *  Exact-token + time synonyms only — km-family (/km vs km) is too ambiguous
 *  across multi-column rows (stat-compact draws "KM" and "/KM" side by side). */
function valueHasUnit(value: string, unit: string): boolean {
    const v = value.trim().toLowerCase();
    const u = unit.trim().toLowerCase();
    if (!v || !u || v === u) return false;
    if (v.endsWith(u)) {
        const head = v.slice(0, v.length - u.length);
        if (!head.trim() || /[\s·,:;]$/.test(head) || !/^[a-z0-9]/.test(u)) return true;
    }
    // time synonyms: "1h 12m"/"41m" already time-valued, "min"/"m"/"h" appended
    if (/^(min|mins|m|h|hr|hrs)$/.test(u) && /\d\s*(h|m|min)\b/.test(v)) return true;
    return false;
}

function findPairViolations(drawn: DrawnText[]): string[] {
    const out: string[] = [];
    for (const a of drawn) {
        const at = a.text.trim();
        if (!at || at.length < 2) continue;
        for (const b of drawn) {
            if (a === b) continue;
            const bt = b.text.trim();
            if (!UNIT_LIKE.test(bt)) continue;
            // Same metric row: same baseline, unit right of the value
            if (Math.abs(a.y - b.y) > 4) continue;
            const gap = b.left - (a.left + a.width);
            if (gap < -20 || gap > 220) continue;
            if (valueHasUnit(at, bt)) {
                out.push(`value "${a.text}" already carries unit "${b.text}" drawn beside it (y≈${Math.round(a.y)})`);
            }
        }
    }
    return out;
}

/** wavy_quote draws ribbon text one char at a time — rebuild contiguous runs. */
function findCharRunViolations(drawn: DrawnText[]): string[] {
    const runs: { text: string; where: string }[] = [];
    let cur = '';
    for (const d of drawn) {
        if (d.text.length === 1) cur += d.text;
        else {
            if (cur.length > 3) runs.push({ text: cur, where: 'char-run' });
            cur = '';
        }
    }
    if (cur.length > 3) runs.push({ text: cur, where: 'char-run' });
    return runs.flatMap(r => findStringViolations(r.text, r.where));
}

// ─── Production-shaped fixtures (compound values, as the formatters emit) ────
const TINY_POLYLINE = 'yhpuBrtl|QZWr@[NKRIP]@MEEg@Ko@Ck@GkAIkJ{@a@BmGg@OCKEKU?_@F]TeDj@wFPeCP{Al@aHvAwQNkAViEz@yIb@mGRmBLkBR{Dd@qFBmAG}@Kq@eByEs@eBWaA[w@Qk@{@oBOs@MeAEOa@g@m@eAmDuJUc@[u@c@yAMMC@?FF\\v@dB~CvId@hALd@VfBJP\\`@T`@jAdDdAfCRr@dAnCt@fBHZFd@J|@?`@q@pHIh@KnAQrAIbAEjAKj@Y`DKTMFWB}CWe@?i@DsARuBp@wAp@_Az@g@j@u@jAYt@Qx@ObB@pBD|@Ht@f@lDP~@`@pAdBfFvAnI`@lBh@hBNb@@';

const runStats = {
    title: 'Lululemon 10k', shortTitle: 'Lululemon 10k',
    type: 'Run', activityType: 'Run', hasDistance: true, hasMap: true,
    polyline: TINY_POLYLINE,
    distanceVal: '10.05', distanceUnit: 'km',
    mainValue: '10.05 km', mainLabel: 'Distance',
    // formatPace() output — unit EMBEDDED in value (real data shape)
    subValue: '4:09 /km', subLabel: '/km',
    // formatDuration() output — unit EMBEDDED in value (real data shape)
    timeStr: '1h 12m', movingTime: '1h 12m',
    startTime: '6:04 AM', date: 'March 29, 2026', dayName: 'Sunday', dayAndNumber: 'Sun 29',
    location: 'Miguel Hidalgo', region: 'CDMX',
    avgHeartrate: 167, maxHeartrate: 177, hr: 167,
    elevation: '36', calories: '1068', avgTemp: '17',
    dataPoints: [
        { label: 'Distance', value: '10.05', unit: 'km' },
        { label: 'Pace', value: '4:09 /km', unit: '/km' },
        { label: 'Duration', value: '1h 12m', unit: 'min' },
        { label: 'Elevation', value: '36', unit: 'm' },
        { label: 'Time', value: '6:04 AM', unit: '' },
    ],
};

const workoutStats = {
    title: 'HIIT matutino', shortTitle: 'HIIT matutino',
    type: 'Workout', activityType: 'Workout', hasDistance: false, hasMap: false, polyline: '',
    mainValue: '1h 12m', mainLabel: 'Duration',
    // strava.ts HR fallback shape — unit EMBEDDED, subLabel is a label
    subValue: '167 bpm', subLabel: 'Avg Heartrate',
    timeStr: '1h 12m', movingTime: '1h 12m',
    startTime: '8:10 AM', date: 'March 21, 2026', dayName: 'Saturday', dayAndNumber: 'Sat 21',
    location: 'Cuauhtémoc', region: 'CDMX',
    avgHeartrate: 167, maxHeartrate: 177, hr: 167,
    calories: null, avgTemp: null,
    dataPoints: [
        { label: 'Duration', value: '1h 12m', unit: 'min' },
        { label: 'Heart Rate', value: '167 bpm', unit: 'bpm' },
        { label: 'Time', value: '8:10 AM', unit: '' },
    ],
};

const bikeStats = {
    ...runStats,
    type: 'Ride', activityType: 'Ride',
    // formatSpeedKmh() output — unit EMBEDDED in value
    subValue: '25.5 km/h', subLabel: 'km/h',
};

// formatSwimPace() output — unit EMBEDDED ("/100m" doubling class)
const swimStats = {
    ...runStats,
    type: 'Swim', activityType: 'Swim',
    subValue: '1:30 /100m', subLabel: '/100m',
    distanceVal: '1.50', distanceUnit: 'km',
    mainValue: '1.50 km',
};

// User-reported shapes: spelled duration + no-space pace compound
const spelledDurationStats = {
    ...runStats,
    type: 'Run',
    timeStr: '1h 12min', movingTime: '1h 12min',
    mainValue: '1h 12min', mainLabel: 'Time',
    subValue: '4:09/km', subLabel: '/km',
    dataPoints: [
        { label: 'Distance', value: '10.05', unit: 'km' },
        { label: 'Pace', value: '4:09/km', unit: '/km' },
        { label: 'Duration', value: '1h 12min', unit: 'min' },
        { label: 'Time', value: '6:04 AM', unit: '' },
    ],
};

// Bare "45min" / "45 min" compact durations (value carries its unit)
const compactDurationStats = {
    ...workoutStats,
    timeStr: '45min', movingTime: '45min',
    mainValue: '45min', mainLabel: 'Time',
    dataPoints: [
        { label: 'Duration', value: '45min', unit: 'min' },
        { label: 'Heart Rate', value: '167 bpm', unit: 'bpm' },
    ],
};

const FIXTURES: { name: string; stats: any }[] = [
    { name: 'run', stats: runStats },
    { name: 'workout', stats: workoutStats },
    { name: 'bike', stats: bikeStats },
    { name: 'swim', stats: swimStats },
    { name: 'spelled-duration', stats: spelledDurationStats },
    { name: 'compact-duration', stats: compactDurationStats },
];

describe('Metric composition eval: impossible value+unit patterns', () => {
    const stickers = Object.values(STICKER_REGISTRY);

    it('registry has stickers to evaluate', () => {
        expect(stickers.length).toBeGreaterThan(20);
    });

    it.each(FIXTURES.map(f => [f.name] as const))(
        'no doubled units / value-contains-unit in any sticker render (%s)',
        (fixtureName) => {
            const fixture = FIXTURES.find(f => f.name === fixtureName)!;
            const violations: string[] = [];

            // Glass/co-renderers build offscreen canvases via document.createElement —
            // route those contexts into the same capture buffer.
            const proto = HTMLCanvasElement.prototype as any;
            const origGetContext = proto.getContext;

            for (const sticker of stickers) {
                const drawn: DrawnText[] = [];
                proto.getContext = function (this: HTMLCanvasElement) {
                    return createCaptureCtx(this.width || 1080, this.height || 1920, drawn).ctx;
                };
                const { ctx } = createCaptureCtx(1080, 1920, drawn);
                try {
                    sticker.render(ctx, fixture.stats, 'white', true);
                } catch (e) {
                    // Render crash is covered by sticker-integrity; note and continue.
                    violations.push(`[${sticker.id}] render crashed: ${(e as Error).message}`);
                    continue;
                } finally {
                    proto.getContext = origGetContext;
                }

                for (const d of drawn) {
                    violations.push(...findStringViolations(d.text, `[${sticker.id}] text`));
                }
                violations.push(...findPairViolations(drawn).map(v => `[${sticker.id}] ${v}`));
                violations.push(...findCharRunViolations(drawn).map(v => `[${sticker.id}] ${v}`));
            }

            expect(violations, `Impossible metric composition patterns:\n${violations.join('\n')}`).toEqual([]);
        }
    );
});
