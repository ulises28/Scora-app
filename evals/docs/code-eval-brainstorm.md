# Code Evaluation — Brainstorm (what to measure)

_Creative inventory of dimensions for grading model/agent code output.  
Scale convention: **1–10**. Pair hard detectors (auto) with soft rubrics (LLM/human)._

---

## 1. Correctness

| Check | Why it matters | How |
|-------|----------------|-----|
| **Syntax / compiles** | Broken code is 1/10 immediately | `tsc`, `eslint`, `node --check` |
| **Type safety** | `any` soup hides bugs | `tsc --strict`, count `any` / `as` casts |
| **Logical correctness** | Passes unit tests it claims to | Run the suite; golden tests |
| **Edge cases** | `null`, empty, overflow, unicode, negative, huge inputs | Property tests, fuzz, fixtures |
| **Idempotency** | Re-run ≠ chaos (healers, sync scripts) | Run twice, diff |
| **Concurrent safety** | Shared canvas/state races | Review locks; single-flight paint |
| **Error handling** | Throws vs graceful degrade | Force failures in tests |
| **Regression safety** | Did it break what already worked? | Full gate before/after |

## 2. Design & architecture

| Check | Why |
|-------|-----|
| **Cohesion** | One function = one job |
| **Coupling** | No shotgun surgery for one sticker |
| **Abstraction level** | Right-sized — not framework-for-one (overcode) |
| **Duplication vs premature DRY** | 3 similar lines > wrong base class |
| **Dependency direction** | Tests → product contracts, not the reverse |
| **Single source of truth** | Display contract / registry — no second writer |
| **API surface** | Publics minimal; internals free |
| **Extensibility without speculation** | Easy to add mode *if needed*; no plugin system unused |

## 3. Overcode / economy (your pain point)

| Signal | Bad smell |
|--------|-----------|
| LOC vs task size | 400-line “simple sticker” |
| New files for one caller | util.ts used once |
| Unused params / dead helpers | cargo-cult from a template |
| Config explosion | 12 knobs nobody sets |
| Commented-out code | Dead weight |
| Generate-then-ignore | Capabilities with metrics never painted |
| Abstract factory for 1 concrete | classic overcode |

**Metaphor:** good code is a **haiku** — every line earns its place. Bad code is a **junk drawer**.

## 4. Naming & readability

| Check | Standard |
|-------|----------|
| **Intent-revealing names** | `distanceVal` not `d` / `x1` |
| **Domain language** | `drawGlassNumbers` matches product words |
| **Consistency** | camelCase TS; SCREAMING consts; file PascalCase |
| **Pronounceable** | Say it out loud in standup |
| **Boolean names** | `hasDistance` not `flag` / `ok` |
| **Function names = verbs** | `syncStickers`, `releaseCanvas` |
| **No Hungarian** | No `strFoo`, `iCount` |
| **No shadowing** | `on` vs `on` in nested scopes |
| **Line length** | Prefer &lt;100–120 chars |
| **Nesting** | Early return; max ~4 levels |

## 5. Comments & docs

| Check | Rule |
|-------|------|
| **Why, not what** | Code already says *what* |
| **Max 2 sentences** | Per your standard |
| **No commented-out code** | Delete or `git` history |
| **Docstrings on exports** | Public API needs a sentence |
| **Changelog honesty** | “Fixed X” ≠ “Rewrote glass material” |
| **ASCII art diagrams** | Only when a picture truly helps |

## 6. Safety & secrets

| Check | Severity |
|-------|----------|
| **API keys / tokens in diff** | Critical → **1/10** |
| **PII** (email, phone, name+id) | High |
| **Command injection** | `exec` + user strings |
| **XSS** (`innerHTML` with Strava data) | High |
| **Path traversal** | file writes |
| **Prototype pollution** | `JSON.parse` merge |
| **Unsafe `eval` / `Function`** | Critical |
| **Missing auth on admin routes** | Critical |
| **ToS / license** | Don’t paste GPL into proprietary |

## 7. Performance & resources

| Check | Story |
|-------|-------|
| **Allocation discipline** | Release `width=0` canvases (Safari) |
| **N+1 paints** | Double `drawTemplate` |
| **Full-frame `getImageData`** | Measure once, cache |
| **Bundle weight** | New 200KB lib for one helper |
| **Hot path clarity** | What runs per frame vs once |
| **Big-O** | Nested loops over catalog × modes |
| **Memory leaks** | Listeners, intervals, offscreens |

