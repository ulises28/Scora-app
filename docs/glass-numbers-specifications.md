# Glass Numbers Sticker: Complete Specification & Rendering Standard

This document is the **single authoritative specification** for the **`glass-numbers`** canvas sticker in Scora. It defines the exact visual geometry, full vertical canvas fill, color matching rules, auto-fit text measurement, and high-contrast 3D **Slim Frosted Glass Bevel** rendering pipeline modeled after the Apple iOS Lock Screen Glass Clock `9:41`.

---

## 1. Core Visual Corrections & Principles

### A. Full Vertical Area Fill (Hero Height ~ 1350px)
- **Eliminating Wasted Top/Bottom Space:** Hero digits (`10.05`) stretch vertically to fill the entire middle span between Date Header (`Y: 160`) and Unit Label (`Y: 1720`).
- **Base Font Size:** Set base font size to **`1350px`** with an aspect scale of **`0.24`**.
- **Dynamic Auto-Fit Math:** Measure string width `rawWidth = ctx.measureText(mainVal).width * 0.24`. If `rawWidth > 900px`, scale down via `scaleFactor = 900 / rawWidth`.

### B. Slim & Elegant Typography (Inter 300 Light)
- **Font Weight:** Switched from heavy 900 Black to **`300` (Light)** for slim, high-fashion numbers matching the Apple iOS 18 glass clock aesthetic (`9:41`).
- **Slim 3D Refraction Bevels:**
  - **Top-Left Specular Light Hit:** `lineWidth: 10px`, offset `(-3, -4)`, `rgba(255, 255, 255, 0.92)`.
  - **Bottom-Right Dark Refraction Shadow:** `lineWidth: 16px`, offset `(+4, +5)`, `rgba(0, 0, 0, 0.55)`.
  - **Slim Double Rim:** `5px` outer perimeter stroke + `2px` inner white gloss line creating delicate 3D glass edge thickness.

---

## 2. Updated Canvas Grid Specifications (1080 × 1920 Reference Canvas)

```
 +-------------------------------------------------------+ (0, 0)
 |                                                       |
 |   Date Header: "Dom, 29 mar"                          | (X: 540, Y: 160)
 |   - Font: Inter 600 (44px), letterSpacing: 1.5px      |
 |                                                       |
 | +===================================================+ | (Hero Frame Top: Y = 220)
 | |                                                   | |
 | |                                                   | |
 | |               1 0 . 0 5                           | | (Center: X = 540, Y = 940)
 | |                                                   | |
 | |   Hero Glass Digits: 1350px tall font (Inter 300) | |
 | |   (Spans Y: 260 to Y: 1620, Height ~ 1360px)       | |
 | |                                                   | |
 | +===================================================+ | (Hero Frame Bottom: Y = 1660)
 |                                                       |
 |   Unit Label: "km"                                    | (X: 540, Y: 1720)
 |   - Font: Inter 600 (48px), letterSpacing: 2px       |
 |                                                       |
 +-------------------------------------------------------+ (1080, 1920)
```

| Element | Alignment | Anchor (X, Y) | Target Bounding Box / Dimensions | Typography / Styling | Baseline & Spacing |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Date Header** | Center | (540, 160) | Width: ~800px, Height: 45px | Inter 600, 44px, `textColor` | `textBaseline = 'middle'` |
| **Hero Glass Digits** | Center | (540, 940) | Max Width: 900px, Height: **1350px** | **Inter 300 Light**, 1350px base, `0.24x` aspect scale | `textBaseline = 'middle'` |
| **Unit Label** | Center | (540, 1720) | Width: ~400px, Height: 48px | Inter 600, 48px, `textColor` | `textBaseline = 'top'` |
