import { test, expect } from '@playwright/test';
import { MockStravaClient } from '../utils/MockStravaClient';
import { FeedPage } from '../pages/FeedPage';

test.describe('Scora App: API Network Intercepts (POM)', () => {

    test('Test 6: Handles API 401 Unauthorized (Expired Token) Gracefully', async ({ page }) => {
        const api = new MockStravaClient(page);
        const feedPage = new FeedPage(page);

        // 1. Setup mock session and fake 401 response from Strava
        await feedPage.injectMockAuth();
        await api.mockUnauthorizedError();

        // 2. Navigate to app
        await feedPage.goto();

        // 3. Ensure loading overlay hides so we can see the result
        await feedPage.waitForLoaderToHide();

        // 4. Verify the App caught the 401 and dropped us back to the Start boundary
        await feedPage.verifyAuthScreenVisible();
    });

    test('Test 7: Handles Empty Activity State (0 Runs)', async ({ page }) => {
        const api = new MockStravaClient(page);
        const feedPage = new FeedPage(page);

        // 1. Setup mock session and fake an empty [] response from Strava
        await feedPage.injectMockAuth();
        await api.mockEmptyActivities();

        // 2. Navigate to app
        await feedPage.goto();
        await feedPage.waitForLoaderToHide();

        // 3. Verify the "Empty State" message is rendered cleanly
        await feedPage.verifyEmptyStateMessage();
    });

    // ─── Test 8: Auto-Logout correctly clears stravaAuth from localStorage ────
    test('Test 8: Auto-Logout clears stravaAuth from localStorage after data fetch', async ({ page }) => {
        const api = new MockStravaClient(page);
        const feedPage = new FeedPage(page);

        // 1. Seed a mock session (simulates a previously logged-in user)
        await feedPage.injectMockAuth();

        // 2. Mock a successful activities response and the deauth call
        await api.mockSuccessfulActivities();
        // strava-deauth is already universally mocked in MockStravaClient constructor

        // 3. Navigate to the app and wait for the feed to settle
        await feedPage.goto();
        await feedPage.waitForLoaderToHide();
        await feedPage.verifyActivityRendered('Carrera por la mañana', '11.30 km');

        // 4. ✅ Core assertion: stravaAuth must be gone after auto-logout
        const stravaAuth = await page.evaluate(() => localStorage.getItem('stravaAuth'));
        expect(stravaAuth).toBeNull();
    });

    // ─── Test 9: Queue Waiting Room shows when slot is busy ──────────────────
    test('Test 9: Queue Waiting Room renders when Strava slot is busy', async ({ page }) => {
        const api = new MockStravaClient(page);
        const feedPage = new FeedPage(page);

        // 1. Mock the queue-join endpoint to simulate a busy slot (position 2 in line)
        await api.mockQueueBusy({ position: 2, sessionId: 'test-session-abc', estimatedWait: 6 });

        // 2. Navigate to the app with NO session (forces login screen)
        await feedPage.goto();
        await feedPage.waitForLoaderToHide();

        // 3. Click the login button
        await feedPage.clickLoginButton();

        // 4. ✅ Core assertions: waiting room must be visible with correct position
        await feedPage.verifyQueueScreenVisible();
        await feedPage.verifyQueuePosition('#2');
    });

});
