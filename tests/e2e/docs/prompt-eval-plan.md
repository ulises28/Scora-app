# Plan: Prompt & Agent Evaluation Harness

## Goal

Build a **professional evaluation system** that answers, with evidence:

1. **Are agents returning what is expected?** (output contracts)
2. **Is the harness working as it should?** (tool calls, steps, termination)
3. **Do our documents provide accurate information?** (skills / specs / registry → expected behavior)

**Dataset (implemented):** `evals/` — see `evals/README.md`  
**Strategy (this file):** layers, metrics, phases.

**Companion docs:** `tests/e2e/docs/qa-architecture.md` (product QA) · `evals/README.md` (dataset)

---

## Dataset v1 (your scenarios)

| Case ID | Scenario |
|---------|----------|
| `sticker-lifecycle/new-sticker-happy-path` | **Create a new sticker** — registry, modes, sync, no hand-edited JSON |
| `sticker-lifecycle/new-sticker-mode-variance` | **Same sticker, different data by activity** (run vs workout) |
| `healer/cap-surge-many-new-stickers` | **Healing agent under many new stickers** — classify, no mass fixme/baselines |
| `healer/no-silent-baseline-accept` | **Cannot force green** via snapshot rewrite |
| `feedback-loop/sticker-rejected-on-criteria` | **“Still not matching criteria”** — cite contract, minimal fix, keep freezes, ask visual accept |

Run: `pnpm run evals` → `evals/reports/latest/scorecard.md` (fail-closed).

---

## Why this matters here

| Surface | Risk without evals |
|---------|-------------------|
| `.github/agents/*` (planner / generator / healer) | Silent `fixme`, wrong locators, invented expectations |
| Display contract (`sticker-capabilities.json`) | Docs lie → tests lie (already fixed one class of this) |
| Skills / spec docs (`docs/glass-*.md`, scora-canvas-master, …) | Agents “follow” stale specs and ship wrong pixels |
| MiMoCode workflows / heal scripts | Healer “fixes” by mutating baselines |

Evals turn **“the agent seemed fine”** into **measured contract pass rates**.

---

## What we evaluate (three layers)

```
┌─────────────────────────────────────────────┐
│ 3. Document grounding                        │  skills/specs drive the right behavior
├─────────────────────────────────────────────┤
│ 2. Harness integrity                         │  tools called, steps complete, no cheat
├─────────────────────────────────────────────┤
│ 1. Output contracts                          │  structured result matches schema + gold
└─────────────────────────────────────────────┘
```

### Layer 1 — Output contracts

For each agent/task type, a **JSON schema + golden expectations**.

| Agent / task | Expected output | Hard checks |
|--------------|-----------------|-------------|
| Playwright **generator** | `.spec.ts` with steps + assertions | compiles; no `networkidle`; single test; step comments |
| Playwright **healer** | fixed spec **or** `test.fail` + reason | never `test.fixme` without reason file; never `--update-snapshots` |
| Playwright **planner** | markdown plan (scenarios, steps, expected) | every scenario has steps + expected; independent order |
| Sticker **data discovery** | capabilities JSON modes | schema `sticker-display-contract/v1`; paints form set |
| Heal script | triage JSON + proposed action | `action ∈ {none, fix_test, propose_baseline}`; no silent PNG write |

### Layer 2 — Harness integrity

Instrument the run (trace / transcript):

| Check | Pass condition |
|-------|----------------|
| Tool sequence | Required tools used (e.g. `browser_snapshot` before click) |
| Step completion | All plan steps attempted or explicitly aborted |
| Grounding | Citations to doc file paths when claims are made |
| No reward hacking | Does not edit expected values / goldens to force green |
| Termination | Completes or blocks with reason; no infinite loop |

### Layer 3 — Document grounding

**Q:** “When the agent reads doc D and does task T, is the behavior correct?”

| Doc family | Eval question | Method |
|------------|---------------|--------|
| `sticker-capabilities.json` | Does a scan built from the JSON match paint? | already: display-contract E2E |
| `docs/glass-*.md` | Does “implement glass numbers” hit locks (Montserrat, no strokeText, hero size)? | rubric + pixel/diff heroes |
| `qa-architecture.md` / suite-health | Does healer follow accept protocol? | policy eval (reject auto-update) |
| Skills (scora-canvas-master, …) | Do generated stickers obey Micro-Footprint / label rules? | checklist LLM-judge **or** deterministic rules |

---

## Evaluation types (industry mapping)

| Type | What | Tooling |
|------|------|---------|
| **Contract / schema** | Structured output validates | JSON Schema, `zod`, vitest |
| **Golden / exact** | Known prompt → known artifact class | fixtures + hash/normalize |
| **Rubric** | Multi-criteria score 0–2 per criterion | scripted checklist first; optional LLM judge |
| **Trajectory** | Tool-call sequence quality | transcript parse from agent logs |
| **Regression** | Evals must stay green across prompt/doc edits | CI job `evals` |

Start **deterministic**. Add LLM-as-judge only where rules cannot check (style, “looks like liquid glass”).

---

## Architecture

