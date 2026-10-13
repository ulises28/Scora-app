# Scora Testing & Eval Documentation Hub

_One entry point for product QA, agent evals, harness, and how we improve prompts/docs._

**Audience:** anyone (human or agent) changing stickers, tests, healers, or docs.

---

## Map

| Doc | Purpose |
|-----|---------|
| **This file** | Orientation + commands |
| [`tests/e2e/docs/qa-architecture.md`](tests/e2e/docs/qa-architecture.md) | Product QA strategy (pyramid, constraints, anti-patterns) |
| [`tests/e2e/docs/suite-health.md`](tests/e2e/docs/suite-health.md) | Live gate status snapshot |
| [`tests/e2e/docs/prompt-eval-plan.md`](tests/e2e/docs/prompt-eval-plan.md) | Prompt/agent eval strategy |
| [`evals/README.md`](evals/README.md) | Eval **dataset** (cases, contracts, scoring) |
| [`evals/docs/prompt-improvement-loop.md`](evals/docs/prompt-improvement-loop.md) | Fail → improve prompt → re-run |
| [`evals/docs/code-eval-brainstorm.md`](evals/docs/code-eval-brainstorm.md) | What we measure in code (1–10) |
| [`.github/agents/`](.github/agents/) | Planner / generator / healer agents |
| Product locks | Project `MEMORY.md` Rules + specs below |

### Product specs (cross-linked)

| Spec | Locks | Tests that enforce |
|------|-------|--------------------|
| [`docs/glass-effect-specifications.md`](docs/glass-effect-specifications.md) | Zero `strokeText`, 1:1 offscreen text, continuous rim, CFS material | `glass-buffer-budget`, hero visual |
| [`docs/glass-numbers-specifications.md`](docs/glass-numbers-specifications.md) | Numbers layout, unit hug, v2 product sticker | heroes `glass-numbers` run/workout · display contract `glyphs` |
| [`docs/LESSONS-LEARNED.md`](docs/LESSONS-LEARNED.md) | Speed, no overcode, no empty cards, no silent glass rewrite | Eval cases + code grader `overcode_control` |
| [`docs/garmin-integration-plan.md`](docs/garmin-integration-plan.md) | Multi-source `NormalizedActivity` seam · official OAuth only | Garmin mapper evals + mock e2e (planned) |

---

## Hard constraints (non-negotiable)

1. **Login/OAuth is broken** — mock auth only; **R-Auth** is an open risk, not a fake test.
2. **Stickers change constantly** — goldens and contracts **follow sticker lifecycle**.
3. **Same sticker, different data by activity** — spec unit is **`(sticker × mode)`**.
4. **Auto-heal must not hide bugs** — propose-only; human accepts baselines.
5. **No overcode** — small renderers, no one-sticker frameworks.

---

## Source of truth

| Artifact | Owner |
|----------|--------|
| Display contract (what each sticker paints per mode) | `tests/e2e/fixtures/sticker-capabilities.json` via `pnpm run sync:stickers` **only** |
| Registry claims | `src/features/editor/StickerRegistry.ts` (`features`, `paintForm`) |
| Hero pixels | `tests/e2e/fixtures/heroes.json` + linux Docker goldens |
| Eval cases / expected content | `evals/cases/**` |
| Grading scale | **1–10** (code grader + model rubric + merged) |

---

## Everyday commands

```sh
# Contracts & unit
pnpm run test:unit

# E2E (mock auth, no Docker)
pnpm run test:e2e:smoke
pnpm run test:e2e:scan

# Heroes (CI-canonical goldens are linux / Docker)
pnpm run test:e2e:visual
pnpm run test:e2e:visual:accept   # explicit human accept only

# Lifecycle
pnpm run test:snapshot-audit

# Evals (1–10 + strengths/weaknesses/reasoning)
pnpm run evals
pnpm run evals:grade              # code grader
pnpm run evals:grade:all          # code + model → merged score
pnpm run evals:lang -- <files>    # TS/JS/PY/JSON validators
```

---

## Agents (`.github/agents/`)

| Agent | Job | Must follow |
|-------|-----|-------------|
| **planner** | Test plans from real UI | Mode-aware scenarios; expected outcomes |
| **generator** | Playwright specs | No `networkidle`; step comments; stable ids |
| **healer** | Fix red tests | **Never** silent baselines / bare `fixme` / hand-edit capabilities |

When an agent fails an eval, use the **[prompt improvement loop](evals/docs/prompt-improvement-loop.md)**.

---

## Quality bar (delivered product)

- [ ] Unit gate green  
- [ ] Display-contract scan green for changed stickers × modes  
- [ ] No orphan goldens (`snapshot-audit`)  
- [ ] Eval case evidence has **score /10**, **strengths**, **weaknesses**, **reasoning**  
- [ ] Merged grader recorded when code was generated (`evals:grade:all`)  
- [ ] Docs updated when a **constraint** or **contract** changes (this is the “do it more often” rule)

---

## “Improve the docs more often” — checklist

When you change behavior, also change docs in the same PR:

| Change | Update |
|--------|--------|
| New/renamed sticker | Registry + `sync:stickers` + hero list if critical |
| Paint form / metrics | `paintForm` + display contract + scan asserts |
| Healer / CI policy | `qa-architecture` §5 + healer agent + `qa-agent.sh` |
| New eval case | `evals/cases` + expected_generated_content + run live |
| New grading rule | `code-grader-rules.json` + brainstorm doc |
| Product pixel lock | Project `MEMORY.md` Rules + relevant `docs/*spec*.md` |

---

## MCP (this project)

Configured in `.mimocode/mimocode.jsonc` + global: **Playwright** (chromium/webkit/test), **GitHub**, **Vercel** (`https://mcp.vercel.com`), **fetch**, **memory**.

---

_Last docs pass: 2026-10-12._
