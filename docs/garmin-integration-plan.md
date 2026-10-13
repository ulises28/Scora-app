# Garmin Integration Plan

_Status: draft · Scope: official Garmin Connect as the primary non-Strava source · Companion: [`TESTING.md`](../TESTING.md)_

---

## 1. Goal

Let Scora users **connect Garmin Connect** and turn Garmin activities into stickers, with the same quality bar as Strava:

- Same sticker engine (1080×1920, registry, display contract)
- Same mode rules (**run / bike / workout** → different metrics)
- Same QA discipline (contracts, mocks, evals 1–10, honest healer)

**Non-goals (v1):** two-way sync (push workouts to Garmin), live device streaming, Health Connect / Apple Health (separate adapters later).

---

## 2. Why official API (not unofficial scrapers)

| Path | Verdict |
|------|---------|
| **Garmin Connect Developer Program** | **Production path** — OAuth + activity data |
| Unofficial npm clients (`@dofek/garmin-connect`, `ts-garmin`, …) | Spike / QA fixtures only |
| Health SDK / FIT dump | Later (local devices / offline import) |

Start the **developer program application immediately** — it is the critical path.

---

## 3. Target architecture

```text
┌─────────────────┐   ┌─────────────────┐
│  Strava OAuth   │   │  Garmin OAuth   │
└────────┬────────┘   └────────┬────────┘
         │                     │
         ▼                     ▼
   StravaAdapter          GarminAdapter
         │                     │
         └──────────┬──────────┘
                    ▼
           NormalizedActivity
           (id, type, distance_m, moving_time_s,
            avg/max_hr, polyline, start_time, location…)
                    │
                    ▼
            formatActivityStats()
                    │
                    ▼
         Feed · Sticker grid · Editor · Export
```

### 3.1 `NormalizedActivity` (single seam)

| Field | Notes |
|-------|--------|
| `source` | `'strava' \| 'garmin'` |
| `sourceId` | Stable id for cache keys |
| `sport` | Mapped to display types (Run, Ride, Workout, …) |
| `distanceMeters`, `movingTimeSeconds` | Required for distance sports |
| `hasDistance` | Computed like Strava path |
| `polyline` / `coords` | Optional; map stickers |
| `avgHeartrate`, `maxHeartrate` | Optional |
| `startLocal`, `timezone` | Date / stamp stickers |
| `locationCity`, `locationRegion` | Location stickers |
| `title` | Activity name |

**Rule:** renderers never see Garmin DTOs — only `StickerStats` after `formatActivityStats`.

### 3.2 Files (proposed)

```text
src/api/sources/types.ts          # NormalizedActivity
src/api/sources/strava-adapter.ts # wrap existing strava.ts
src/api/sources/garmin-adapter.ts # new
src/api/sources/index.ts          # listSources(), connect(source)
src/api/garmin.ts                 # OAuth + REST (mirror strava.ts shape)
tests/fixtures/garminData.ts      # mock activities (evals + e2e)
tests/e2e/utils/MockGarminClient.ts
```

---

## 4. Garmin Connect Developer Program

1. **Apply** for Garmin Connect Developer Program (business + use cases: “social share stickers from activities”).  
2. Register app → **OAuth client** (redirect URI matches Vercel + localhost).  
3. Confirm scopes needed: **activity read** (list + detail). Avoid write scopes in v1.  
4. Document **rate limits** and daily pull caps in ops notes.  
5. Store secrets like Strava (`VITE_GARMIN_CLIENT_ID/SECRET` or server-only — prefer **server** for secrets).

**Parallel:** implement adapter against **fixture JSON** so product work is not blocked.

---

## 5. Auth & session (mirror Strava lessons)

| Concern | Plan |
|---------|------|
| Popup OAuth | Same pattern as Strava (`strava-login-btn` style) |
| Cancel / abandon | Always release lock + close popup (`queue-leave` analogue if you reuse single-athlete lock) |
| Token refresh | Server-side; never ship secrets in the SPA |
| Account linking | User may have **both** Strava + Garmin; UI: source switcher on feed |
| Single-athlete limit | Product decision: Garmin is **additional source**, not a second global lock — or same queue keyed by `source` |

**Test:** mock OAuth in Playwright (no live login in CI — **R-Auth** rule).

---

