import { type Locator, type Page, expect } from '@playwright/test';
import { step } from '../utils/logger';

export class BasePage {
    protected page: Page;
    readonly loaderOverlay: Locator;

    constructor(page: Page) {
        this.page = page;
        this.loaderOverlay = page.locator('#loader-overlay');
    }

    @step('Navigate to App Root')
    async goto() {
        await this.page.goto('/');
    }

    @step('Ensure Loader Overlay is Hidden')
    async waitForLoaderToHide() {
        await expect(this.loaderOverlay).toBeHidden({ timeout: 10000 });
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
