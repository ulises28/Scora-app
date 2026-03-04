import { test, expect } from '@playwright/test';
import { mockActivities } from '../../fixtures/stravaData';

test.describe('Scora App: UI - Sticker Editor & Navigation', () => {

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

    test('Test 1: Clicking a Run activity opens the Editor with Run stats', async ({ page }) => {
        const activityCard = page.locator('.activity-card', { hasText: 'Carrera por la mañana' });
        await activityCard.click();

        const editorScreen = page.locator('#screen-editor');
        await expect(editorScreen).toHaveClass(/active/);
        await expect(page.locator('#selected-activity-name')).toHaveText('Carrera por la mañana');
        await expect(page.locator('#storyCanvas')).toBeVisible();
        expect(page.url()).toContain('#editor');
    });

    test('Test 2: Clicking a Workout activity opens the Editor with Workout stats', async ({ page }) => {
        const activityCard = page.locator('.activity-card', { hasText: 'Morning HIIT Session' });
        await activityCard.click();

        const editorScreen = page.locator('#screen-editor');
        await expect(editorScreen).toHaveClass(/active/);
        await expect(page.locator('#selected-activity-name')).toHaveText('Morning HIIT Session');
        await expect(page.locator('#storyCanvas')).toBeVisible();
        expect(page.url()).toContain('#editor');
    });

    test('Test 3: Switching templates updates the active CSS state', async ({ page }) => {
        await page.locator('.activity-card', { hasText: 'Carrera por la mañana' }).click();

        const routeTemplateBtn = page.locator('.template-item', { hasText: 'Route' });
        await routeTemplateBtn.click();
        await expect(routeTemplateBtn).toHaveClass(/active/);

        const minimalTemplateBtn = page.locator('.template-item', { hasText: 'Minimal' });
        await expect(minimalTemplateBtn).not.toHaveClass(/active/);
    });

    test('Test 4: Back button uses History API correctly', async ({ page }) => {
        await page.locator('.activity-card', { hasText: 'Carrera por la mañana' }).click();
        expect(page.url()).toContain('#editor');

        await page.locator('#btn-back').click();

        const feedScreen = page.locator('#screen-feed');
        await expect(feedScreen).toHaveClass(/active/);

        const editorScreen = page.locator('#screen-editor');
        await expect(editorScreen).not.toHaveClass(/active/);

        // VERY IMPORTANT: Verify the URL returned to the base URL and did NOT trigger Strava login
        expect(page.url()).toBe('http://localhost:5500/');
        await expect(page.locator('#auth-section')).toHaveClass(/hidden/);
    });
});
