/**
 * Light frosted liquid glass — iOS lock-screen `11:11` / glassmorphism.
 *
 * Target look (user refs):
 * - Slim pearlescent glass digits (lock-screen clock over photo)
 * - What's behind is veiled/blurred so type stays readable
 * - CLEAR light material only — never black-in-white
 *
 * CRITICAL: never call strokeText (fills counters of 0/4/5/6/8/9).
 * CRITICAL: never fillText under anisotropic scale (Skia winding bug on '4').
 * All layers paint on a 1:1 offscreen buffer, then composite once with
 * horizontal aspect scale applied at drawImage time.
 */

/** Safari kills tabs that hold too many large canvases — cap glass buffers. */
function glassSsaa(ctx: CanvasRenderingContext2D, fontSize: number): number {
    const thumb = ctx.canvas.width <= 640;
    if (thumb) return 1;
    if (fontSize > 800) return 2;
    return 2;
}

function releaseCanvas(c: HTMLCanvasElement): void {
    c.width = 0;
    c.height = 0;
}

export interface GlassTextColor {
    r: number;
    g: number;
    b: number;
}

export interface GlassTextOptions {
    text: string;
    x: number;
    y: number;
    fontFamily: string;
    fontWeight: string;
    fontSize: number;
    /** Horizontal visual squish (e.g. 0.22). NEVER applied to fillText. */
    aspectScaleX: number;
    color: GlassTextColor;
}

const SSAA = 3;
const PAD = 80;

/**
 * Samples dest under the glyph rect, blurs it, and composites it **inside the
 * glyph mask** — the iOS lock-screen "backdrop blur" so type stays readable.
 * No-op when dest is empty (pure transparent sticker export).
 */
function frostBackdropUnder(
    dest: CanvasRenderingContext2D,
    destX: number,
    destY: number,
    destW: number,
    destH: number,
    glyphMask: HTMLCanvasElement,
    blurPx = 18
): void {
    // Thumbs / empty story frames: skip getImageData (Safari memory + CPU)
    if (dest.canvas.width <= 640) return;
    const ix = Math.max(0, Math.floor(destX));
    const iy = Math.max(0, Math.floor(destY));
    const iw = Math.min(Math.ceil(destW), dest.canvas.width - ix);
    const ih = Math.min(Math.ceil(destH), dest.canvas.height - iy);
    if (iw <= 0 || ih <= 0) return;

    let snap: ImageData;
    try {
        snap = dest.getImageData(ix, iy, iw, ih);
    } catch {
        return;
    }
    let hasInk = false;
    for (let i = 3; i < snap.data.length; i += 4) {
        if (snap.data[i] > 4) { hasInk = true; break; }
    }
    if (!hasInk) return;

    // Blur the backdrop snapshot
    const raw = document.createElement('canvas');
    raw.width = iw;
    raw.height = ih;
    const rc = raw.getContext('2d');
    if (!rc) return;
    rc.putImageData(snap, 0, 0);

    const blurred = document.createElement('canvas');
    blurred.width = iw;
    blurred.height = ih;
    const bc = blurred.getContext('2d');
    if (!bc) return;
    if ('filter' in bc) (bc as CanvasRenderingContext2D).filter = `blur(${blurPx}px)`;
    bc.drawImage(raw, 0, 0);
    if ('filter' in bc) (bc as CanvasRenderingContext2D).filter = 'none';

    // Clip blurred photo to glyph shape (mask alpha)
    const masked = document.createElement('canvas');
    masked.width = iw;
    masked.height = ih;
    const mc = masked.getContext('2d');
    if (!mc) return;
    // glyphMask is 1:1 (bufW×bufH); dest is aspect-squished — stretch mask to dest size
    mc.drawImage(glyphMask, 0, 0, glyphMask.width, glyphMask.height, 0, 0, iw, ih);
    mc.globalCompositeOperation = 'source-in';
    mc.drawImage(blurred, 0, 0);
    // Soft white frost over the blurred photo (readability)
    mc.globalCompositeOperation = 'source-atop';
    mc.fillStyle = 'rgba(255, 255, 255, 0.22)';
    mc.fillRect(0, 0, iw, ih);

    dest.save();
    dest.drawImage(masked, ix, iy);
    dest.restore();
}