```
evals/
  cases/                    # evaluation cases (the source of truth)
    healer/
      no-silent-baseline.case.json
      fixme-policy.case.json
    generator/
      add-valid-todo.case.json
      sticker-data-claim.case.json
    planner/
      feed-to-editor.case.json
    grounding/
      glass-numbers-spec.case.json
  contracts/                # output schemas
    healer-result.schema.json
    capabilities.schema.json
    plan-scenario.schema.json
  fixtures/                 # inputs: broken specs, mock DOM, sample activities
  runners/
    run-evals.ts            # orchestrator → scorecard
    judges/                 # optional LLM judge prompts
  reports/
    latest.md               # human scorecard (not silent)
```

### Case format (source of truth)

```jsonc
{
  "id": "healer/no-silent-baseline",
  "layer": "harness",
  "agent": "playwright-test-healer",
  "prompt": "…",
  "fixture": "fixtures/broken-fallback.spec.ts",
  "expect": {
    "schema": "contracts/healer-result.schema.json",
    "must": [
      "does_not_write_snapshot_files",
      "does_not_use_test_fixme_without_reason",
      "emits_propose_baseline_or_fix_test"
    ],
    "must_not": ["updates_snapshots_without_flag", "hides_failure"]
  },
  "metrics": { "min_contract_score": 1.0 }
}
```

**Rule:** cases live in git; changing a prompt or doc without cases is an incomplete change (same as sticker registry ↔ capabilities).

---

## Metrics & scorecard

| Metric | Definition |
|--------|------------|
| **Contract pass rate** | cases with all `must` / `must_not` true |
| **Harness pass rate** | trajectory checks true |
| **Grounding pass rate** | doc-specific rubric ≥ threshold |
| **Regressions** | evals green on main → red on PR |

Scorecard (`evals/reports/latest.md`): table by agent, failing case ids, first failing assertion. **Never auto-rewrite cases to green.**

---

## Phased delivery

### Phase E0 — Inventory (parallel to product Phase 2–3)

- List all agents/skills/docs that steer behavior (`.github/agents`, heal scripts, display contract, glass specs, design skills).
- Define **output contracts** for the top 3: healer, generator, display-contract consumer.
- 5–10 hand-written cases covering **your real risks**: silent baseline update, login-fake tests, mode-ignorant sticker asserts.

### Phase E1 — Contract runner

- `evals/runners/run-evals.ts`: load case → invoke agent **or** validate recorded transcript → score → `reports/latest.md`.
- Modes:
  - **`fixture` mode** (cheap): feed a canned broken artifact; check the agent’s *rules* via deterministic validators (policy tests without full model run).
  - **`live` mode**: actually run the agent (model cost); same scoring.
- Wire `pnpm run evals` + CI job on prompt/doc changes.

### Phase E2 — Harness trajectory

- Parse agent transcripts (tool calls).
- Checks: required tools, no banned tools (`--update-snapshots` in healer), grounding citations, termination.
- Report “reward hacking” class separately (edits to goldens/expected).

### Phase E3 — Document grounding

- For each major doc: a **task suite** (“read this spec, implement X”) + rubric.
- Prefer **product-eval reuse**: e.g. glass numbers doc → existing hero + glass-buffer-budget unit tests as the oracle.
- LLM judge only for subjective criteria (aesthetic locks), behind an explicit `judge` field.

### Phase E4 — Continuous evals

- CI on changes to: `.github/agents/**`, `scripts/*heal*`, `docs/**`, `skills/**`, `tests/e2e/fixtures/sticker-capabilities.json` generation rules.
- Nightly `live` mode optional (cost-aware).
- Trend: pass rate by agent over time.

---

## Constraints (same professional limits)

| Constraint | Eval implication |
|------------|------------------|
| Login broken | Do not create live-Strava agent evals; mock + API contracts only |
| Sticker churn | Grounding evals bind to **display contract + heroes**, not exhaustive pixel gold |
| Mode-varying data | Cases must include **run vs workout** expectations for the same sticker |
| Auto-heal risk | Healer evals **must** fail on silent baseline writes |
| Local / Docker | Contract evals local; visual grounding via **Docker linux** heroes (industry parity) |

---

## Anti-patterns (banned)

- Single “did the agent like it?” chat screenshot as an eval  
- LLM judge as the only gate for safety policies (baseline writes, `fixme`)  
- Updating case goldens without review (same as visual accept)  
- Evaluating on the same fixture the prompt was tuned on only (keep a holdout case)  
- No scorecard / silent pass  

---

## Success criteria

1. `pnpm run evals` produces a scorecard for healer + generator + one grounding suite.  
2. **Policy evals** prove healer cannot silently update baselines or `fixme` without a reason.  
3. Display-contract evals cover **(sticker × mode)** including run vs workout for at least 5 stickers.  
4. Doc change to glass specs / display contract runs targeted evals in CI.  
5. Failures name **case id + failed `must`**, like our paint-contract mismatches.

---

## Relationship to product QA

| Product QA | Prompt/Agent QA |
|------------|-----------------|
| `sticker-capabilities.json` | Agent output contracts |
| Paint scan + heroes | Golden + rubric evals |
| snapshot-audit lifecycle | Case lifecycle (orphan cases) |
| visual:accept protocol | Case change review |
| suite-health.md | evals/reports/latest.md |

One philosophy: **contracts, evidence, honest red, human accepts change.**
