# Editorial Strip Sticker - Technical Lessons

## Overview
The `editorial-strip` sticker underwent a significant visual overhaul to embrace a pure "brutalist editorial" aesthetic, shifting away from generic greetings and bottom-anchored layouts in favor of a top-down, typography-heavy design.

## Key Learnings & Rendering Strategies

### 1. Robust Anti-Ghosting on Background Elements
Previously, the `applyAntiGhostingShadow(ctx, textColor)` function was called **after** rendering background elements (like the massive rotated day name gradient).
* **The Problem:** When placed on a white background with a white text color (`isDark = true` -> shadow is white), the background white gradient completely disappeared. 
* **The Fix:** Applying `applyAntiGhostingShadow` at the **very start** of the render function ensures that even background typography (like the rotated day name) receives the necessary drop shadow to detach from the photo background.

### 2. Strict Top-Down Vertical Rhythm
* **The Problem:** Mixing `ctx.textBaseline = 'middle'` with drastically different font sizes (e.g., 24px labels vs 120px values) while trying to anchor elements to a `bottomY` coordinate led to irregular spacing, overlapping, and a scrambled visual hierarchy.
* **The Fix:** Switched to a strict `ctx.textBaseline = 'top'` layout. By using a single running `currentY` variable and stepping it down progressively (`currentY += offset`), we achieved perfect, predictable vertical spacing that mimics high-end magazine column layouts.

### 3. Registry Dual-List Architecture
* We successfully cleaned up the `StickerRegistry` by enforcing the Dual-List Architecture (`ACTIVE_STICKER_LIST` vs `ARCHIVED_STICKER_LIST`).
* By reordering the active list to the user's preference and shifting unused variants (e.g., `stealth-bar`, `boxed-metric`) to the archived list, the UI gallery is kept clean without losing legacy renderer logic.