/** Lift toward white — keeps glass clear/pearl, never black. */
function lift(color: GlassTextColor, t: number): GlassTextColor {
    return {
        r: Math.round(color.r + (255 - color.r) * t),
        g: Math.round(color.g + (255 - color.g) * t),
        b: Math.round(color.b + (255 - color.b) * t),
    };
}

/**
 * Draws slim frosted glass text (iOS lock-screen `11:11`) centered at (x, y).
 * Transparent-export safe: dense frost veils the Story photo (soft blur for
 * readability) while still letting photo color tint through.
 */
export function drawGlassText(ctx: CanvasRenderingContext2D, opts: GlassTextOptions): void {
    const { text, x, y, fontFamily, fontWeight, fontSize, aspectScaleX, color } = opts;
    if (!text) return;

    // Thumb fast path — multi-canvas glass is story-sized (Safari P0)
    if (ctx.canvas.width <= 640) {
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(aspectScaleX, 1);
        ctx.font = `${fontWeight} ${fontSize}px '${fontFamily}', sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.fillText(text, 0, 0);
        ctx.restore();
        return;
    }

    // Pearl / clear glass palette — always light (user: no black-in-white)
    // Slight warm cream cast like the iOS 11:11 lock-screen slab
    const tint = lift({ r: color.r, g: color.g, b: Math.min(255, color.b + 8) }, 0.50);
    const pearl = lift({ r: Math.min(255, color.r + 6), g: color.g, b: color.b }, 0.84);
    const softEdge = lift(color, 0.22);

    const font = `${fontWeight} ${fontSize}px '${fontFamily}', sans-serif`;

    const meas = document.createElement('canvas').getContext('2d');
    if (!meas) return;
    meas.font = font;
    const tm = meas.measureText(text);
    const ascent = tm.actualBoundingBoxAscent || fontSize * 0.72;
    const descent = tm.actualBoundingBoxDescent || fontSize * 0.08;
    const naturalW = Math.ceil(tm.width);
    const naturalH = Math.ceil(ascent + descent + 40);
    const halfH = (ascent + descent) / 2;

    const bufW = naturalW + PAD * 2;
    const bufH = naturalH;
    const off = document.createElement('canvas');
    off.width = bufW * SSAA;
    off.height = bufH * SSAA;
    const gc = off.getContext('2d');
    if (!gc) return;

    gc.scale(SSAA, SSAA);
    gc.font = font;
    gc.textAlign = 'center';
    gc.textBaseline = 'alphabetic';
    const cx = bufW / 2;
    const cy = PAD / 2 + ascent;

    // ── Slab extrusion depth (11:11 acrylic thickness) ──
    // Offset fills create a frosted-glass side wall without strokeText
    gc.save();
    for (let d = 6; d >= 1; d--) {
        const a = 0.06 + d * 0.02;
        gc.fillStyle = `rgba(${softEdge.r}, ${softEdge.g}, ${softEdge.b}, ${a})`;
        gc.fillText(text, cx + d * 0.8, cy + d * 1.4);
    }
    gc.restore();

    // ── Soft outer frost bloom (glass thickness, clear) ──
    gc.save();
    gc.shadowColor = `rgba(${pearl.r}, ${pearl.g}, ${pearl.b}, 0.50)`;
    gc.shadowBlur = 24;
    gc.shadowOffsetX = 0;
    gc.shadowOffsetY = 0;
    gc.fillStyle = `rgba(${pearl.r}, ${pearl.g}, ${pearl.b}, 0.22)`;
    gc.fillText(text, cx, cy);
    gc.restore();

    // ── Soft ground (light warm gray — NOT black) ──
    gc.save();
    gc.shadowColor = `rgba(${softEdge.r}, ${softEdge.g}, ${softEdge.b}, 0.32)`;
    gc.shadowBlur = 8;
    gc.shadowOffsetX = 0;
    gc.shadowOffsetY = 5;
    gc.fillStyle = 'rgba(255, 255, 255, 0.04)';
    gc.fillText(text, cx, cy);
    gc.restore();

    // ── Crystal body: solid frosted acrylic slab (iOS 11:11) ──
    // Dense pearl fill so digits have real presence (not hollow outlines);
    // still translucent enough for photo color to tint through. Never black.
    gc.shadowColor = 'transparent';
    gc.shadowBlur = 0;
    gc.shadowOffsetX = 0;
    gc.shadowOffsetY = 0;
    const topY = cy - ascent;
    const botY = cy + descent;
    const glassFill = gc.createLinearGradient(0, topY, 0, botY);
    glassFill.addColorStop(0.00, 'rgba(255, 255, 255, 0.96)');
    glassFill.addColorStop(0.22, `rgba(${pearl.r}, ${pearl.g}, ${pearl.b}, 0.88)`);
    glassFill.addColorStop(0.50, `rgba(${tint.r}, ${tint.g}, ${tint.b}, 0.72)`);
    glassFill.addColorStop(0.78, `rgba(${tint.r}, ${tint.g}, ${tint.b}, 0.78)`);
    glassFill.addColorStop(1.00, `rgba(${pearl.r}, ${pearl.g}, ${pearl.b}, 0.90)`);
    gc.fillStyle = glassFill;
    gc.fillText(text, cx, cy);

    // ── −45° soft sheen (clear light — never black) ──
    gc.globalCompositeOperation = 'source-atop';
    const glareGrad = gc.createLinearGradient(
        cx - ascent * 0.85, topY,
        cx + ascent * 0.85, botY
    );
    glareGrad.addColorStop(0.00, 'rgba(255, 255, 255, 0.55)');
    glareGrad.addColorStop(0.25, 'rgba(255, 255, 255, 0.20)');
    glareGrad.addColorStop(0.55, 'rgba(255, 255, 255, 0.02)');
    glareGrad.addColorStop(0.82, `rgba(${softEdge.r}, ${softEdge.g}, ${softEdge.b}, 0.08)`);
    glareGrad.addColorStop(1.00, `rgba(${softEdge.r}, ${softEdge.g}, ${softEdge.b}, 0.16)`);
    gc.fillStyle = glareGrad;
    gc.fillRect(0, 0, bufW, bufH);

    // ── Slab edge light (11:11 acrylic depth): bright left, soft right ──
    const edge = gc.createLinearGradient(cx - naturalW * 0.35, 0, cx + naturalW * 0.35, 0);
    edge.addColorStop(0.00, 'rgba(255, 255, 255, 0.42)');
    edge.addColorStop(0.16, 'rgba(255, 255, 255, 0.10)');
    edge.addColorStop(0.55, 'rgba(255, 255, 255, 0.00)');
    edge.addColorStop(0.85, `rgba(${softEdge.r}, ${softEdge.g}, ${softEdge.b}, 0.06)`);
    edge.addColorStop(1.00, `rgba(${softEdge.r}, ${softEdge.g}, ${softEdge.b}, 0.14)`);
    gc.fillStyle = edge;
    gc.fillRect(0, 0, bufW, bufH);

    // ── Top specular glint (slab highlight) ──
    const glint = gc.createLinearGradient(0, topY, 0, topY + ascent * 0.35);
    glint.addColorStop(0, 'rgba(255, 255, 255, 0.35)');
    glint.addColorStop(1, 'rgba(255, 255, 255, 0)');
    gc.fillStyle = glint;
    gc.fillRect(0, 0, bufW, bufH);

    // ── Top-edge glint ──
    gc.globalCompositeOperation = 'source-over';
    gc.shadowColor = 'rgba(255, 255, 255, 0.85)';
    gc.shadowBlur = 8;
    gc.shadowOffsetX = 0;
    gc.shadowOffsetY = -2;
    gc.fillStyle = 'rgba(255, 255, 255, 0.22)';
    gc.fillText(text, cx, cy);

    gc.shadowColor = 'transparent';
    gc.shadowBlur = 0;
    gc.shadowOffsetY = 0;

    // Composite once: 1:1 glyphs → horizontal aspect squish (Skia-safe)
    // Place so the glyph visual center lands on (x, y)
    const destW = bufW * aspectScaleX;
    const destH = bufH;
    const destX = x - destW / 2;
    const destY = y - (PAD / 2 + halfH);

    // Build a pure glyph alpha mask (white text on transparent) for backdrop blur
    const mask = document.createElement('canvas');
    mask.width = bufW * SSAA;
    mask.height = bufH * SSAA;
    const mk = mask.getContext('2d');
    if (mk) {
        mk.scale(SSAA, SSAA);
        mk.font = font;
        mk.textAlign = 'center';
        mk.textBaseline = 'alphabetic';
        mk.fillStyle = '#ffffff';
        mk.fillText(text, cx, cy);
        frostBackdropUnder(ctx, destX, destY, destW, destH, mask, 18);
    }

    ctx.drawImage(off, destX, destY, destW, destH);
}

export interface GlassPanelOptions {
    x: number;
    y: number;
    w: number;
    h: number;
    radius: number;
    /** Warm orange/beige glassmorphism (glass-numbers-v2). Default: neutral clear. */
    warm?: boolean;
}

export interface LiquidGlyphOptions {
    text: string;
    x: number;
    y: number;
    fontFamily: string;
    fontWeight: string;
    fontSize: number;
    /** Fill ink for the glyph face (e.g. warm cream). */
    fill: string;
}

/**
 * Liquid-glass letterforms — Compensated Faux-Stroke pipeline (same as v1 glass-numbers).
 * Proven glass look: dense liquid core + glowing rim + specular/shadow bevels.
 * Zero strokeText. Optional horizontal aspect squash at composite time.
 */
export function drawLiquidGlyphs(ctx: CanvasRenderingContext2D, opts: LiquidGlyphOptions & { aspectScaleX?: number }): void {
    const { text, x, y, fontFamily, fontWeight, fontSize, aspectScaleX = 1 } = opts;
    if (!text) return;

    // Thumb fast path
    if (ctx.canvas.width <= 640) {
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(aspectScaleX, 1);
        ctx.font = `${fontWeight} ${fontSize}px '${fontFamily}', sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.fillText(text, 0, 0);
        ctx.restore();
        return;
    }

    const font = `${fontWeight} ${fontSize}px '${fontFamily}', sans-serif`;
    const meas = document.createElement('canvas').getContext('2d');
    if (!meas) return;
    meas.font = font;
    const textMetrics = meas.measureText(text);

    const padding = 120;
    const unscaledW = Math.ceil(textMetrics.width) + padding * 2;
    const unscaledH = Math.ceil(fontSize * 1.5);
    const SSAA = Math.min(1, 1200 / Math.max(unscaledW * aspectScaleX, unscaledH, 1));
    const drawW = unscaledW * aspectScaleX;
    const drawH = unscaledH;

    const glassCanvas = document.createElement('canvas');
    glassCanvas.width = drawW * SSAA;
    glassCanvas.height = drawH * SSAA;
    const gc = glassCanvas.getContext('2d');
    if (!gc) return;

    gc.scale(SSAA * aspectScaleX, SSAA);
    const cx = unscaledW / 2;
    const cy = unscaledH / 2;
    const halfH = fontSize / 2;

    gc.font = font;
    gc.textAlign = 'center';
    gc.textBaseline = 'middle';

    const r = 255, g = 255, b = 255;
    const dr = 160, dg = 168, db = 180;
    const hr = 255, hg = 255, hb = 255;

    const createOuterRim = (colorOrGradient: string | CanvasGradient, visualLineWidth: number) => {
        const edgeCanvas = document.createElement('canvas');
        edgeCanvas.width = drawW * SSAA;
        edgeCanvas.height = drawH * SSAA;
        const ec = edgeCanvas.getContext('2d');
        if (!ec) return edgeCanvas;
        ec.scale(SSAA * aspectScaleX, SSAA);
        ec.font = font;
        ec.textAlign = 'center';
        ec.textBaseline = 'middle';
        ec.fillStyle = colorOrGradient;
        const steps = 48;
        for (let i = 0; i < steps; i++) {
            const angle = (i / steps) * Math.PI * 2;
            const dx = (Math.cos(angle) * visualLineWidth) / aspectScaleX;
            const dy = Math.sin(angle) * visualLineWidth;
            ec.fillText(text, cx + dx, cy + dy);
        }
        // Smooth continuous rim (no polygonal facets)
        const smooth = document.createElement('canvas');
        smooth.width = edgeCanvas.width;
        smooth.height = edgeCanvas.height;
        const sm = smooth.getContext('2d');
        if (sm) {
            if ('filter' in sm) (sm as CanvasRenderingContext2D).filter = 'blur(1.2px)';
            sm.drawImage(edgeCanvas, 0, 0);
            if ('filter' in sm) (sm as CanvasRenderingContext2D).filter = 'none';
            sm.scale(SSAA * aspectScaleX, SSAA);
            sm.font = font;
            sm.textAlign = 'center';
            sm.textBaseline = 'middle';
            sm.globalCompositeOperation = 'destination-out';
            sm.fillStyle = 'black';
            sm.fillText(text, cx, cy);
            return smooth;
        }
        ec.globalCompositeOperation = 'destination-out';
        ec.fillStyle = 'black';
        ec.fillText(text, cx, cy);
        return edgeCanvas;
    };

    const createBevel = (color: string | CanvasGradient, visualShiftX: number, visualShiftY: number) => {
        const edgeCanvas = document.createElement('canvas');
        edgeCanvas.width = drawW * SSAA;
        edgeCanvas.height = drawH * SSAA;
        const ec = edgeCanvas.getContext('2d');
        if (!ec) return edgeCanvas;
        ec.scale(SSAA * aspectScaleX, SSAA);
        ec.font = font;
        ec.textAlign = 'center';
        ec.textBaseline = 'middle';
        ec.fillStyle = color;
        const dx = visualShiftX / aspectScaleX;
        const dy = visualShiftY;
        ec.fillText(text, cx + dx, cy + dy);
        ec.globalCompositeOperation = 'destination-out';
        ec.fillText(text, cx, cy);
        const smooth = document.createElement('canvas');
        smooth.width = edgeCanvas.width;
        smooth.height = edgeCanvas.height;
        const sm = smooth.getContext('2d');
        if (sm) {
            if ('filter' in sm) (sm as CanvasRenderingContext2D).filter = 'blur(0.8px)';
            sm.drawImage(edgeCanvas, 0, 0);
            if ('filter' in sm) (sm as CanvasRenderingContext2D).filter = 'none';
            return smooth;
        }
        return edgeCanvas;
    };

    const composite1to1 = (canvas: HTMLCanvasElement) => {
        gc.save();
        gc.setTransform(1, 0, 0, 1, 0, 0);
        gc.drawImage(canvas, 0, 0);
        gc.restore();
    };

    // Layer 1: Caustic drop shadow
    const shadowCanvas = document.createElement('canvas');
    shadowCanvas.width = drawW * SSAA;
    shadowCanvas.height = drawH * SSAA;
    const sc = shadowCanvas.getContext('2d');
    if (sc) {
        sc.scale(SSAA * aspectScaleX, SSAA);
        sc.font = font;
        sc.textAlign = 'center';
        sc.textBaseline = 'middle';
        sc.shadowColor = `rgba(${hr}, ${hg}, ${hb}, 0.60)`;
        sc.shadowBlur = 12;
        sc.shadowOffsetY = 4;
        sc.fillStyle = `rgba(${r}, ${g}, ${b}, 1.0)`;
        sc.fillText(text, cx, cy);
        sc.globalCompositeOperation = 'destination-out';
        sc.fillText(text, cx, cy);
        composite1to1(shadowCanvas);
    }

    // Layer 2: Dense liquid core (translucent so photo tints through)
    const glassFill = gc.createLinearGradient(0, cy - halfH, 0, cy + halfH);
    glassFill.addColorStop(0.00, `rgba(255, 255, 255, 0.55)`);
    glassFill.addColorStop(0.40, `rgba(${r}, ${g}, ${b}, 0.28)`);
    glassFill.addColorStop(1.00, `rgba(${dr}, ${dg}, ${db}, 0.40)`);
    gc.fillStyle = glassFill;
    gc.fillText(text, cx, cy);

    // Layer 3: Glowing border
    const borderFill = gc.createLinearGradient(0, cy - halfH, 0, cy + halfH);
    borderFill.addColorStop(0.00, 'rgba(255, 255, 255, 0.95)');
    borderFill.addColorStop(0.40, `rgba(${hr}, ${hg}, ${hb}, 0.75)`);
    borderFill.addColorStop(0.70, `rgba(${r}, ${g}, ${b}, 0.50)`);
    borderFill.addColorStop(1.00, `rgba(${dr}, ${dg}, ${db}, 0.95)`);
    composite1to1(createOuterRim(borderFill, 2));

    // Layer 4: Specular + shadow bevels
    composite1to1(createBevel('rgba(255, 255, 255, 0.95)', -1.5, -1.5));
    composite1to1(createBevel(`rgba(${dr}, ${dg}, ${db}, 0.95)`, 1.5, 1.5));

    // Composite with grounding shadow
    const destX = x - drawW / 2;
    const destY = y - drawH / 2;
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
    ctx.shadowBlur = 28;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 12;
    ctx.drawImage(glassCanvas, destX, destY, drawW, drawH);
    ctx.restore();
    releaseCanvas(glassCanvas);
}

