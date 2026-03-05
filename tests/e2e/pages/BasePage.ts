import { Page, expect } from '@playwright/test';
import { step } from '../utils/logger';

export class BasePage {
    protected page: Page;

    constructor(page: Page) {
        this.page = page;
    }

    @step('Navigate to App Root')
    async goto() {
        await this.page.goto('/');
    }

    @step('Ensure Loader Overlay is Hidden')
    async waitForLoaderToHide() {
        const loader = this.page.locator('#loader-overlay');
        await expect(loader).toBeVisible();
        await this.page.evaluate(() => {
            const el = document.getElementById('loader-overlay');
            if (el) {
                el.style.pointerEvents = 'none';
                el.style.opacity = '0';
            }
        });
        await this.page.waitForTimeout(500); // Wait for transition
    }

    @step('Inject Mock Tokens into LocalStorage')
    async injectMockAuth() {
        const mockAuth = {
            access_token: 'mock_front_access',
            refresh_token: 'mock_front_refresh',
            expires_at: Math.floor(Date.now() / 1000) + 3600
        };
        await this.page.addInitScript((auth) => {
            window.localStorage.setItem('stravaAuth', JSON.stringify(auth));
        }, mockAuth);
    }
}
