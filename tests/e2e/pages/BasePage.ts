/**
 * Common base for all Page Objects.
 * Handles core cross-screen concerns like authentication injection and loader state.
 */
import { expect, type Page, type Locator } from '@playwright/test';
import { step } from '../utils/logger';

export class BasePage {

    //variable
    protected page: Page;
    readonly loaderOverlay: Locator;

    //constructor   
    constructor(page: Page) {
        this.page = page;
        this.loaderOverlay = page.locator('#loader-overlay');
    }

    //methods
    @step('Navigate to URL')
    async goto(path: string = '/') {
        await this.page.goto(path);
    }

    @step('Ensure Loader Overlay is Hidden')
    async waitForLoaderToHide() {
        await expect(this.loaderOverlay).toBeHidden({ timeout: 30000 });
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
            // Important: Clear cached activities so each test gets fresh data from the mock
            window.localStorage.removeItem('stravaActivities');
        }, mockAuth);
    }
}
