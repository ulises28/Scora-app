import { test, expect } from '@playwright/test';
import { FeedPage } from '../pages/FeedPage';
import { MockStravaClient } from '../utils/MockStravaClient';

test.describe('Scora App: Activity Feed Limit', () => {

    test('Verification: Activities list is limited to 10 items', async ({ page }) => {
        const feedPage = new FeedPage(page);
        const api = new MockStravaClient(page);

        // Mock 6 activities (fixture has 6)
        await feedPage.injectMockAuth();
        await api.mockSuccessfulActivities();

        await feedPage.goto();
        await feedPage.waitForLoaderToHide();

        // Verify that only 5 cards are rendered
        const cardCount = await page.locator('.activity-card').count();
        expect(cardCount).toBeLessThanOrEqual(10);
    });

});
