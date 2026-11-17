# Weekly Summary — Plan (locked 2026-11-17)

## Goal
A **separate weekly section** (never mixed with workout stickers), entered via a button on the
home feed. User picks a weekly sticker, then configures: sport filter, day range (max 7 days),
colour. Renders shareable 1080x1920 stickers.

## Locked decisions (from user + MEMORY.md)
- Button sits on home feed **between** "Selecciona una actividad para crear tu sticker." and the first activity card.
- Button opens a **new weekly stickers page** -> pick sticker -> edit (colour / days / sports).
- Inline feed control-panel is REJECTED (delete `WeeklyOverlays.ts` + `#weekly-overlay-section`).
- Weekly and regular stickers are NEVER mixed in one catalog/flow.
- Sport filter: **all | run | ride | workout** (user: "group them only if it was running, or riding or workout or all together").
- Day range: contiguous, **max 7 days**. Mon->Sun or Mon->Wed OK, **Mon->Mon invalid** (8 days).
- Never display invented calories (Strava list payload has none). CAL only when real.
- Mock data must place **multiple activities on the same date** (grouping testable).
- P0 visual gate: render over `qa-backdrops/` photos and LOOK at the PNG before declaring done.
- Replicate inspiration STYLE, not pixel-copy.
- No push/deploy without explicit user "push".

## Config controls (user 2026-11-17)
1. Day of the week -> **start weekday + end weekday** (range, <= 7 days)
2. Workouts to show -> **All / Run / Ride / Workout** (single-select)
3. Colour -> existing custom-colour palette
4. Days to be displayed -> same as (1), max 7

## Phases
### P0 Cleanup
- Delete `src/components/WeeklyOverlays.ts`, `#weekly-overlay-section` markup + its CSS.
- Keep `src/utils/weeklyOverlay.ts` (+ tests) as the data layer.

### P1 Home entry point
- Add button "Resumen semanal" in `index.html` between intro and `#activity-list`.
- Wire -> `screen-weekly` (new screen).

### P2 Weekly section screen
- `screen-weekly`: grid of weekly sticker designs (mock minis, no full render on open).
- Tap sticker -> `screen-weekly-editor` with live preview + config controls.
- Back button returns to weekly grid, then home.

### P3 Config controls
- Sport chips: All / Run / Ride / Workout.
- Day range: two weekday selects, validation blocks >7 days.
- Colour: reuse existing `supportsCustomColor` picker.
- Re-render preview on every change (debounced).

### P4 Sticker renders
- `weekly-summary` (minimalist: hero total + per-day rows) — unhide for weekly section only.
- `day-recap` / grouped-activities card (Share Aura style: date header + stacked activities) — unhide for weekly section only.
- Both live in a **weekly-only** registry list.

### P5 Data + QA
- Aggregate from `lastActivities` via `aggregateWeek`.
- Mock fixtures with same-date multi-activity days.
- Visual QA over `qa-backdrops/`.

### P6 Tests
- Unit: `validateDayRange`, `aggregateWeek`, sport filter.
- E2E: home button -> weekly -> pick -> configure -> export.

## Out of scope
- New API endpoints (use existing Strava list data).
- Auto-posting queue integration for weekly stickers (follow-up).
