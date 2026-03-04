import { test, expect } from '@playwright/test';
import { mockActivities } from '../../fixtures/stravaData';

test.describe('Scora App: UI - Activity Feed', () => {

    test.beforeEach(async ({ page }) => {
        await page.goto('http://localhost:5500');
        await page.evaluate((activities) => {
            localStorage.setItem('stravaActivities', JSON.stringify(activities));
        }, mockActivities);
        await page.reload();

        await page.evaluate(() => {
            const overlay = document.getElementById('loader-overlay');
            if (overlay) {
                overlay.style.pointerEvents = 'none';
                overlay.style.opacity = '0';
            }
        });
    });

    test('Test 1: Feed successfully renders mocked incoming data', async ({ page }) => {
        // Verify we passed the login screen
        await expect(page.locator('#auth-section')).toHaveClass(/hidden/);

        // Verify the feed is active
        const feedScreen = page.locator('#screen-feed');
        await expect(feedScreen).toHaveClass(/active/);

        // Verify our mock run "Carrera por la mañana" was rendered correctly
        const runCard = page.locator('.activity-card', { hasText: 'Carrera por la mañana' });
        await expect(runCard).toBeVisible();
        await expect(runCard.locator('.card-meta')).toContainText('11.30 km');

        // Verify our mock workout "Morning HIIT Session" was rendered correctly
        const workoutCard = page.locator('.activity-card', { hasText: 'Morning HIIT Session' });
        await expect(workoutCard).toBeVisible();
        await expect(workoutCard.locator('.card-meta')).toContainText('45m');
    });
});
