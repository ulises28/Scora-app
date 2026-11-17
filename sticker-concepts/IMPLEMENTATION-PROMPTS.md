# Sticker Implementation Prompts — Scora

Copy each block as a single agent/task prompt. **Do not implement from this file automatically** — these are handoff specs.

Shared constraints that every prompt inherits:

- Canvas sticker system is **Canvas 2D** in `src/features/editor/CanvasPainter.ts`, registered in `src/features/editor/StickerRegistry.ts`.
- Logical canvas: **1080 × 1920**. Scora logo sits around **Y 100–140**. Keep all sticker content **top-anchored** (`yTop >= 150`); prefer a compact vertical footprint near the top so the photo stays visible.
- Metrics must come from **`getDynamicStats(stats)`** (`s1/s2/s3`) plus direct `stats.*` fields. Never hardcode `PACE` / `KM` / `TIME` as if they were data. Never invent `0.00` values when data is missing — omit the row/line.
- **Mode variance is mandatory**: distance activities (run/bike) vs workout/gym (`!stats.hasDistance`). Workout must drop distance/pace/map and prefer Duration + HR (+ Max HR / Relative Effort).
- Typography: **no italics**. All-caps sub-labels use letter-spacing (≈ `1.5–2.5px`). Values are solid opacity (1.0). Prefer `Space Grotesk` / `Outfit` / `Plus Jakarta Sans` for data stickers; serif only when the concept calls for it.
- When value+unit sit on one line, print **units**, not metric names (`10.05 KM`, `4:09 /KM`). Metric names as tiny stacked labels are OK.
- Color: honor `textColor` (`'white' | 'black' | hex`). Use `buildColors(textColor)` / `deriveContrastInk` patterns. No heavy drop shadows. Glass = soft white alpha, not boxed borders.
- Distance sports use `normalizeSport()` / `getDynamicStats` unit routing (`/km`, `km/h`, `/100m`). Uppercase type before comparisons.
- After any registry change: `pnpm run sync:stickers` (only writer of `tests/e2e/fixtures/sticker-capabilities.json`) + `pnpm run test:unit`. Do not hand-edit capabilities JSON.
- Registry shape: `{ id, category, supportsCustomColor, supportsBlackText, compact?, features, expectedLabels?, paintForm?, render }`. Feature keys only: `distance, paceSpeed, duration, alwaysShowDuration, heartRate, heartRateType, date, startTime, map, title, location, elevation, calories, temperature`.

---

## 01 · skyline-splits

```text
Implement new Scora canvas sticker `skyline-splits`.

ID: skyline-splits
Category: all
supportsCustomColor: true
supportsBlackText: true
compact: false
features: { distance: true, paceSpeed: true, duration: true, alwaysShowDuration: true, heartRate: true }
expectedLabels: optional, only if the renderer paints distinctive strings the auto labels miss (e.g. "AVG.")
paintForm: default numeric for distance/time/pace/heartRate

Renderer: export function drawSkylineSplits(ctx, stats, textColor) in CanvasPainter.ts
Registry render: Renderers.drawSkylineSplits

VISUAL
- Data-forward "split skyline": vertical bars on a baseline, hero metrics above.
- Compact, top-anchored block. No map, no heavy glass panel, no neon.
- Monochrome ink from textColor (white default). Bars use vertical alpha fade (solid top → translucent base). 3px rounded caps.
- 1px baseline hairline under the bars (0.5px snap).

LAYOUT (approx, tune for glyph fit)
1) y≈320: letter-spaced header
   - distance mode: "SPLITS · {distanceVal} {UNIT}" when stats.splits?.length > 0, else "{distanceVal} {UNIT}"
   - workout: "SESSION SPLITS"
2) y≈460 hero:
   - distance: timeStr (or duration from getDynamicStats) at ~120px/800
   - under it ~40px label: "AVG. {pace} {unit}" uppercase (unit from getDynamicStats s2.unit — '/km' or 'km/h')
   - workout: duration hero; unit under if present; then "{hr} BPM" if avgHeartrate/maxHeartrate
3) Bars y≈620–980, width ~880 centered on x=540
   - data: stats.splits[] { type, label, pace, seconds }
   - bar height maps pace quality: taller = faster (invert split seconds vs min-max span)
   - min bar height ~28px so tiny splits remain visible
   - gap scales with count (tighter for >16 splits)
4) Fallback when no splits: draw a quiet 4px baseline only — DO NOT fabricate per-km bars or fake pace values.

MODE BRANCH
- hasDistance = Boolean(stats.hasDistance || (stats.distanceVal && parseFloat(stats.distanceVal) > 0))
- Distance: header + time hero + avg pace + split bars
- Workout: "SESSION SPLITS" + duration + HR line; if no splits, still fine with baseline stub (gym often has none). Never show distance/pace.

COPY
- Use unit text from getDynamicStats; never concatenate metric names into value strings.
- Header uses distanceVal + unit, not "10 DISTANCE".
- Prefer "AVG. 4:09 /KM" over "PACE 4:09" when shown inline with units.

TEST / CONTRACT
- features claim must match paint contract (alwaysShowDuration puts `time` in run/bike metrics too).
- Smoke-render runStats (distance + splits) and workoutStats (no distance) without throwing.
- pnpm run sync:stickers && pnpm run test:unit.
```

