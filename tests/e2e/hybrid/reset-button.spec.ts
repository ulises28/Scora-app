import { test, expect } from '@playwright/test';
import { FeedPage } from '../pages/FeedPage';
import * as dotenv from 'dotenv';

/**
 * STUDY GUIDE: Environment Configuration
 * We explicitly point to .env.local because Playwright 
 * sometimes defaults to .env which might be missing your Redis keys.
 */
dotenv.config({ path: '.env.local' });

test.describe('Scora Admin: Emergency Reset Flow @regression', () => {
    let feedPage: FeedPage;

    test.beforeEach(async ({ page }) => {
        feedPage = new FeedPage(page);
    });

    test('Hybrid: Execute reset and validate backend response', async ({ page }) => {
        /**
         * 1. SETUP: Prepare API listener
         * We define the 'waitForResponse' promise BEFORE the action starts.
         * This ensures we catch the network request as soon as it fires.
         */
        const promiseResetAPI = page.waitForResponse(resp =>
            resp.url().includes('api/admin-reset') && resp.request().method() === 'POST'
        );

        // 2. ACTION: Navigate to the admin-authenticated URL
        await page.goto('/?admin=scora');
        
        /**
         * 3. EXECUTION: The 'executeAdminResetFlow' method now returns 
         * a Promise that only resolves when the FINAL success alert is accepted.
         */
        const wasHandled = await feedPage.executeAdminResetFlow(
            process.env.ADMIN_USER!, 
            process.env.ADMIN_PASS!
        );

        /**
         * 4. SYNCHRONIZATION: Wait for the API response.
         * Since the UI flow (step 3) triggered the API, the promise should 
         * be ready to resolve immediately.
         */
        const response = await promiseResetAPI;
        const json = await response.json();

        // 5. ASSERTIONS: Validate both the UI journey and the Backend logic
        expect(wasHandled, "The UI flow failed to reach the final success alert").toBe(true);
        expect(response.status(), "The API should return a 200 OK").toBe(200);
        expect(json.success, "The API JSON response should indicate success").toBe(true);
        
        console.log('Final API Payload captured:', json);
    });
});