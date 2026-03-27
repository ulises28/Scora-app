---
description: Scora Canvas Template Implementation Rules
---

# Scora Canvas Template Development & Best Practices

To build new designs efficiently and ensure they work perfectly as photo overlays within the HTML5 Canvas environment, follow these core principles which combine developer workflow best practices with strict technical implementation rules.

## Part 1: Best Practices for SCORA Canvas Creations

### 1. Technical Architecture (The Modular Approach)
Instead of hardcoding every new sticker, use a Registry Pattern. This allows you to define the data/styles in a simple object and let a single component handle the rendering.
*   **Centralized State:** Keep sample data (distance, pace) in one place so you can test all stickers simultaneously.
*   **Wrapper Components:** Use a StickerWrapper to handle common tasks like background grids, hover effects, and titles. This keeps your actual design code clean.

### 2. Design for "Context-Free" Environments
Since these stickers are applied to unknown photos, follow these visual rules:
*   **Transparency First:** Always design with the assumption that the background is a photo. Use backdrop-blur (glassmorphism) or semi-transparent blacks (bg-black/40) to ensure text is legible regardless of what's behind it.
*   **High Contrast Typography:** Use font weights like `font-black` or `font-extrabold`. Use italic for a "speed" feel.
*   **Drop Shadows:** Apply `shadow-2xl` or custom drop-shadow to the container. It separates the sticker from the photo depth-wise.

### 3. Tailwind CSS Shortcuts for Speed (For React Prototyping)
To "not struggle" each time when prototyping, memorize these utility combinations for stickers:
*   **Glass Look:** `bg-white/10 backdrop-blur-md border border-white/20`
*   **Sporty Look:** `italic uppercase tracking-tighter font-black`
*   **Pill Shape:** `rounded-full px-6 py-3 shadow-lg`
*   **Data Grid:** `grid grid-cols-3 gap-4 items-center`

### 4. Brand Consistency (The SCORA Identity)
Maintain a "Visual Language" so the app feels cohesive:
*   **The Cyan Accent:** Use `#22d3ee` (Tailwind `cyan-400`) as your primary "Action" or "Brand" color.
*   **The "SCORA Dot":** Include a small circular element (2-3px) in your layouts as a subtle signature.
*   **Iconography:** Stick to one library (like `lucide-react`) for a consistent stroke weight (default to `size={18}` or `size={20}`).

### 5. Workflow in your IDE
*   **Sketch Logic:** Don't write CSS from scratch. Think in terms of "Box with two halves" or "Circle with a glow."
*   **Iterative Testing:** Use the "Global Controls" pattern implemented in the Canvas to see how your design reacts to long vs. short strings (e.g., "9.1" vs "122.50").
*   **Export Ready:** Ensure your components are "Pure"—they should only rely on props, making them easy to move into your production SCORA codebase.


---


## Part 2: Technical Implementation Rules (CanvasPainter.ts)

When migrating a React prototype to the actual production Canvas, adhere to these strict data structure and layout rules to prevent data overlapping, incorrect variables, and layout crashes.

### 1. Template Registration
- **Location**: `src/features/editor/TemplateManager.ts`
- **Action**: Add the new template ID string to the `TEMPLATE_REGISTRY` array.
- The UI carousel automatically updates from this array.

### 2. Drawing Implementation
- **Location**: `src/features/editor/CanvasPainter.ts`
- **Action**: Create a new function `drawYourTemplate(ctx, stats, textColor)` and register it inside both the `drawRunningTemplate` and `drawGymTemplate` router functions.

### 3. Data Parsing Rules (CRITICAL)
Always structure constraints safely to prevent overlaps, handle missing values, and display the appropriate metrics properly from the `stats` payload generated in `strava.ts`:

- **Distance-Based Mapping**: 
  Use `stats.hasDistance` (standardized today) instead of `hasMap` to determine whether to show distance or duration as the hero stat.
  - For Distance-based sports (Run, Bike, Hike): `stats.hasDistance` will be true if GPS or manual distance is present.
  - For Gym/Workout sports: `stats.hasDistance` will be false. Fallback to Duration and Avg Heartrate.

- **Standardized Labels (NO HARDCODING)**:
  NEVER hardcode strings like "AVERAGE", "DISTANCE", or "PACE" inside `CanvasPainter.ts`. Always use the mapped labels from `strava.ts`:
  - **Hero Label**: `stats.mainLabel` (e.g., "Distance" or "Duration").
  - **Sub-stat Label**: `stats.subLabel` (e.g., "Pace", "Avg Speed", or "Avg Heartrate").
  
  ```typescript
  // Recommended Layout Choice
  const mainLabel = stats.mainLabel || (stats.hasDistance ? "DISTANCE" : "DURATION");
  const subLabel = stats.subLabel || (stats.hasDistance ? "PACE" : "AVG HR");
  ```

- **Advanced Duration Formatting**:
  For activities over 59:59, use the "1h 11m" format instead of total minutes.
  **Transparency Rule (Minimalist)**: For maximum aesthetic premium feel, render the numbers at `0.45` alpha and the units ('h', 'm') at `1.0` alpha.
  
  ```typescript
  // Example for Minimal Template
  const rawDur = stats.mainValue || '0m';
  const parts = rawDur.match(/(\d+|[hm] ?)/g) || [];
  parts.forEach(p => {
      ctx.globalAlpha = /\d/.test(p) ? 0.45 : 1.0;
      ctx.fillText(p, x, y);
      x += ctx.measureText(p).width;
  });
  ```

- **Pace / Speed / Heartrate Unit Overlaps**: 
  Strava data contains unit strings like `km/h` or `/km`. **Always Split them** to prevent unit layout overlaps:
  ```typescript
  const paceParts = (stats.subValue || '').trim().split(' ');
  const paceNum = paceParts[0] || (stats.avgHeartrate ? String(stats.avgHeartrate) : '0');
  let paceUnit = paceParts[1] || (stats.hasDistance ? (stats.type === 'Ride' ? 'km/h' : '/km') : 'bpm');
  ```

- **Start Time vs Duration**: 
  NEVER use `stats.timeStr` for "Started at" labels. `timeStr` is the activity duration (e.g., `1h 42m`). For chronologic time marks (e.g., `7:08 AM`), use `stats.startTime`.
  ```typescript
  // BAD: ctx.fillText(`STARTED ${stats.timeStr}`) // Output: "STARTED 1h 42m"
  // GOOD: ctx.fillText(`STARTED ${stats.startTime}`) // Output: "STARTED 7:08 AM"
  ```

### 4. Canvas Styling Rules
- **No DOM CSS**: You are drawing on a native HTML5 raster Canvas. Do not attempt HTML/CSS properties like `backdrop-blur`.
- **Primitives**: Use `ctx.roundRect`, `ctx.fill()`, `ctx.shadowColor`, and absolute constraints (`ctx.measureText(text).width`).
- **Glassmorphism**: Render translucent overlays using semi-transparent fills based on the requested `textColor` orientation.
  ```typescript
  ctx.fillStyle = textColor === 'black' ? 'rgba(0, 0, 0, 0.1)' : 'rgba(255, 255, 255, 0.15)';
  ```
- **Shadows**: Manage shadow global state carefully. Disable `ctx.shadowBlur = 0` immediately after drawing the intended path to avoid performance drops and bleed onto typography.