---

## 02 · lab-datagrid

```text
Implement new Scora canvas sticker `lab-datagrid`.

ID: lab-datagrid
Category: all
supportsCustomColor: true
supportsBlackText: true
compact: false
features: { distance: true, paceSpeed: true, duration: true, alwaysShowDuration: true, heartRate: true, elevation: true }
expectedLabels: optional ("M" only if you paint meter unit and tests need it)
paintForm: default numeric

Renderer: export function drawLabDataGrid(ctx, stats, textColor)
Registry id: `lab-datagrid` (note: function name DataGrid, id datagrid)

VISUAL
- Dense scientific metric table. Surgical 1px grid lines only — no filled boxes, no glass.
- Monochrome. Labels at ~0.55–0.75 alpha of ink; values full solid.
- Explicit two-column layout: left labels, right values. NEVER build one centered concatenated string.

LAYOUT
1) y≈300: "SESSION LOG" letter-spaced ~2.5px, centered
2) Grid width ~880, x0 = 540 - 440, top ≈ 360
3) Row height ≈ 110; column split at x0 + 0.42*gw
4) Stroke outer rect + row separators + one vertical column rule (0.5px snap)

ROWS — distance mode (hide empty rows entirely)
- DISTANCE | "{distanceVal} {UNIT}"  (UNIT uppercase from getDynamicStats)
- PACE | "{pace} {unit}" (unit uppercase: /KM or KM/H)
- TIME | timeStr (include because alwaysShowDuration)
- HR AVG | "{hr} BPM" if avgHeartrate
- ELEV | "{elev} M" if elevation present (stats.elevation or dataPoints find label includes ELEV)

ROWS — workout mode (no distance/pace)
- DURATION | timeStr or s1
- HR AVG | "{hr} BPM"
- MAX HR | "{max} BPM" if available
- EFFORT | suffer/relative effort only if present in s3 / stats

TYPE
- Labels: Plus Jakarta Sans / Outfit 500, ~28px, letter-spacing 1.5px, left anchored
- Values: Space Grotesk / Outfit 700, ~42px, right anchored to grid right padding
- Mid-row baseline ≈ gridTop + i*rowH + 0.62*rowH

RULES
- Columnar alignment only (label column + value column).
- Omit rows with missing values; do not draw "0" / "—" placeholders unless the whole sticker would be empty.
- Top-anchored under logo zone.

TEST / CONTRACT
- elevation feature → display contract must include elevation in distance modes.
- Mode variance: workout metrics exclude distance & pace; drop MAP if any.
- pnpm run sync:stickers && pnpm run test:unit.
```

---

## 03 · waveform-pace

