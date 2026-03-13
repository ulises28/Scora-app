import { test, expect } from '@playwright/test';
import { FeedPage } from '../pages/FeedPage';
import { MockStravaClient } from '../utils/MockStravaClient';

test.describe('Scora App UI: Feed (POM)', () => {

    test.beforeEach(async ({ page }) => {
        const feedPage = new FeedPage(page);
        const api = new MockStravaClient(page);

        // 1. Inject fake Auth tokens into browser data
        await feedPage.injectMockAuth();

        // 2. Mock network route to intercept Strava API calls and inject fixture data
        await api.mockSuccessfulActivities();

        // 3. Load the page and hide the spinner
        await feedPage.goto();
        await feedPage.waitForLoaderToHide();
    });

    test('Test 1: Feed successfully renders mocked incoming data', async ({ page }) => {
        const feedPage = new FeedPage(page);

        // Verify "Carrera por la mañana" (9.64 km)
        // We use both title and distance to isolate the specific card, 
        // avoiding flakiness if multiple activities share the same name.
        const title = 'Carrera por la mañana';
        const distance = '9.64 km';
        
        const activityCard = page.locator('.activity-card').filter({
            hasText: title,
        }).filter({
            hasText: distance
        });

        await expect(activityCard.first()).toBeVisible();

        // Verify "Entrenamiento con pesas matutino" (1h 11m)
        await feedPage.verifyActivityRendered('Entrenamiento con pesas matutino', '1h 11m');
    });

});
