> Start at [`TESTING.md`](../TESTING.md) for the full harness map.

# Prompt / Agent Eval Dataset

**Source of truth for what “good” looks like** when we change prompts, agents, heal scripts, or guiding docs.

Companion strategy: `tests/e2e/docs/prompt-eval-plan.md`

## Layout

```
evals/
  cases/                 # one JSON per scenario (the dataset)
    sticker-lifecycle/   # create new sticker (happy + mode variance)
    healer/              # heal under stress (catalog surge, baseline policy)
    feedback-loop/       # user rejects output on established criteria
  contracts/             # JSON Schemas for cases + agent results
  fixtures/              # canned inputs (broken specs, surge state)
  reports/               # scorecards (never auto-rewritten to green)
```

## Scenarios in this dataset (v1)

| ID | Question it answers |
|----|---------------------|
| `sticker-lifecycle/new-sticker-happy-path` | What happens when we **create a new sticker**? |
| `sticker-lifecycle/new-sticker-mode-variance` | Does it handle **same sticker, different data by activity**? |
| `healer/cap-surge-many-new-stickers` | What does the **healing agent do under a flood of new stickers**? |
| `healer/no-silent-baseline-accept` | Can it **force green** by rewriting goldens? |
| `feedback-loop/sticker-rejected-on-criteria` | What happens when **we say it still doesn’t match criteria**? |

## Case format

See `contracts/prompt-eval-case.schema.json`. Core fields:

- `user_prompt` / `prior_turns` — the conversation under test  
- `context.docs` — documents the agent must ground in  
- `expect.must` / `expect.must_not` — **hard contract** (deterministic)  
- `pass_bar` — score threshold  
- `eval_methods` — deterministic checks + optional rubric  

## Scoring model

```
score = w_contract * contract + w_harness * harness + w_grounding * grounding
```

Default weights: contract 0.5 · harness 0.2 · grounding 0.3 (override per case).

**Fail-closed policies** (must_not) are binary: one violation ⇒ case **fail** (critical: silent baseline write, capabilities hand-edit, `fixme` sink).

## Modes

| Mode | What runs | When |
|------|-----------|------|
| **fixture** | Score a recorded transcript / PR diff against `must` / `must_not` | every PR touching agents/docs |
| **live** | Actually invoke the agent, then score | nightly or on demand (cost) |

## Run

```sh
pnpm run evals              # fixture mode → evals/reports/latest.md
pnpm run evals:live         # optional live mode
```

## Change management

Same discipline as visual heroes:

- Changing `must` / `must_not` is a **contract change** — review it.  
- Never edit a report to look green.  
- Add a case when a **new failure mode** appears (like we add a paint-contract mismatch).  

## Anti-patterns (banned)

- “The agent sounded confident” as a pass  
- LLM judge as the only gate for baseline/fixme policy  
- Tuning prompt on a case and scoring on that same case only (keep holdout)  
- Silent deletion of failing cases  