## 6. Activity mapping (sport → display contract)

| Garmin sport | `type` / `hasDistance` | Stickers |
|--------------|------------------------|----------|
| running, trail_run, treadmill | Run + distance | distance, pace, map if polyline |
| cycling, virtual_ride | Ride + distance | distance, speed, map |
| strength_training, hiit | Workout + no distance | duration, HR |
| walking, hiking | Walk/Hike + distance | like run |
| unknown | Fallback duration-first | avoid empty cards |

**Mode matrix:** every sticker still tested **run vs workout** (existing `sticker-capabilities.json` rules).

**Polyline:** if Garmin only gives tracks (lat/lng), encode Google polyline in the adapter so map stickers stay unchanged.

---

## 7. Product UX (v1)

1. Login screen: **“Continue with Strava”** + **“Connect Garmin”** (when enabled).  
2. Feed: source badge (STRAVA / GARMIN) optional.  
3. Grid + editor: **unchanged**.  
4. Config flag `VITE_FEATURE_GARMIN=true` for staged rollout.  
5. README / TESTING.md update when shipped.

---

## 8. Testing & evals (reuse the harness)

| Layer | What |
|-------|------|
| **Fixtures** | `tests/fixtures/garminData.ts` — run, ride, strength (same shape as `stravaData`) |
| **Unit** | Mapper: Garmin DTO → `NormalizedActivity` → `formatActivityStats` |
| **Display contract** | Existing scan; add cases `garmin/run` vs `garmin/workout` evidence |
| **E2E** | `MockGarminClient` + feed/editor smoke (mock auth) |
| **Evals** | Cases: `garmin/adapter-mapping`, `garmin/oauth-cancel`, `garmin/mode-variance` |
| **Code grader** | Adapter LOC budget; no secrets; no unofficial API in prod paths |

**New eval case sketch** (`evals/cases/garmin/`):

```jsonc
{
  "id": "garmin/adapter-mapping",
  "expected_generated_content": {
    "files_must_exist": ["src/api/sources/garmin-adapter.ts", "tests/fixtures/garminData.ts"],
    "must_validate_as": ["typescript"],
    "contract_modes": { "run": ["distance"], "workout": ["time"] }
  }
}
```

---

## 9. Security & compliance

- Secrets server-side; no keys in client bundles  
- Minimize scopes (read activity only)  
- User delete / disconnect = revoke token + purge cached activities  
- Brand guidelines (Garmin) for “Connect with Garmin” button  
- Rate-limit backoff; never scrape Connect web  

---

## 10. Rollout phases

| Phase | Deliverable | Exit |
|-------|-------------|------|
| **G0** | NormalizedActivity + Strava adapter extract (no UI change) | Unit green; Strava e2e unchanged |
| **G1** | Garmin fixtures + mapper + evals | Mapper evals ≥ 8/10 |
| **G2** | OAuth (dev app) + feed source switch | Mock e2e green |
| **G3** | Staged flag + staging Vercel | Manual QA + coach pilot |
| **G4** | Production | Legal/brand review; monitoring |

---

## 11. Risks

| Risk | Mitigation |
|------|------------|
| Developer program delay | G0–G1 ship without Garmin prod API |
| API shape / rate limits | Adapter isolation; fixture-driven tests |
| Sport taxonomy mismatch | Mapping table + eval cases per sport |
| Auth complexity (two providers) | Shared popup/lock patterns; e2e cancel tests |
| Scope creep | v1 = **read activities → stickers** only |

---

## 12. Success criteria

1. User connects Garmin and sees **accurate** stickers (distance vs workout correct).  
2. No secrets in the client; OAuth cancel does not deadlock the app.  
3. Display-contract scan green for Garmin-sourced fixtures.  
4. Eval scorecard includes Garmin cases with **1–10** + strengths/weaknesses/reasoning.  
5. Strava path regression-free.

---

## 13. Immediate next actions

1. **Submit Garmin Connect Developer Program application** (owner).  
2. G0: extract `NormalizedActivity` behind existing Strava calls.  
3. Author `tests/fixtures/garminData.ts` + mapper tests.  
4. Draft OAuth UI (hidden behind flag).  
5. Add `evals/cases/garmin/` once mapper exists.

---

_Append API console URLs, rate-limit numbers, and legal sign-off here after the developer program approval._
