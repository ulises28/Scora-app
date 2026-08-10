# Glass Numbers Sticker: Complete Specification & Grid Standard

This document is the **single authoritative specification** for the **`glass-numbers`** canvas sticker in Scora. It defines the top-docked symmetrical grid geometry, zero-overlap spacing, color matching rules, auto-fit text measurement, and high-contrast 3D **Slim Frosted Glass Bevel** rendering pipeline modeled after the Apple iOS Lock Screen Glass Clock `9:41`.

---

## 1. Top-Docked Zero-Overlap Grid Geometry

### A. Precise Symmetrical Grid Coordinates (1080 × 1920 Canvas)
- **Primary Axis:** Centered on vertical midline (`X = 540px`).
- **Date Header (`Dom, 29 mar`):** Anchored at `Y: 180px`.
- **Hero Glass Digits (`10.05`):** Center anchored at `heroY = 640px` (`baseFontSize = 850px`, `aspectScaleX = 0.22`, `maxAllowedWidth = 640px`).
  - Visual Top extent of digits: `Y: 266px`.
  - Visual Bottom extent of digits: `Y: 1014px`.
- **Unit Label (`km` / `min`):** Anchored at **`Y: 1080px`**.

### B. Mathematical & Visual Symmetry Verification
- **Top Gap (Date to Top of Digits):** `266px - 200px = 66px`.
- **Bottom Gap (Bottom of Digits to Unit):** `1060px - 1014px = 46px`.
- Zero overlap between date and digits, zero overlap between digits and unit.

---

## 2. Updated Canvas Grid Specifications

```
 +-------------------------------------------------------+ (0, 0)
 |   • SCORA. (Top Left Logo)                            |
 |                                                       |
 |   Date Header: "Dom, 29 mar"                          | (X: 540, Y: 180)
 |   ====== [ Equal Gap: ~60px ] ======================= |
 | +===================================================+ | (Max Width = 640px)
 | |               1 0 . 0 5                           | | (Center: X = 540, Y = 640)
 | |   Hero Glass Digits: 850px base, 0.22x aspect     | |
 | |   (Top edge: Y = 266px, Bottom edge: Y = 1014px)  | |
 | +===================================================+ |
 |   ====== [ Equal Gap: ~60px ] ======================= |
 |   Unit Label: "km"                                    | (X: 540, Y: 1080)
 |                                                       |
 |   [ Completely Open Photo Background Area ]           | (Y: 1120 to 1920)
 |   - Unobstructed view of athlete photo                |
 |                                                       |
 +-------------------------------------------------------+ (1080, 1920)
```

| Element | Alignment | Anchor (X, Y) | Target Bounding Box / Dimensions | Typography / Styling | Baseline & Spacing |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Date Header** | Center | (540, 180) | Width: ~600px, Height: 45px | Inter 600, 44px, `textColor` | `textBaseline = 'middle'` |
| **Hero Glass Digits** | Center | (540, 640) | **Max Width: 640px**, Height: ~750px | **Inter 300 Light**, 850px base, `0.22x` aspect scale | `textBaseline = 'middle'` |
| **Unit Label** | Center | (540, 1080) | Width: ~350px, Height: 48px | Inter 600, 48px, `textColor` | `textBaseline = 'middle'` |
