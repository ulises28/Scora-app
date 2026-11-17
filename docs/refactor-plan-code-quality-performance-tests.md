# Refactor Plan — Code Quality · Performance · Test Suite

**Branch:** `refactor/code-quality-performance-tests`  
**Status:** planning · **Date:** 2026-10-13  
**Rules that bind this plan:** [`docs/LESSONS-LEARNED.md`](../docs/LESSONS-LEARNED.md) (no broken stickers, no overcode, pixel locks) · [`TESTING.md`](../TESTING.md) · project `MEMORY.md`

---

## 0. Goals (in priority order)

| Priority | Goal | Success metric |
|----------|------|----------------|
| **P0** | **No visual regressions** | Heroes + user QA still match accepted looks |
| **P1** | **Perceived performance** (Safari / iPhone) | Editor open &lt; 1s feel; no “significant memory” reload on normal flow |
| **P2** | **Maintainable code** | Smaller modules, one paint path, fewer dead ends |
| **P3** | **Test suite leverage** | Faster gates; contract coverage; no flake from churn |

**Hard constraints**

- Sticker **pixels** stay locked unless the user explicitly changes a look.  
- **Do not overcode** — prefer copy/extract over new frameworks.  
- Login/OAuth still **R-Auth** (mock tests only).  
- Catalog churn continues — tests must stay **id/mode**-driven.

---

## 1. Current state (evidence)

| Area | Smell | Impact |
|------|--------|--------|
| `CanvasPainter.ts` | ~10k+ LOC, many `draw*` in one file | Merge pain, slow edits, hard tests |
| `drawTemplate` / measure+refit | Double paint + full-frame `getImageData` | Editor lag (known P0 in memory) |
| Glass pipeline | Multiple full-size offscreens per draw | Safari memory reload |
| `getDynamicStats` | Returns partial shape; modes implicit | Easy to ship wrong workout layout |
| Registry vs renderer | Features flags vs actual paint | Over-claims (display contract helps) |
| Tests | Unit green + good contract scan; visuals hero-only | E2E mock path OK; heavy canvas still unit-light |
| Docs | Strong after this week’s pass | Keep in sync with refactors |

---

## 2. Target architecture (modest, not a rewrite)

```text
src/features/editor/
  CanvasPainter.ts          # drawTemplate orchestration ONLY (thin)
  stickers/                 # one file per sticker family (or group of 5–10)
    glassNumbers.ts
    digitalLed.ts
    …
  GlassText.ts              # keep (CFS material — frozen)
  CanvasUtils.ts            # shared metrics, polyline, fit
  registry.ts               # StickerRegistry + types
src/utils/
  catalogMocks.ts           # already SSOT for minis
  formatters.ts
```

**Principle:** *extract, don’t invent.* No plugin frameworks, no base-class hierarchy for 39 stickers.

---

## 3. Workstreams

### A. Performance (P1)

| ID | Change | Do not | Verify |
|----|--------|--------|--------|
| **A1** | Single paint on select: skip measure pass when `boundsFillFrame` or thumb path | Change `fitBoundsTransform` math | Time `openEditor` before/after |
| **A2** | Cache `getContentBounds` per (template, stats hash, colors) | Cache across different mocks blindly | Unit + no pixel drift on heroes |
| **A3** | Glass buffer reuse pool (same size) + always `releaseCanvas` | Lower SSAA or rim steps on main | `glass-buffer-budget` tests |
| **A4** | Font load once; chrome waits on `Matemasie` only | Remove sticker faces | No wrong-font flicker |
| **A5** | Lazy `import()` editor/canvas stack | Break Vite preview / Capacitor | Bundle size + first paint |

**Baseline metrics to record first** (script `scripts/perf-bench.mjs` or Playwright trace):

- T_open_editor (mock activity, default sticker)  
- T_switch_template (p50)  
- Peak heap / canvas pixels on grid open  
- LCP / script bytes (vite build --metafile)

