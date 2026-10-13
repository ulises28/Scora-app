# Prompt Improvement Loop

When an eval fails, **the prompt / case / doc is a defect**, not just the code.

## Loop (fail-closed → improve → re-run)

```
1. Run evals (pnpm run evals / evals:verify)
        │
        ▼
2. Case fails (score < pass bar OR must_not violation)
        │
        ▼
3. Classify root cause
   ├─ model behavior wrong, prompt OK     → fix code / harness
   ├─ prompt ambiguous / missing lock     → IMPROVE PROMPT (step 4)
   ├─ case expectation wrong              → fix case (review required)
   └─ doc/skill stale                     → fix doc (grounding)
        │
        ▼
4. Prompt improvement checklist
   - State the constraint explicitly (must / must_not)
   - Name the files / contracts that are the source of truth
   - Give one positive + one negative example
   - Cut fluff that invites overcode
   - Add the failure mode you just saw as a banned pattern
        │
        ▼
5. Record in evals/prompts/CHANGELOG.md
   (case id · what failed · prompt delta · new score)
        │
        ▼
6. Re-run live eval → scorecard / merged grader must improve
   (do not edit the scorecard to green)
```

## Where prompts live

| Artifact | Path |
|----------|------|
| Case prompts (`user_prompt`, `expect`) | `evals/cases/**.json` |
| Agent system prompts | `.github/agents/*.agent.md` |
| Healer policy | `scripts/qa-agent.sh`, healer agent file |
| Product contracts | `tests/e2e/fixtures/sticker-capabilities.json` (generated) |
| Style/eval guidance | `evals/docs/code-eval-brainstorm.md` |

## Expected generated content

Each case may declare `expected_generated_content`:

- `files_must_exist` / `files_must_match` (regex/strings)
- `must_not_contain` / `must_not_write`
- `must_validate_as`: `typescript` | `python` | `json` | …
- `contract_modes` (display-contract metrics)

Validators: `evals/graders/lang-validators.ts` + content matchers in the grader.

## Merged score

```
merged = 0.5 * code_grader + 0.5 * model_grader   (1–10)
```

- **code_grader** = `evals/graders/code-grader.ts` (syntax, secrets, overcode, LOC…)
- **model_grader** = rubric 1–10 (helpfulness, instruction_following, …) from the model/human

```sh
npx tsx evals/graders/code-grader.ts --json > test-results/code-grader.json
npx tsx evals/graders/merge-graders.ts --code test-results/code-grader.json --model evals/reports/latest/evidence.json
```

Hard floor: critical secret / syntax / policy violation ⇒ **1/10**.
