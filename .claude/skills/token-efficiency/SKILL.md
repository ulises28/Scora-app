---
name: token-efficiency
description: Best practices for minimizing LLM token usage and optimizing resource consumption during development and testing.
---

# Token Efficiency & Optimization Skill

To maximize project efficiency and minimize token consumption, follow these rules:

## 1. 📂 File & Context Management
- **Precise Reading**: After the initial view, always use `startLine` and `endLine` to target only the relevant code sections.
- **List before reading**: Use `list_dir` to locate files before reading them to avoid guessing paths.

## 2. ✍️ Code Editing
- **Batch Operations**: ALWAYS prefer `multi_replace_string_in_file` over individual `replace_string_in_file` calls when modifying multiple parts of the same file.
- **Minimal Diffs**: Avoid replacing large blocks of code if only a few lines change. Keep `oldString` and `newString` focused on the exact delta.

## 3. 🧪 Testing Strategy
- **Granular Execution**: Never run the full test suite when verifying a specific fix. Use:
  ```bash
  npx playwright test tests/e2e/path/to/spec.ts -g "Specific Test Name"
  ```
- **Single Worker**: Use `--workers=1` locally if the system is under load or to prevent race conditions that lead to redundant retries.
- **Headless by Default**: Ensure `--headless` is active in CI/local runs unless visual debugging is explicitly required.

## 4. 🛰️ API & Data
- **Mocking**: Prioritize the use of `MockStravaClient` (intercepting network at the Playwright level) over hitting the staging/production API to save rate-limit tokens and ensure deterministic results.

## 5. 📝 Artifacts
- **Extreme Conciseness**: Keep documentation brief. Use bullet points and avoid redundant explanations.

## 6. 🧹 Process Hygiene
- **Strict Timeouts**: Always define timeouts to prevent infinite hangs.
- **Zombie Check**: Occasionally verify no detached processes are consuming resources.
- **Manual Termination**: If a command takes 2x longer than expected, terminate it immediately and investigate.
