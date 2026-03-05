import { test } from '@playwright/test';
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

});