```text
Implement new Scora canvas sticker `waveform-pace`.

ID: waveform-pace
Category: all
supportsCustomColor: true
supportsBlackText: true
compact: true
features: { distance: true, paceSpeed: true, duration: true, alwaysShowDuration: true, heartRate: true }
expectedLabels: []
paintForm: default numeric

Renderer: drawWaveformPace
Registry id: waveform-pace

VISUAL
- Horizontal waveform of effort/pace: many thin vertical bars with mirrored top/bottom amplitude around a center line.
- Bars ~3px wide, gap ~5px, rounded 2px. Gradient/alpha fade so the strip feels audio-like, not a bar chart with axes.
- No axes, no grid, no glass panel.

DATA
- Prefer stats.splits[].seconds (or pace) to shape amplitude: slower split → taller or denser bar; document which mapping you pick and keep it consistent.
- Fallback without splits: derive amplitude from polyline latitude variance (like tempo_graph) or a gentle deterministic wave — do not invent per-km pace numbers.

LAYOUT
1) y≈280: "PACE WAVEFORM" label (or "EFFORT WAVEFORM" on workout)
2) y≈360: hero pace "4:09 /KM" (distance) or duration "52:18" (workout)
3) Waveform centered vertically ~y 480–560
4) Summary line under: "10.05 KM · 41:12"

MODE
- Distance: pace hero + waveform from splits if any
- Workout: duration hero + HR line; waveform only if you have HR samples; otherwise omit bars rather than fake them

RULES
- Compact. No map. Solid metrics.
- pnpm run sync:stickers && pnpm run test:unit.
```

---

## 04 · elevation-ridge

```text
Implement new Scora canvas sticker `elevation-ridge`.

ID: elevation-ridge
Category: distance   // profile is for outdoor distance sports; still handle workout gracefully
supportsCustomColor: true
supportsBlackText: true
compact: false
features: { distance: true, duration: true, elevation: true, alwaysShowDuration: true, paceSpeed: false }
expectedLabels: []
paintForm: default numeric

Renderer: drawElevationRidge
Registry id: elevation-ridge

VISUAL
- Monoline elevation silhouette: filled ridge under a crisp stroke, like a mountain profile.
- Gradient fill under the ridge from translucent ink → near-zero at baseline. Stroke ~2.5px, round joins.
- No map. No chart chrome beyond one baseline if needed.

DATA
- Prefer real elevation series if available on stats (dataPoints / elevation profile). If only total elevation exists, draw a stylized single-peak ridge derived from total gain OR a simple polyline fingerprint — label it clearly as total, not fake per-km elevation.
- Never invent per-kilometer elevation samples.

LAYOUT
1) y≈280: "ELEVATION PROFILE" letter-spaced label
2) y≈380: hero "+{gain} M" (or gain unit from data)
3) Ridge geometry y≈480–620, width ~300–880 centered — fit to content, top of ridge can sit near y≈500
4) Under ridge: "10.05 KM · 41:12" style summary only with real values

MODE
- Distance: profile + distance/time summary
- Workout: if no elevation data, hide sticker content gracefully or show duration-only header and omit ridge (do not draw fake mountains). Prefer category distance so gallery filters it.

RULES
- Absolute anti-drift: do not treat tiny GPS drift as elevation for yoga/gym.
- pnpm run sync:stickers && pnpm run test:unit.
```

---

## 05 · polaroid-caption

```text
Implement new Scora canvas sticker `polaroid-caption`.

ID: polaroid-caption
Category: all
supportsCustomColor: true
supportsBlackText: true   // cream card uses dark ink in light theme
compact: true
features: { distance: true, paceSpeed: true, duration: true, alwaysShowDuration: true, title: true }
expectedLabels: []
paintForm: default numeric

Renderer: drawPolaroidCaption
Registry id: polaroid-caption

VISUAL
- Polaroid paper card (cream/off-white #F4F0E8) with a dark photo window and a caption band under it.
- This sticker is a framed memory object; slight paper feel is OK (no heavy shadows).
- Caption typography is warm sans, not industrial. Title case preferred (preferredCase: 'title').

LAYOUT
1) Card ~220–260 wide × ~250 tall, top-anchored under logo (card top ≥ 150)
2) Photo window: inset 14px, height = cardH - caption band
3) Caption band:
   - line 1: stats.title || "Morning Run" (title case)
   - line 2: "10.05 KM · 4:09 /KM" (units only) OR workout "52:18 · 176 BPM"
4) Dark ink on cream when card is present; if supportsBlackText / textColor black, keep dark ink on cream card regardless of photo.

MODE
- Distance: distance + pace in caption
- Workout: duration + HR in caption; title still shows

RULES
- The photo window is a flat placeholder rect (the real photo is the sticker's background in product). Do not draw fake scenery inside the window.
- Micro-footprint: this is a small object, not a full-bleed layout.
- pnpm run sync:stickers && pnpm run test:unit.
```

