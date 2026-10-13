# Lessons learned — Scora stickers / Safari (read before acting)

Last updated: 2026-10-13

> **Related:** [TESTING.md](../TESTING.md) (harness hub) · [qa-architecture](../tests/e2e/docs/qa-architecture.md) · [glass-effect](./glass-effect-specifications.md) · [glass-numbers](./glass-numbers-specifications.md) · [evals README](../evals/README.md)  
> When a lesson is a **hard product lock**, also add it under project `MEMORY.md` ## Rules so every session enforces it.

## CRITICAL — never ship a broken sticker (2026-10-13)

**User: “It is unacceptable to launch to prod a broken sticker.”**

A `digital-led` rewrite was pushed with digits overlapping / unreadable. That must never happen again.

### Hard quality gate (before any `push` of sticker/canvas changes)

1. **Visual proof** — render or screenshot the sticker and **look at it** (editor preview, hero test output, or Playwright screenshot). Unit green ≠ pixels OK.
2. **Pixel changes require explicit accept** — `pnpm run test:e2e:visual` for the hero (or human review) **before** `git push`.
3. **One style change per pass** — do not stack “font + color + spacing + material” rewrites. If the user asks for slashes, change **only** the date format.
4. **Never “restore” a look from memory** — copy a **known-good** function from git (`git show <sha>:path`) or a user-accepted screenshot; do not invent new geometry mid-fix.
5. **Broken on screen = stop** — revert or restore, do not ship, do not push, do not “iterate” three more designs in the same push.
6. **Layout contracts stay explicit** — units hug digits (`KM` / `/KM` right under the number); row gaps only after the user confirms the look.

### If a broken sticker already shipped

- Treat as **P0 product bug**, not polish.
- Restore the last good render **first**, then re-apply the requested delta only.
- Push the restore immediately after **visual** confirmation.

## Coding guideline — speed & correctness first (user mandate)

> **The app must run fast and right. UI speed > aesthetics. Do not overcode.**

1. **Prefer the simplest code that works** — no speculative abstractions, no extra layers, no rewrite of working visuals.
2. **Measure before changing algorithms** — especially glass/canvas. If unsure, leave the look alone.
3. **Render once, reuse** — mock minis, cache bitmaps, no re-paint on every navigation.
4. **Never leave empty UI** — a cell must show something (mini, name, or last-known image). Blank = bug.
5. **Cap work per frame** — serialize heavy canvas jobs; thumbs are small and light.
6. **One change at a time** — no multi-pipeline “fixes” in the same pass.
7. **Testing evals must not redesign product stickers** unless the case is explicitly a product task — scope to `evals/` + `tests/` otherwise.

## Product rules (do not violate)

1. **Never push to prod without an explicit user "push"** — even "commit and push" after the fact does not authorize a later push.
2. **Do not redesign working stickers.** If glass-numbers looked good, change only what the user asked (e.g. font, size, km gap). Never swap the glass pipeline for "faster" unless the user asks after a measured Safari issue.
3. **Minis / grid previews must look like the real sticker** — fixed mock design (392caf6 style). Same run mock for distance/map stickers; **workout mock (no distance, no map)** for workout stickers.
4. **No empty placeholder cards** ("GLASS NUMB" text boxes). If unsure, show a real mini or a single fixed mock render — never blank.
5. **glass-numbers (v1) + glass-numbers-v2** are the iOS liquid-glass numbers. Both must keep glass look + `km` **below** the digits (never mid-digit).
6. **digital-led** = readable digital watch 7-segment: `MM/DD/YY` slashes, ghost off-segments, units hug numbers, rows must not overlap.

## Technical root causes (do not reintroduce)

| Symptom | Cause | Do |
|---|---|---|
| Safari multi-second stall on glass | 48–256 `fillText` of 1000px+ glyphs on multiple full-size offscreens + blur | Keep **one** offscreen + **6 fillText** (`f0c6f71` / `312d5ac` layering). No SSAA>1, no rim orbit. |
| km over the numbers | Unit `Y` used `actualBoundingBoxDescent` or a fixed `1080` | Unit Y = `heroY + (ascent+descent)/2 + gap` (half glyph height) |
| Chrome font flaky | Canvas paint before `document.fonts.ready` | `await document.fonts.load` + `fonts.ready` before paint |
| Chrome thumb = silver plaque / wrong | WebGL chrome on thumbs; `toDataURL` before async metal | Thumbs: sync chrome letterforms only |
| Empty minis | snapshot `toDataURL` raced async WebGL; ids missed thumb path | Mock `drawTemplate` minis (fixed stats), rAF stagger |
| Queue lock stuck after Cancel | `admin-reset` needs auth; join lock TTL 120s | `POST /api/queue-leave` with sessionId on Cancel |
| Admin button "gone" | Injected only into hidden `auth-section` | Fixed pin when `?admin=scora` |

## Glass reference (keep)

- **Look you approved (`312d5ac`)**: Compensated Faux-Stroke glass (dense core + rim + bevels) on `drawGlassNumbers` / `GlassText.drawLiquidGlyphs`.
- **Layout**: date top, hero digits big (tall, `aspectScaleX ≈ 0.22`), unit close under digits.
- **Font v1**: Montserrat 300/400 (not Inter). **v2**: Outfit 300.
- **Minis**: `MOCK_MINI` (run 10.05 km + map stickers) vs `MOCK_MINI_WORKOUT` / `WORKOUT_MOCK` (52m / 176 BPM, no distance/map).

## Verification checklist (before saying "done")

1. `npx tsc --noEmit` + `pnpm run build`
2. Local `vite preview`: glass-numbers **and** v2 look like glass (not blur/outline), km below digits
3. Grid: run stickers show map mock; workout stickers show **workout** mock (no map)
4. Chrome thumb is chrome type, not a gray box
5. Safari: selecting glass must not freeze; if slow, profile **before** changing the glass algorithm
6. **Stop** — wait for user "push"

## Session thrash log (anti-patterns)

- Swapping glass pipeline (fast text / gray extrusion / empty fill) destroyed the look → **restore `312d5ac` glass only**
- Placeholder design cards → user: "what happened to the images"
- Pushing without authorization → user: "why push!?"
- Fixing `km` with `descent` put it in the **middle** of the glyphs → use **half-height**
