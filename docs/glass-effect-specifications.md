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

---

## 2. Standard 4-Layer Rendering Pipeline

### Step 1: Soft Ambient Grounding Shadow
Grounds the glass element over any background (pitch black or bright photo):
```typescript
ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
ctx.shadowBlur = 28;
ctx.shadowOffsetX = 0;
ctx.shadowOffsetY = 16;
```

### Step 2: Translucent Tinted Glass Base
Provides the core glass volume with high center transparency:
```typescript
const glassFill = ctx.createLinearGradient(0, -height, 0, 0);
glassFill.addColorStop(0.0, `rgba(${r}, ${g}, ${b}, 0.55)`);  // Top glass density
glassFill.addColorStop(0.5, `rgba(${r}, ${g}, ${b}, 0.20)`);  // Translucent core
glassFill.addColorStop(1.0, `rgba(${r}, ${g}, ${b}, 0.50)`);  // Bottom glass density

ctx.fillStyle = glassFill;
ctx.fillText(text, 0, 0); // Or fillRect / roundRect

// Reset shadow for internal layers
ctx.shadowColor = 'transparent';
ctx.shadowBlur = 0;
ctx.shadowOffsetY = 0;
```

### Step 3: Directional Studio Refractions (`source-atop`)
Clips all inner highlights strictly inside the shape bounds using GPU composition:
```typescript
ctx.globalCompositeOperation = 'source-atop';

// 3A. Bottom-Right Dark Refraction Shadow (Offset +4, +4)
ctx.lineWidth = 12;
ctx.strokeStyle = 'rgba(0, 0, 0, 0.45)';
ctx.strokeText(text, 4, 4);

// 3B. Top-Left White Specular Edge Light (Offset -4, -4)
ctx.lineWidth = 12;
ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
ctx.strokeText(text, -4, -4);

// 3C. Vertical Gloss Sheen
const glossGrad = ctx.createLinearGradient(0, -height, 0, 0);
glossGrad.addColorStop(0.0, 'rgba(255, 255, 255, 0.35)');
glossGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.05)');
glossGrad.addColorStop(1.0, 'rgba(255, 255, 255, 0.25)');

ctx.fillStyle = glossGrad;
ctx.fillText(text, 0, 0);
```

### Step 4: Color-Matched Perimeter Rim
Defines a crisp edge in the exact user-selected color without white halos:
```typescript
ctx.lineWidth = 5;
ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, 0.85)`;
ctx.strokeText(text, 0, 0);

ctx.globalCompositeOperation = 'source-over';
ctx.restore();
```

---

## 3. Native Text Scaling & Spacing Rules

1. **Resolution & Blur Prevention**:
   - Render vertical text at full stretched native height (`1120px` font size) and apply horizontal scale down (`scale(0.203125, 1.0)`). This prevents rasterization blur on iOS Safari high-DPI displays.
2. **Date Header Clearance**:
   - Always leave at least `100px+` vertical clearance between date/meta text at top (`y = 150`) and giant numbers (`y = 1350`).
3. **Pill Spacing**:
   - For glass pills (`social-pill`), maintain a minimum `50px` clear gap between the end of text strings and action buttons by dynamically scaling down font sizes when text length increases.
