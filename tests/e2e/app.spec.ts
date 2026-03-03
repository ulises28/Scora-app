import { test, expect } from '@playwright/test';

test.describe('Scora App E2E', () => {

    test('Simulates Strava login via localStorage and renders a sticker', async ({ page }) => {
        // 1. Go to the dev server
        await page.goto('http://localhost:5500');

        // Ensure title is correct
        await expect(page).toHaveTitle(/Scora/i);

        // 2. Mock Strava Data in Local Storage
        // This is the data structure formatActivityStats expects.
        const mockActivities = [
            {
                id: 123456,
                name: "Sunset 5K",
                type: "Run",
                distance: 5000,
                moving_time: 1540,
                average_speed: 3.25,
                max_speed: 4.5,
                map: {
                    summary_polyline: "some_mock_polyline"
                }
            }
        ];

        // Wait to make sure DOM is somewhat ready, though Playwright handles this well
        await page.evaluate((activities) => {
            localStorage.setItem('stravaActivities', JSON.stringify(activities));
        }, mockActivities);

        // 3. Reload page to trigger initApp() with the mocked cachedData
        await page.reload();

        // 4. Wait for the activity feed to render the mocked activity
        const activityCard = page.locator('.activity-card', { hasText: 'Sunset 5K' });
        await expect(activityCard).toBeVisible({ timeout: 10000 });

        // 5. Click the activity to open the editor
        await activityCard.click();

        // 6. Verify the editor screen is active
        const editorScreen = page.locator('#screen-editor');
        await expect(editorScreen).toHaveClass(/active/);

        // 7. Verify the canvas is rendered
        const canvas = page.locator('#storyCanvas');
        await expect(canvas).toBeVisible();
    });

});