## 8. Testing fit (code that *enables* tests)

| Check |
|-------|
| **Deterministic** (no `Date.now()` in asserts) |
| **Injectable clock / random** |
| **Observable** (fillText log, hooks) |
| **Testability seams** without rewriting product |
| **Fixtures complete** (mock stats like `formatActivityStats`) |
| **No hidden globals** |

## 9. Process & collaboration

| Check |
|-------|
| **Diff hygiene** | No drive-by refactors in a bugfix |
| **Commit story** | Logical steps |
| **Migrations / back-compat** | Called out explicitly |
| **Feature flags** | Only when ship is incremental |
| **Error messages actionable** | “sync:stickers” not “undefined” |
| **Telemetry** | Failures visible (TRIAGE_SIGNAL, scorecard) |

## 10. Aesthetic / product code (Scora-specific)

| Check |
|-------|
| **Pixel locks respected** (CFS glass, Montserrat v1) |
| **Mode contract** (run ≠ workout paint) |
| **Thumb vs main tiers** (SSAA, no full getImageData) |
| **Watermark docking rules** |
| **Catalog minis from single mocks** |
| **No empty sticker cards** |

## 11. LLM-output-specific

| Check | Why |
|-------|-----|
| **Hallucinated APIs** | `drawRoutePath` arity wrong |
| **Copy-paste from wrong repo** | Another product’s lint rules |
| **Scope creep** | “Fix tests” → rewrite renderer |
| **Confident wrong comments** | “This is pixel-neutral” after a layout change |
| **Stub / placeholder** | `TODO: implement` shipped as done |
| **Invented config keys** | `ignore-scripts: false` that doesn’t exist |
| **Plagiarism-ish** | Huge verbatim blocks without need |

## 12. Meta-quality (the “would I maintain this?” test)

| Question | 10/10 answer |
|----------|----------------|
| Can a junior fix a bug here in 30m? | Yes |
| Can I revert this safely? | Yes |
| Does it surprise the next reader? | No |
| Does it make the *next* task easier or harder? | Easier |
| Would I defend it in code review? | Proudly |
| If deleted, what breaks? | Only the feature it serves |

---

## Composite score recipe (1–10)

```
hard_floor   = 1 if (secret | syntax_error | critical_security) else 10
auto_score   = f(syntax, tsc, tests, loc_budget, secrets_scan)     // 0–10
rubric_score = mean( naming, readability, design, comments,
                     safety, performance, testability, overcode,
                     instruction_following, helpfulness, completeness )
final        = 0.45 * auto_score + 0.55 * rubric_score
final        = min(final, hard_floor)
```

**Report always includes:** `score /10`, `strengths`, `weaknesses`, `reasoning`, `average` (rollup across criteria).

---

## Fun / sharp detectors (creative extras)

1. **“Revert test”** — if `git revert` needs a design doc, design was too heavy.  
2. **Name taboo** — ban `data`, `info`, `temp`, `res`, `obj`, `foo` in diffs.  
3. **Comment density** — comments &gt;30% of LOC → maybe reading a novel, not code.  
4. **Identifier entropy** — mixed `snake`, `kebab`, `camel` in one module = chaos.  
5. **Prompt-to-diff distance** — asked for a one-liner, got a service? Overcode.  
6. **Silence score** — how often the agent says “I don’t know” vs invents.  
7. **Diff blame balance** — one PR touching 12 unrelated modules = shotgun.  
8. **Test-to-code sympathy** — tests that mock the thing under test 100% prove nothing.  
9. **API lie detector** — every `must` claim re-checked from the repo (already in verify-evidence).  
10. **“Would this survive a staff eng’s Tuesday?”** — gut metric, still useful.

---

## Priority for Scora harness

| Tier | Dimensions |
|------|------------|
| **P0 (fail-closed)** | secrets · syntax · critical XSS/injection · baseline cheat |
| **P1** | overcode · mode contract · single writer · unit gate · naming |
| **P2** | readability · comments ≤2 · performance/Safari · helpfulness |
| **P3** | elegance · extensibility · meta “maintainable” |

_Merge into `evals/contracts/code-grader-rules.json` incrementally — detectors first, then rubric averages._
