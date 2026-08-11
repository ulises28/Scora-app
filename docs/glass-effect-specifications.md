# Studio Liquid Glass Effect Specifications

This document defines the authoritative 4-Layer Canvas 2D rendering formula and architectural rules for creating premium, high-visibility 3D Liquid Glass stickers in Scora.

---

## 1. Core Principles & Lessons Learned

1. **Directional Studio Lighting (Top-Left Light, Bottom-Right Refraction)**
   - High-end 3D glass requires consistent directional lighting: a white specular highlight along **top-left inner edges** (`offset: -4, -4`) and a soft dark refraction shadow along **bottom-right inner edges** (`offset: +4, +4`).
2. **Zero Offscreen Offsets (Cross-Browser Rule)**
   - **DO NOT** use large offscreen shadow offsets (`shadowOffsetX = -9999` or `-1800`). Large offsets cause WebKit glyph tile clipping in Safari iOS/macOS and white halo/black stroke rendering artifacts in Chrome.
   - All stroke and fill operations MUST be drawn at local coordinates (`x = 0, y = 0`) using `globalCompositeOperation = 'source-atop'` for GPU-accelerated inner clipping.
3. **Color-Matched Outer Perimeter (No Hardcoded White Rims)**
   - **DO NOT** render hardcoded `#ffffff` or `rgba(255,255,255,0.6)` outer strokes around colored glass shapes. Outer rims MUST match the user-selected color (`rgba(r, g, b, 0.85)`).
4. **Translucent Core (Photo & Background Visibility)**
   - Liquid glass should never be opaque. The center of glass shapes must have a low opacity tint (`0.20`), allowing photo backgrounds to shine through the glass body.
5. **1:1 Offscreen Canvas for Anisotropic Text (Skia Winding Bug)**
   - When rendering text under non-uniform scaling (`scale(0.22, 1.0)`), **DO NOT** call `fillText` or `strokeText` directly on the scaled context. Skia/Blink's GPU rasterizer miscalculates winding rules for self-intersecting font paths (e.g. digit `'4'`), filling hollow counters with solid color.
   - Instead, render all text layers on a **1:1 uniform-scale offscreen canvas**, then composite onto the main canvas with `drawImage(offscreen, x, y, scaledWidth, height)`.
6. **No Offset `strokeText` Under `source-atop`**
   - **DO NOT** use `strokeText(text, x±offset, y±offset)` with `globalCompositeOperation = 'source-atop'` for directional lighting. The shifted glyph paths bleed into counters of characters like `'4'`. Use diagonal gradient `fillRect` instead.

---

## 2. Standard 6-Layer Zero-Stroke Rendering Pipeline

> [!CAUTION]
> **CRITICAL RULE: ZERO `strokeText` CALLS.** 
> `strokeText` strokes ALL sub-paths including inner counter holes of characters like `0`, `4`, `5`, `6`, `8`, `9`. There is NO Canvas 2D API to stroke only the outer contour. The glass rim MUST be simulated with multiple `fillText` passes and directional canvas shadows instead.

### Layer 1: Ambient Glass Halo (Soft Glow)
Soft glow around the entire glyph to separate it from the background.
```typescript
ctx.shadowColor = `rgba(${hr}, ${hg}, ${hb}, 0.80)`;
ctx.shadowBlur = 18;
ctx.shadowOffsetX = 0;
ctx.shadowOffsetY = 0;
ctx.fillStyle = 'rgba(255, 255, 255, 0.01)';
ctx.fillText(text, x, y);
```

### Layer 2: Top Specular Rim Highlight
Simulates white light hitting the top edge.
```typescript
ctx.shadowColor = 'rgba(255, 255, 255, 0.98)';
ctx.shadowBlur = 6;
ctx.shadowOffsetX = 0;
ctx.shadowOffsetY = -4;
ctx.fillStyle = 'rgba(255, 255, 255, 0.01)';
ctx.fillText(text, x, y);
```

### Layer 3: Bottom Shadow Rim
Dark grounding shadow under the bottom edge.
```typescript
ctx.shadowColor = 'rgba(0, 0, 0, 0.75)';
ctx.shadowBlur = 6;
ctx.shadowOffsetX = 0;
ctx.shadowOffsetY = 5;
ctx.fillStyle = 'rgba(0, 0, 0, 0.01)';
ctx.fillText(text, x, y);
```

### Layer 4: Crystal Glass Body Fill (Translucent Gradient)
The core glass volume with high center transparency.
```typescript
ctx.shadowColor = 'transparent';
ctx.shadowBlur = 0;
ctx.shadowOffsetY = 0;
const glassFill = ctx.createLinearGradient(0, cy - halfH, 0, cy + halfH);
glassFill.addColorStop(0.00, 'rgba(255, 255, 255, 0.80)');
glassFill.addColorStop(0.12, `rgba(${hr}, ${hg}, ${hb}, 0.40)`);
glassFill.addColorStop(0.45, `rgba(${r}, ${g}, ${b}, 0.12)`);
glassFill.addColorStop(0.75, `rgba(${r}, ${g}, ${b}, 0.20)`);
glassFill.addColorStop(1.00, 'rgba(15, 15, 15, 0.60)');
ctx.fillStyle = glassFill;
ctx.fillText(text, x, y);
```

### Layer 5: -45° Specular Surface Glare Sweep (`source-atop`)
Clips specular glare inside the glyph using GPU composition.
```typescript
ctx.globalCompositeOperation = 'source-atop';
const glareGrad = ctx.createLinearGradient(
    cx - halfH * 0.85, cy - halfH * 0.85,
    cx + halfH * 0.85, cy + halfH * 0.85
);
glareGrad.addColorStop(0.00, 'rgba(255, 255, 255, 0.85)');
glareGrad.addColorStop(0.22, 'rgba(255, 255, 255, 0.30)');
glareGrad.addColorStop(0.50, 'rgba(255, 255, 255, 0.02)');
glareGrad.addColorStop(0.78, 'rgba(0, 0, 0, 0.18)');
glareGrad.addColorStop(1.00, 'rgba(0, 0, 0, 0.55)');
ctx.fillStyle = glareGrad;
ctx.fillRect(0, 0, width, height);
```

### Layer 6: Bright Top-Edge Specular Pass
A final pop of top-edge highlight.
```typescript
ctx.globalCompositeOperation = 'source-over';
ctx.shadowColor = 'rgba(255, 255, 255, 0.95)';
ctx.shadowBlur = 10;
ctx.shadowOffsetX = 0;
ctx.shadowOffsetY = -3;
ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
ctx.fillText(text, x, y);

// Reset shadows
ctx.shadowColor = 'transparent';
ctx.shadowBlur = 0;
ctx.shadowOffsetY = 0;
```

---

## 3. Native Text Scaling & Spacing Rules

1. **Resolution & Blur Prevention**:
   - Render vertical text at full stretched native height (`1120px` font size) and apply horizontal scale down (`scale(0.203125, 1.0)`). This prevents rasterization blur on iOS Safari high-DPI displays.
2. **Date Header Clearance**:
   - Always leave at least `100px+` vertical clearance between date/meta text at top (`y = 150`) and giant numbers (`y = 1350`).
3. **Pill Spacing**:
   - For glass pills (`social-pill`), maintain a minimum `50px` clear gap between the end of text strings and action buttons by dynamically scaling down font sizes when text length increases.
