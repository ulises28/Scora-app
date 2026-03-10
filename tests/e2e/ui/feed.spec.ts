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

        // Verify our mock run "Carrera por la mañana" was rendered correctly (9.64 km)
        await feedPage.verifyActivityRendered('Carrera por la mañana', '9.64 km');

        // Verify our mock workout "Entrenamiento con pesas" was rendered correctly (1h 11m)
        await feedPage.verifyActivityRendered('Entrenamiento con pesas matutino', '1h 11m');
    });

});
