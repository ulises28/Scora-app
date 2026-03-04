import { test, expect } from '@playwright/test';

test.describe('Scora App: API Network Intercepts', () => {

    test('Test 6: Handles API 401 Unauthorized (Expired Token) Gracefully', async ({ page }) => {
        // 1. Mock a Fake Expired Token in LocalStorage to bypass initial login check
        await page.goto('http://localhost:5500');
        await page.evaluate(() => {
            localStorage.setItem('stravaAuth', JSON.stringify({ access_token: 'fake_token', expires_at: 9999999999 }));
        });

        // 2. Intercept the network call and FORCE a 401 error
        await page.route('**/api/v3/athlete/activities*', async (route) => {
            await route.fulfill({
                status: 401,
                contentType: 'application/json',
                body: JSON.stringify({ message: "Authorization Error", errors: [{ resource: "AccessToken", field: "activity", code: "invalid" }] })
            });
        });

        // 3. Reload the page to trigger the fetch
        await page.reload();

        // 4. Wait for the error handling to drop us back to the auth screen
        const authSection = page.locator('#auth-section');
        await expect(authSection).not.toHaveClass(/hidden/, { timeout: 5000 });

        // Ensure local storage was cleared
        const authStorage = await page.evaluate(() => localStorage.getItem('stravaAuth'));
        expect(authStorage).toBeNull();
    });

    test('Test 7: Handles Empty Activity State (0 Runs)', async ({ page }) => {
        // 1. Mock a Fake Token
        await page.goto('http://localhost:5500');
        await page.evaluate(() => {
            localStorage.setItem('stravaAuth', JSON.stringify({ access_token: 'fake_token', expires_at: 9999999999 }));
        });

        // 2. Intercept the network call and return an EMPTY array
        await page.route('**/api/v3/athlete/activities*', async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify([])
            });
        });

        // 3. Reload the page to trigger the fetch
        await page.reload();

        // 4. Ensure the Feed is active
        const feedScreen = page.locator('#screen-feed');
        await expect(feedScreen).toHaveClass(/active/);

        // 5. Verify the "Empty State" message is rendered
        const activityList = page.locator('#activity-list');
        await expect(activityList).toContainText('No hay entrenamientos recientes.');
    });

});
