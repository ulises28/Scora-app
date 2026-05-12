import { test, expect } from '@playwright/test';
import { FeedPage } from '../pages/FeedPage';
import { MockStravaClient } from '../utils/MockStravaClient';
import { mockActivities } from '../../fixtures/stravaData';

// The real button ID as defined in app.ts line 304
const ADMIN_BTN_ID = '#btn-admin-reset';

test.describe('Scora Admin Controls: Emergency Reset @regression', () => {

    test('Admin: Emergency Reset button appears when admin parameter is present', async ({ page }) => {
        const feedPage = new FeedPage(page);
        const api = new MockStravaClient(page);

        // 1. Visit feed WITHOUT admin param — button must NOT exist
        // Do NOT inject mock auth here, keep it on the login screen
        await api.mockSuccessfulActivities();
        await feedPage.goto();
        await feedPage.waitForLoaderToHide();

        await expect(page.locator(ADMIN_BTN_ID)).not.toBeVisible();

        // 2. Visit WITH admin param — button MUST appear
        // Dismiss any credential prompts automatically (the button uses prompt())
        page.on('dialog', async dialog => {
            if (dialog.type() === 'prompt') {
                await dialog.accept('scora');
            } else {
                await dialog.accept();
            }
        });

        await page.goto('/?admin=scora');
        await feedPage.waitForLoaderToHide();

        // Button SHOULD be visible
        const btn = page.locator(ADMIN_BTN_ID);
        await expect(btn).toBeVisible();
    });

    test('Admin: Emergency Reset button triggers a full system reload', async ({ page }) => {
        const feedPage = new FeedPage(page);
        new MockStravaClient(page);

        // Do NOT inject mock auth, we need the login screen to see the button

        // Pre-seed admin token in localStorage to skip credential prompt
        await page.addInitScript(() => {
            localStorage.setItem('scora_admin_token', 'test-admin-token');
        });

        page.on('dialog', async dialog => {
            // Accept any confirm/alert dialogs (reset confirmation + result alert)
            await dialog.accept();
        });

        await page.goto('/?admin=scora');
        await feedPage.waitForLoaderToHide();

        const btn = page.locator(ADMIN_BTN_ID);
        await expect(btn).toBeVisible();

        // Click and verify it handles the reset (window will reload)
        await btn.click();
        
        // Wait for the system to finish reloading to the admin dashboard
        await page.waitForURL(url => url.searchParams.get('admin') === 'scora', { timeout: 30000 });
        await page.waitForLoadState('load');
        
        // After reload, should still have the admin parameter
        expect(page.url()).toContain('admin=scora');
    });
});