### B. Code quality (P2)

| ID | Change | Notes |
|----|--------|--------|
| **B1** | Split `draw*` out of CanvasPainter by **family** (glass, LED, map, word, chrome) | Mechanical moves; re-export for compat |
| **B2** | `NormalizedActivity` seam (Garmin plan G0) | Strava first; no UI change |
| **B3** | Kill dead code (`drawPureMap`, unused archivals stay in ARCHIVED only) | After grep confirms unused |
| **B4** | Standardize stats contract: single `resolveDisplayMetrics(stats)` | Workout vs distance in one place |
| **B5** | Naming: `drawX` + `getDynamicStats` types documented | Small TS interfaces, no classes |

**Explicit non-goals:** React/Vue rewrite, WebGL liquid glass, micro-frontends.

### C. Test suite (P3)

| ID | Change | Why |
|----|--------|-----|
| **C1** | Perf smoke: budget assert on `glass-buffer-budget` + a new **paint-cost** unit (fillText count / offscreen count) | Catch Safari regressions |
| **C2** | Mode-matrix unit for `resolveDisplayMetrics` (run/bike/workout) | Same sticker, different data |
| **C3** | Visual: keep **heroes only**; add `digital-led` + `glass-numbers-v2` after user accepts pixels | P0 gate |
| **C4** | E2E: drop remaining screenshot asserts outside heroes (data contract instead) | Churn-proof |
| **C5** | Cap-surge stress in CI **optional nightly** (apply/revert fixture) | Healer honesty |
| **C6** | Code grader on PRs (`--base origin/master`) | Overcode + secrets |

---

## 4. Phased rollout

```text
Phase R0  Baseline          metrics + snapshot-audit + unit green
Phase R1  Safety net        C1–C2 tests first (before moving code)
Phase R2  Extract           B1 module split (no behavior change)
Phase R3  Perf              A1–A3 (pixel-locked; heroes after each)
Phase R4  Seam              B2 NormalizedActivity + B4 metrics resolver
Phase R5  Cleanup           B3 dead code, docs, grader in CI
```

Each phase = **one PR**, green gates, **visual check** for any sticker touch.

---

## 5. Order of operations (first PR on this branch)

1. **Record baselines** (`scripts/perf-bench.mjs` stub + document numbers in `tests/e2e/docs/suite-health.md`).  
2. **C2** unit tests for metrics by mode (protects refactors).  
3. **B4** extract `resolveDisplayMetrics` used by 2–3 stickers (prove the seam).  
4. Stop. Review with you before mass extract (B1).

---

## 6. Risks

| Risk | Mitigation |
|------|------------|
| Pixel drift during extract | Heroes + “look at the sticker” rule (P0 lesson) |
| Over-refactor | LOC budgets; code grader; no new abstractions without 2+ call sites |
| Perf work breaks glass look | A3 isolated; never change CFS steps |
| Test churn | Contract-first; pinned ids; mock auth |

---

## 7. Definition of done

- [ ] Perf baselines recorded and improved (or explicitly unchanged where N/A)  
- [ ] `CanvasPainter` orchestration-only or clearly scoped; stickers modular  
- [ ] Display metrics resolver is the only workout/distance branch used by stickers we touched  
- [ ] Unit + scan + heroes green; **user visual OK** for any sticker PR  
- [ ] `TESTING.md` / LESSONS updated  

---

## 8. Decision needed from you

1. **Split style for `CanvasPainter`:** by **family** (glass / led / map…) or **one file per sticker**? (Recommend family — fewer files, matches overcode rule.)  
2. **First sticker family to extract** after the metrics seam: **glass** (high risk) or **digital-led** (recently stabilized, smaller)?  
3. Allow **A5 lazy import** in Phase R3 (bundle win, slight boot complexity)?

---

_Plan only on this branch until we agree on §8 — then implement Phase R0–R1 first._
