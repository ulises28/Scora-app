---
description: Playwright Testing Standards (POM Architecture)
---

# Scora Playwright Standards

When writing or modifying End-to-End tests in this repository, you MUST adhere to the following strict architectural rules. **Do not vibe code.**

## 1. Page Object Model (POM) Structure
- Never write raw Playwright actions (`page.click()`, `page.fill()`) directly inside `.spec.ts` files.
- All page interactions MUST be encapsulated inside a Page Object class located in `tests/e2e/pages/`.
- Test files (`.spec.ts`) should only contain setup, Page Object method calls, and assertions.

## 2. Deterministic Locators & Page Object Structure
- NEVER use XPath or brittle CSS selectors (e.g., `div > span:nth-child(2)`).
- Prefer user-facing locators: `getByRole`, `getByText`, `getByLabel`, `getByPlaceholder`.
- If a user-facing locator is not viable, use specific data attributes (e.g., `data-testid`) or centralize an ID selector.
- Use explicit types (`Locator`) for each element.
- Initialize all locators in the `constructor`. Avoid hardcoding strings if possible (use a `messages` object or constants).
- For dynamic elements (e.g., dependent on text), use a helper function that returns the locator (e.g., `getActivityCard(name)`).

### Example Page Object (Follow this template)

```typescript
import { expect, type Locator, type Page } from '@playwright/test';
import { BasePage } from './BasePage';
import { step } from '../utils/logger';
import messages from '../utils/messages'; // Evite hardcoding

export class FeedPage extends BasePage {
    // 1. Declaración de locators con tipos
    readonly authSection: Locator;
    readonly emptyStateMessage: Locator;
    readonly loginButton: Locator;
    readonly queueScreen: Locator;
    readonly queuePositionText: Locator;

    constructor(page: Page) {
        super(page);
        // 2. Inicialización en el constructor (User-Centric)
        this.authSection = page.locator('#auth-section'); // Si no hay rol, usa ID, pero centralizado
        this.loginButton = page.getByRole('button', { name: /login/i });
        this.emptyStateMessage = page.getByText(messages.feed.emptyState);
        this.queueScreen = page.locator('#screen-queue');
        this.queuePositionText = page.locator('#queue-position-text');
    }

    @step('Verify Auth Screen is Visible')
    async verifyAuthScreenVisible() {
        // Ahora el método es mucho más limpio y legible
        await expect(this.authSection).not.toHaveClass(/hidden/, { timeout: 5000 });
    }

    @step('Click Login Button')
    async clickLoginButton() {
        await this.loginButton.click();
    }

    // 3. Manejo de elementos dinámicos (Activity Cards)
    // Para elementos que dependen de un texto, usamos una función que devuelva el locator
    getActivityCard(activityName: string): Locator {
        return this.page.locator('.activity-card', { hasText: activityName });
    }

    @step('Verify Activity Card is Visible')
    async verifyActivityRendered(activityName: string, expectedStatsText: string) {
        const card = this.getActivityCard(activityName);
        await expect(card).toBeVisible();
        await expect(card.locator('.card-meta')).toContainText(expectedStatsText);
    }
}
```


## 3. No Hardcoded Sleeps
- NEVER use `page.waitForTimeout()`. This causes flaky tests.
- Always wait for a specific state: `expect(locator).toBeVisible()`, `page.waitForResponse()`, or rely on Playwright's auto-waiting capabilities.

## 4. API Interception & Mocking
- When dealing with 3rd-party services (like Strava OAuth), always use the `MockStravaClient` utility.
- Tests should not rely on live production services unless explicitly instructed.
