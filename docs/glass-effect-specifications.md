# Glass Effect Rendering Specifications (Liquid Glass)

This document specifies the standard Canvas 2D rendering formula and architectural guidelines for creating premium, high-visibility 3D Liquid Glass stickers in Scora.

---

## 1. Core Principles

1. **High Visibility Across Backgrounds**: Glass must be luminous and readable on both pitch-black dark mode backgrounds and bright photo backgrounds.
2. **Ambient Light Sheen (Light-Shifted Color)**: Saturated/dark colors (like Red `#ff0000`) will turn dark/muddy on black backgrounds if rendered as pure alpha tints. Mixing white ambient light into top/bottom highlights preserves hue while boosting contrast.
3. **Sharp Vector Resolution**: Render text at full native height and scale down horizontally to avoid iOS/Safari canvas text rasterization blur.

---

## 2. Color & Shader Formula

### A. Ambient Light Sheen Calculation
```typescript
// Parse r, g, b from hex color (or fallback to white)
const r = 255, g = 0, b = 0; // Example: Red

// Mix 65% white light for ambient specular sheen
const hr = Math.round(r + (255 - r) * 0.65);
const hg = Math.round(g + (255 - g) * 0.65);
const hb = Math.round(b + (255 - b) * 0.65);
```

### B. Multi-Stop Glass Gradient
```typescript
const glassFill = ctx.createLinearGradient(0, -height, 0, 0);
glassFill.addColorStop(0, `rgba(${hr}, ${hg}, ${hb}, 0.95)`);   // Top specular sheen
glassFill.addColorStop(0.35, `rgba(${r}, ${g}, ${b}, 0.70)`);   // Core user tint
glassFill.addColorStop(0.70, `rgba(${hr}, ${hg}, ${hb}, 0.40)`);  // Luminous glass body
glassFill.addColorStop(1.0, `rgba(${hr}, ${hg}, ${hb}, 0.85)`);   // Bottom rim reflection
```

---

## 3. Layering & Composite Operations

### Layer 1: Ambient Drop Shadow (Base)
```typescript
ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
ctx.shadowBlur = 40;
ctx.shadowOffsetX = 0;
ctx.shadowOffsetY = 20;

ctx.fillStyle = glassFill;
ctx.fillText(text, x, y); // Or fillRect/roundRect for glass boxes
```

### Layer 2: Inner Bevels & Refractions (`source-atop`)
```typescript
ctx.globalCompositeOperation = 'source-atop';

// 1. Top Specular White Reflection
ctx.shadowColor = 'rgba(255, 255, 255, 1)';
ctx.shadowBlur = 18;
ctx.shadowOffsetX = -9999;
ctx.shadowOffsetY = -18; 
ctx.lineWidth = 20;
ctx.strokeStyle = '#ffffff';
ctx.strokeText(text, 9999, y);

// 2. Bottom Inner Depth Shadow
ctx.shadowColor = 'rgba(0, 0, 0, 0.6)'; 
ctx.shadowBlur = 18; 
ctx.shadowOffsetX = -9999;
ctx.shadowOffsetY = 24;
ctx.lineWidth = 20;
ctx.strokeStyle = '#000000';
ctx.strokeText(text, 9999, y);
```

### Layer 3: Dual Specular Rim Contour
```typescript
// 1. Luminous Color Rim
ctx.shadowBlur = 0;
ctx.shadowOffsetX = 0;
ctx.shadowOffsetY = 0;
ctx.lineWidth = 10;
ctx.strokeStyle = `rgba(${hr}, ${hg}, ${hb}, 0.95)`; 
ctx.strokeText(text, x, y);

// 2. Pure White Specular Accent Rim
ctx.lineWidth = 4;
ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
ctx.strokeText(text, x, y);

ctx.globalCompositeOperation = 'source-over';
```

---

## 4. Canvas Resolution & Scaling Rules

- **Native Text Scaling**: Avoid `scale(1, 3.2)` with a `350px` font. Render at `1120px` font size and `scale(0.203, 1.0)`.
- **Shadow Offset Math**: When using the `-9999` off-screen stroke trick, use `-9999` and `+9999` directly. The Canvas API transforms both `shadowOffsetX` and text coordinates synchronously with the matrix transform. Do not manually scale or divide `-9999`.
