import { test } from '@playwright/test';

/**
 * Decorator that automatically wraps Page Object methods inside a `test.step` block.
 * This makes the Playwright HTML report extremely readable.
 * 
 * Usage:
 * @step("Click login button")
 * async clickLogin() { ... }
 */
export function step(stepName: string) {
    return function decorator(target: any, context: ClassMethodDecoratorContext) {
        return function replacementMethod(this: any, ...args: any[]) {
            return test.step(stepName, async () => {
                return await (target as Function).call(this, ...args);
            });
        };
    };
}