/**
 * Frosted glassmorphism panel (soft light frost — no black).
 * Neutral clear by default; `warm` uses orange/beige glassmorphism.
 */
export function drawGlassPanel(ctx: CanvasRenderingContext2D, opts: GlassPanelOptions): void {
    const { x, y, w, h, radius, warm = false } = opts;

    const path = () => {
        ctx.beginPath();
        ctx.roundRect(x, y, w, h, radius);
    };

    // Backdrop blur inside the panel (glassmorphism — photo/color softens through)
    const mask = document.createElement('canvas');
    mask.width = Math.max(1, Math.ceil(w));
    mask.height = Math.max(1, Math.ceil(h));
    const mk = mask.getContext('2d');
    if (mk) {
        mk.beginPath();
        mk.roundRect(0, 0, w, h, radius);
        mk.fillStyle = '#ffffff';
        mk.fill();
        frostBackdropUnder(ctx, x, y, w, h, mask, 22);
    }

    // Soft ambient lift (warm glow when warm)
    ctx.save();
    if (warm) {
        ctx.shadowColor = 'rgba(255, 176, 112, 0.35)';
        ctx.shadowBlur = 36;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 10;
    } else {
        ctx.shadowColor = 'rgba(255, 255, 255, 0.20)';
        ctx.shadowBlur = 24;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 6;
    }

    // Frost body — translucent (glassmorphism). Warm: beige/peach/orange.
    const body = ctx.createLinearGradient(x, y, x, y + h);
    if (warm) {
        body.addColorStop(0.00, 'rgba(255, 244, 230, 0.78)');
        body.addColorStop(0.35, 'rgba(255, 228, 196, 0.48)');
        body.addColorStop(0.65, 'rgba(255, 214, 170, 0.38)');
        body.addColorStop(1.00, 'rgba(255, 236, 210, 0.55)');
    } else {
        body.addColorStop(0.00, 'rgba(255, 255, 255, 0.58)');
        body.addColorStop(0.35, 'rgba(255, 255, 255, 0.28)');
        body.addColorStop(0.65, 'rgba(255, 255, 255, 0.22)');
        body.addColorStop(1.00, 'rgba(255, 255, 255, 0.38)');
    }
    ctx.fillStyle = body;
    path();
    ctx.fill();
    ctx.restore();

    // Soft sheen clipped to panel
    ctx.save();
    path();
    ctx.clip();
    const half = Math.min(w, h) * 0.5;
    const cx = x + w / 2;
    const cy = y + h / 2;
    const glare = ctx.createLinearGradient(cx - half, cy - half, cx + half, cy + half);
    if (warm) {
        glare.addColorStop(0.00, 'rgba(255, 236, 200, 0.55)');
        glare.addColorStop(0.40, 'rgba(255, 210, 160, 0.12)');
        glare.addColorStop(1.00, 'rgba(255, 200, 140, 0.22)');
    } else {
        glare.addColorStop(0.00, 'rgba(255, 255, 255, 0.45)');
        glare.addColorStop(0.40, 'rgba(255, 255, 255, 0.10)');
        glare.addColorStop(1.00, 'rgba(255, 255, 255, 0.22)');
    }
    ctx.fillStyle = glare;
    ctx.fillRect(x, y, w, h);

    // Top gloss band
    const gloss = ctx.createLinearGradient(x, y, x, y + h * 0.45);
    if (warm) {
        gloss.addColorStop(0, 'rgba(255, 248, 230, 0.55)');
        gloss.addColorStop(1, 'rgba(255, 230, 190, 0)');
    } else {
        gloss.addColorStop(0, 'rgba(255, 255, 255, 0.48)');
        gloss.addColorStop(1, 'rgba(255, 255, 255, 0)');
    }
    ctx.fillStyle = gloss;
    ctx.fillRect(x, y, w, h * 0.45);
    ctx.restore();

    // Soft clear rim (warm cream when warm)
    ctx.save();
    path();
    ctx.strokeStyle = warm ? 'rgba(255, 240, 210, 0.75)' : 'rgba(255, 255, 255, 0.65)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();

    // Top-edge glint
    ctx.save();
    path();
    ctx.clip();
    ctx.shadowColor = 'rgba(255, 255, 255, 0.50)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = -2;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.40)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x + radius * 0.5, y + 1);
    ctx.lineTo(x + w - radius * 0.5, y + 1);
    ctx.stroke();
    ctx.restore();
}
