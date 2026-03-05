import { test } from '@playwright/test';
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

        // Verify our mock run "Carrera por la mañana" was rendered correctly (11.30 km)
        await feedPage.verifyActivityRendered('Carrera por la mañana', '11.30 km');

        // Verify our mock workout "Morning HIIT Session" was rendered correctly (45m)
        await feedPage.verifyActivityRendered('Morning HIIT Session', '45m');
    });

});