---

## 06 · constellation-run

```text
Implement new Scora canvas sticker `constellation-run`.

ID: constellation-run
Category: all
supportsCustomColor: true
supportsBlackText: true
compact: true
features: { distance: true, paceSpeed: true, duration: true, map: true, alwaysShowDuration: true }
expectedLabels: []
paintForm: default numeric

Renderer: drawConstellationRun
Registry id: constellation-run

VISUAL
- Route reduced to a night-sky constellation: few bright nodes connected by thin lines, with soft glow dots.
- Geometric monoline, not a filled map tile. Global alpha can sit ~0.85–1.0 for nodes; connectors thinner and dimmer.
- Artful but still a data sticker: metrics below, not stars everywhere.

DATA
- Use decodePolyline(stats.polyline) then downsample to 6–12 constellation nodes (even arc-length). Connect in order.
- If no polyline: skip map art entirely and show metrics only (features.map true still requires MAP metadata in contract when polyline path is coded).

LAYOUT
1) y≈280: "NIGHT ROUTE" (or stats.dayName based header if preferred)
2) Constellation block y≈360–560, centered, width ≤ 880
3) y≈620: distance hero "10.05 KM"
4) y≈650: "4:09 /KM · 41:12"

MODE
- Distance: constellation + distance/pace/time
- Workout: no polyline → metrics only (duration + HR); do not draw fake stars as a map

RULES
- Map paths remain thin geometric monoline. No map bounding box.
- Logo protection: constellation top ≥ 150.
- pnpm run sync:stickers && pnpm run test:unit.
```

---

## Registry stubs (paste-ready)

```ts
// ACTIVE_STICKER_LIST — add only when implementing
{ id: 'skyline-splits', supportsCustomColor: true, category: 'all', supportsBlackText: true, features: { distance: true, paceSpeed: true, duration: true, alwaysShowDuration: true, heartRate: true }, render: Renderers.drawSkylineSplits },
{ id: 'lab-datagrid', supportsCustomColor: true, category: 'all', supportsBlackText: true, features: { distance: true, paceSpeed: true, duration: true, alwaysShowDuration: true, heartRate: true, elevation: true }, render: Renderers.drawLabDataGrid },
{ id: 'waveform-pace', supportsCustomColor: true, category: 'all', supportsBlackText: true, compact: true, features: { distance: true, paceSpeed: true, duration: true, alwaysShowDuration: true, heartRate: true }, render: Renderers.drawWaveformPace },
{ id: 'elevation-ridge', supportsCustomColor: true, category: 'distance', supportsBlackText: true, features: { distance: true, duration: true, elevation: true, alwaysShowDuration: true }, render: Renderers.drawElevationRidge },
{ id: 'polaroid-caption', supportsCustomColor: true, category: 'all', supportsBlackText: true, compact: true, preferredCase: 'title', features: { distance: true, paceSpeed: true, duration: true, alwaysShowDuration: true, title: true }, render: Renderers.drawPolaroidCaption },
{ id: 'constellation-run', supportsCustomColor: true, category: 'all', supportsBlackText: true, compact: true, features: { distance: true, paceSpeed: true, duration: true, alwaysShowDuration: true, map: true }, render: Renderers.drawConstellationRun },
```

## Shared acceptance checklist (per sticker)

1. `getDynamicStats` used; no hardcoded data labels as values.
2. Run mode and workout mode both render without throwing and without distance/pace on workout.
3. Missing data omits rows/blocks — no `0.00` / `0:00` ghost metrics.
4. No italic fonts. No heavy shadows. Content `yTop >= 150`.
5. `pnpm run sync:stickers` then `pnpm run test:unit` green.
6. Visual accept still required in Studio before goldens (`test:e2e:visual:accept` path per qa-architecture).
