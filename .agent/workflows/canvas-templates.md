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

- **Gym Fallbacks (Distance & Pace)**: 
  If a map isn't present (`!stats.hasMap`), you MUST fallback to gym metrics (Duration and Heart Rate). 
  - For Columns/Blocks representing Distance, fallback to "DURATION" or "TIME" and render `stats.timeStr`.
  - For Columns/Blocks representing Pace, fallback to "AVG HR" or "HEART RATE", rendering `stats.avgHeartrate`.
  - For 3-column designs (like Info Glass), fallback the 3rd stat (Time) to "MAX HR", rendering `stats.maxHeartrate`.
  
  ```typescript
  // Typical Left Block (Distance / Time)
  const leftLabel = stats.hasMap ? "DISTANCE" : "DURATION";
  const distText = stats.hasMap ? (stats.distanceVal || '0.00') : (stats.timeStr || '0:00');
  const distUnit = stats.hasMap ? 'km' : '';
  
  // Typical Right Block (Pace / HR)
  const rightLabel = stats.hasMap ? "PACE" : "HEART RATE";
  const paceParts = stats.hasMap ? (stats.subValue || '').trim().split(' ') : [];
  const paceText = paceParts[0] || (stats.avgHeartrate ? String(stats.avgHeartrate) : '0');
  let paceUnit = paceParts[1] || (stats.hasMap ? '/km' : 'bpm');
  ```

- **Distance**: 
  ```typescript
  const distText = stats.distanceVal || stats.mainValue || '0.00';
  ```

- **Pace / Speed / Heartrate Unit Overlaps**: 
  NEVER use `stats.subValue` blindly for distinct layouts! Strava data contains strings like `16.9 km/h` or `5:11 /km`. **Always Split them** to prevent unit layout overlaps:
  ```typescript
  const paceParts = (stats.subValue || '').trim().split(' ');
  const paceNum = paceParts[0] || (stats.maxHeartrate ? String(stats.maxHeartrate) : '0:00');
  
  // Conditionally process the unit based on map status or specific design:
  let paceUnit = paceParts[1] || (stats.hasMap ? 'min/km' : 'bpm');
  if (paceUnit === '/km') paceUnit = 'min/km';
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
