import { test, expect } from '@playwright/test';
import { FeedPage } from '../pages/FeedPage';
import { MockStravaClient } from '../utils/MockStravaClient';
import { mockActivities } from '../../fixtures/stravaData';
import { TestUtils } from '../utils/TestUtils';

test.describe('Scora App UI: Feed (POM)', () => {

    test.beforeEach(async ({ page }) => {
        const feedPage = new FeedPage(page);
        const api = new MockStravaClient(page);

        await feedPage.injectMockAuth();
        await api.mockSuccessfulActivities();
        await feedPage.goto();
        await feedPage.waitForLoaderToHide();
    });

    test('Test 1: Feed successfully renders all mocked incoming data', async ({ page }) => {
        const feedPage = new FeedPage(page);

        // Verify EVERY activity from the JSON is rendered correctly
        for (const activity of mockActivities) {
            const stats = TestUtils.getExpectedStats(activity);
            
            const expectedSecondary = stats.hasDistance ? stats.mainValue : stats.timeStr;
            await feedPage.verifyActivityRendered(activity.name, expectedSecondary);
        }

        // Verify that the list is reasonably bounded (Auto-healing robustness)
        const cardCount = await page.locator('.activity-card').count();
        expect(cardCount).toBeLessThanOrEqual(50); // Scora design limit
    });

});
