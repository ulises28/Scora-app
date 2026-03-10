import { test, expect } from '@playwright/test';
import { FeedPage } from '../pages/FeedPage';
import { MockStravaClient } from '../utils/MockStravaClient';

test.describe('Scora App UI: Storage & Strava Edge Cases', () => {

    test('Test 1: App strictly falls back to Strava Auth immediately if local storage is missing', async ({ page }) => {
        const feedPage = new FeedPage(page);

        // Go straight to page without injecting Auth
        await feedPage.goto();

        // The Scora app is built specifically to present the auth link
        // if local bounds are completely cleared. Wait for Strava login button
        const loginBtn = page.getByRole('button', { name: /Conectar con Strava/i });
        await expect(loginBtn).toBeVisible();
    });

    test('Test 2: If Strava API returns 0 activities (empty array), feed shows blank slate', async ({ page }) => {
        const feedPage = new FeedPage(page);
        const api = new MockStravaClient(page);

        await feedPage.injectMockAuth();

        // Intercept Strava to send back ZERO activities!
        await api.mockEmptyActivities();

        await feedPage.goto();
        await feedPage.waitForLoaderToHide();

        // Feed should be empty, no errors
        const feedTitle = page.locator('.activity-card');
        await expect(feedTitle).toHaveCount(0);

        // App should display no activities text
        const emptyMsg = page.getByText(/No hay entrenamientos recientes./i);
        await expect(emptyMsg).toBeVisible();
    });

    test('Test 3: If Strava API returns exactly 1 activity, feed renders it cleanly', async ({ page }) => {
        const feedPage = new FeedPage(page);
        const api = new MockStravaClient(page);

        await feedPage.injectMockAuth();

        // Return exactly one single activity
        await api.mockSingleActivity();

        await feedPage.goto();
        await feedPage.waitForLoaderToHide();

        const feedCards = page.locator('.activity-card');
        await expect(feedCards).toHaveCount(1);
    });

});
