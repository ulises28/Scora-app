---
description: Playwright Testing Standards (POM Architecture)
---

# Scora Playwright Standards

When writing or modifying End-to-End tests in this repository, you MUST adhere to the following strict architectural rules. **Do not vibe code.**

## 1. Page Object Model (POM) Structure
- Never write raw Playwright actions (`page.click()`, `page.fill()`) directly inside `.spec.ts` files.
- All page interactions MUST be encapsulated inside a Page Object class located in `tests/e2e/pages/`.
- Test files (`.spec.ts`) should only contain setup, Page Object method calls, and assertions.

## 2. Deterministic Locators
- NEVER use XPath or brittle CSS selectors (e.g., `div > span:nth-child(2)`).
- Prefer user-facing locators: `getByRole`, `getByText`, `getByLabel`.
- If a user-facing locator is not viable, use specific data attributes (e.g., `data-testid`).

## 3. No Hardcoded Sleeps
- NEVER use `page.waitForTimeout()`. This causes flaky tests.
- Always wait for a specific state: `expect(locator).toBeVisible()`, `page.waitForResponse()`, or rely on Playwright's auto-waiting capabilities.

## 4. API Interception & Mocking
- When dealing with 3rd-party services (like Strava OAuth), always use the `MockStravaClient` utility.
- Tests should not rely on live production services unless explicitly instructed.
