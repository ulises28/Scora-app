# Suite Health — Scora test inventory

_Start at [`TESTING.md`](../../TESTING.md) for the harness map._  
_Last audited: 2026-10-12._

## Constraints (the contract)

1. Snapshot maintenance cost must stay low.
2. Auto-heal must **not** hide bugs (no silent `--update-snapshots` / `test.fixme()`).
3. Local env first — no Docker required for the everyday loop.
4. Catalog churn (add/archive/rename stickers) must not break the suite.

---

## Source of truth (display contract)

**File:** `tests/e2e/fixtures/sticker-capabilities.json`  
**Schema:** `sticker-display-contract/v1`  
**Generator:** `pnpm run sync:stickers` (`scripts/sticker-sync.ts`) — **only writer**.  
**Do not hand-edit.** `scripts/sticker-data-agent.ts` is audit-only (opt-in `--write`).

Each sticker lists, **per activity mode** (`run` / `bike` / `workout`), **which data it displays** and **how it is painted**:

```jsonc
{
  "$schema": "sticker-display-contract/v1",
  "stickers": {
    "word-metric": {
      "modes": {
        "run": {
          "metrics": ["distance"],          // data values the canvas must show
          "labels": ["KM", "KILOMETERS"],   // unit/label tokens
          "metadata": [],                   // e.g. MAP, MAX_HR, location
          "display": { "distance": "spelled" }  // numeric | spelled | segments | glyphs
        }
      }
    }
  }
}
```

| `display` form | Meaning | How tests assert |
|----------------|---------|------------------|
| `numeric` | `fillText` of the formatted number | needle in canvas text log |
| `spelled` | number words (`spellNumber` in `src/utils/formatters.ts`) | spelled needle in log |
| `segments` | 7-seg / bar digits (not `fillText`) | require paint happened (visual for hero) |
| `glyphs` | glass liquid glyphs (offscreen) | require paint happened (visual for hero) |

**Duration paint rule (sync):** `features.duration` → asserts `time` in **workout** mode; `features.alwaysShowDuration` → also asserts `time` on **run/bike**. That matches renderers that show distance *or* duration, not both.

---

## Gate status

| Gate | Command | Status (2026-10-12) |
|------|---------|---------------------|
| Unit | `pnpm run test:unit` | **GREEN** — 207 tests, 8 files |
| E2E smoke (UI-Core) | `pnpm run test:e2e:smoke` | **GREEN** — 22/22 (back-nav contract fixed) |
| E2E registry data scan | `npx playwright test --project=Regression-API tests/e2e/ui/registry_quality_scan.spec.ts` | **GREEN** — soft asserts vs display contract |

---

## Failure classes (classified)

### A. Registry `features` over-claim vs canvas paint — **FIXED (Phase 1)**

Was: `circle-letters: Time "31M" missing` (claim ≠ paint).  
Now: duration only asserted when it must paint; `display` form handles spelled/LED/glass values.

### B. Navigation contract mismatch (Back button) — **FIXED (Phase 1)**

Product history is **feed → sticker grid → editor** (3 hops). Tests now assert stickers after first back, then feed.

### C. Orphaned visual goldens (snapshot cost) — **Phase 2**

**127 PNGs** under `tests/e2e/**/…-snapshots/`.

| Bucket | Count | Notes |
|--------|------:|-------|
| Goldens for **active** stickers | 63 | Still some value |
| Goldens for **archived / renamed / unknown** | 64 | Delete candidates |
| Project labels in filenames | 8 | several dead (`Regression-Chromium`, `Visual-Docker-Linux`, `chromium`, …) |

**Hero set is unstable:** `ACTIVE_TEMPLATES.slice(0, 5)` = registry order. Phase 2 pins a fixed hero list.

### D. Auto-heal risk — **Phase 3**

CI / `qa-agent.sh` auto `--update-snapshots` on src drift can mask pixel regressions. Must become propose-only.

### E. Dual capability generators — **FIXED (Phase 1)**

`sticker-sync.ts` is the single writer. `sticker-data-agent.ts` refuses to write without `--write`.

---

## Registry snapshot (2026-10-12)

- **ACTIVE_STICKER_LIST:** 39 (matches display contract)
- **ARCHIVED_STICKER_LIST:** 49
- Special paint forms: `word-metric` spelled, `digital-led` segments, `glass-numbers-v2` glyphs

---

## Healthy patterns already in place (keep)

- Page objects: `FeedPage` / `EditorPage` / `MockStravaClient`
- Canvas `fillText` interceptor scoped to `#storyCanvas`
- Shared `src/utils/formatters.ts` (incl. `spellNumber`) in tests
- Unit `sticker-integrity` + `glass-buffer-budget` contracts
- `sync:stickers` before unit tests

---

## Repair plan

See `.mimocode/plans/1790229481455-test-suite-repair.md` (Phases 0–5).

**Done:** 0 inventory · 1 display contract + data scan green  
**Next:** 2 shrink goldens → 3 honest healer → 4 local scripts → 5 churn contracts

---

## Everyday commands (target state)

```sh
pnpm run test:unit          # contracts + sync:stickers (no Docker)
pnpm run test:e2e:smoke     # UI-Core, no goldens required
pnpm run test:e2e:visual    # UI-Core heroes only (local goldens)  [Phase 2/4]
pnpm run test:e2e:visual:accept   # explicit baseline accept — never automatic
```

Docker (`test:sync-linux` / `docker:test`) is **optional parity**, not the practice loop.
