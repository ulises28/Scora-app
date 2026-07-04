# Lessons Learned: Dot Grid Architect Sticker

## 1. Grid Snapping vs. Mathematical Octilinear Routing
Initially, we attempted to enforce a rigid architectural aesthetic by simplifying the GPS path using the Ramer-Douglas-Peucker algorithm and then mathematically forcing the lines to 0°, 45°, and 90° angles (a "Transit Map" approach).
*   **The Issue:** While geometrically perfect, it completely ignored the physical background grid, floating arbitrarily on the canvas.
*   **The Solution:** The best approach for an "Architectural Blueprint" aesthetic is to **project the GPS points directly onto the pixel coordinate space**, and then strictly round those coordinates to the nearest dot on the physical background grid. Connecting these snapped dots creates organic 45°/90° structures that feel perfectly integrated into the design environment.

## 2. The "Hollow Neon Pipe" Rendering Technique
To elevate a basic solid path to a premium, glassmorphic aesthetic (as seen in high-end UI/UX designs):
*   **Outer Bloom:** Draw the path first with a thick stroke (e.g., `lineWidth = 12`) using the user's selected accent color, and apply a massive drop shadow (`shadowBlur = 35`) of the same color.
*   **Inner Hot Core:** Redraw the exact same path immediately on top, but with a thin pure white stroke (e.g., `lineWidth = 3`) and a much tighter shadow (`shadowBlur = 5`).
*   **Result:** This double-stroke technique instantly creates a glowing, hollow glass tube effect that feels highly dimensional.

## 3. Universal Typography Contrast (Anti-Ghosting)
When rendering transparent canvas stickers that users can place over unpredictable photo backgrounds (pure white snow, pitch black night runs), the typography must remain legible.
*   **The Solution:** Implement a contextual Anti-Ghosting shadow.
*   If the typography is white (intended for dark photos), apply a subtle black drop shadow.
*   If the typography is black (intended for light photos), apply a subtle white drop shadow / glow.
*   This ensures the critical data (Distance, Pace, Time) pops aggressively against any background interference.

## 4. Color State Synchronization
When a user selects an accent color in the UI, the canvas must intelligently map this across all components.
*   Ensure that global elements (like the `SCORA.` branding logo) and sticker-specific elements (like the map path) reference the exact same parsed `c.accent` property.
*   **Fallbacks:** Only fall back to vibrant defaults (like Cyan or Magenta) if the user explicitly passes pure white or pure black as their accent hex, ensuring the neon aesthetic is never lost to grayscale.
