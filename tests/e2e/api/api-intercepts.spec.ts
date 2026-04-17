import { test, expect } from '@playwright/test';
import { MockStravaClient } from '../utils/MockStravaClient';
import { FeedPage } from '../pages/FeedPage';
import { TestUtils } from '../utils/TestUtils';

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

    // ─── Test 8: Auto-Logout correctly clears stravaAuth from localStorage ────
    test('Test 8: Auto-Logout clears stravaAuth from localStorage after data fetch', async ({ page }) => {
        const api = new MockStravaClient(page);
        const feedPage = new FeedPage(page);

        // 1. Seed a mock session (simulates a previously logged-in user)
        await feedPage.injectMockAuth();

        // 2. Mock a successful activities response and the deauth call
        await api.mockSuccessfulActivities();
        // strava-deauth is already universally mocked in MockStravaClient constructor

        // 3. Navigate to the app and wait for the feed to settle
        await feedPage.goto();
        await feedPage.waitForLoaderToHide();

        const activity = TestUtils.findFirstActivityWithDistance()!;
        const stats = TestUtils.getExpectedStats(activity);
        await feedPage.verifyActivityRendered(activity.name, stats.mainValue);

        // 4. ✅ Core assertion: stravaAuth must be gone after auto-logout
        // We wait for the async deauthorization flow to finish (it happens after pre-fetch)
        await page.waitForFunction(() => localStorage.getItem('stravaAuth') === null, { timeout: 5000 });
        
        const stravaAuth = await page.evaluate(() => localStorage.getItem('stravaAuth'));
        expect(stravaAuth).toBeNull();
    });

    // ─── Test 9: Queue Waiting Room shows when slot is busy ──────────────────
    test('Test 9: Queue Waiting Room renders when Strava slot is busy', async ({ page }) => {
        const api = new MockStravaClient(page);
        const feedPage = new FeedPage(page);

        // 1. Mock the queue-join endpoint to simulate a busy slot (position 2 in line)
        await api.mockQueueBusy({ position: 2, sessionId: 'test-session-abc', estimatedWait: 6 });

        // 2. Navigate to the app with NO session (forces login screen)
        await feedPage.goto();
        await feedPage.waitForLoaderToHide();

        // 3. Click the login button
        await feedPage.clickLoginButton();

        // 4. ✅ Core assertions: waiting room must be visible with correct position
        await feedPage.verifyQueueScreenVisible();
        await feedPage.verifyQueuePosition('#2');
    });

    // ─── Test 10: Queue Join recovers gracefully from orphaned token ─────────
    test('Test 10: Queue Join lets user through gracefully if an orphaned token was cleared', async ({ page }) => {
        const api = new MockStravaClient(page);
        const feedPage = new FeedPage(page);

        // 1. Mock the queue-join endpoint to simulate what the backend returns
        // when it successfully acquires the lock and cleans up an orphaned token (position 0).
        await api.mockQueueJoinWithOrphanCleanup();

        // 2. Setup a robust window.open mock EARLY so it catches the popup immediately
        await page.addInitScript(() => {
            const popupMock = {
                location: { href: '' },
                document: { write: () => {} },
                close: () => { (popupMock as any).closed = true; },
                closed: false
            };
            (window as any).__lastPopup = popupMock;
            window.open = (url?: string) => {
                // When app calls window.open('about:blank') first, and later sets href
                (window as any).__lastPopup.location.href = url || 'about:blank';
                return (window as any).__lastPopup;
            };
        });

        // 3. Navigate to the app with NO session (forces login screen)
        await feedPage.goto();
        await feedPage.waitForLoaderToHide();
        
        await feedPage.clickLoginButton();

        // 4. ✅ Core assertion: Wait for the proxy popup (about:blank) 
        // to be updated with the Strava OAuth URL once queue-join returns 0.
        await TestUtils.waitForPopupUrl(page, 'strava.com/oauth/authorize');
    });

    /**
     * Test 11: Handles API 500 Internal Server Error gracefully
     */
    test('Test 11: Handles API 500 Internal Server Error gracefully', async ({ page }) => {
        const api = new MockStravaClient(page);
        const feedPage = new FeedPage(page);

        await feedPage.injectMockAuth();
        await api.mockServerError();

        await feedPage.goto();
        await feedPage.waitForLoaderToHide();

        // Should show error boundary or error message
        await expect(page.getByText(/error|failed|wait/i).first()).toBeVisible();
    });

    /**
     * Test 12: Handles API 429 Rate Limit Exceeded
     */
    test('Test 12: Handles API 429 Rate Limit with Retry notice', async ({ page }) => {
        const api = new MockStravaClient(page);
        const feedPage = new FeedPage(page);

        await feedPage.injectMockAuth();
        await api.mockRateLimitError();

        await feedPage.goto();
        await feedPage.waitForLoaderToHide();

        // Verify the user sees something about waiting or rate limits
        await expect(page.getByText(/rate limit|too many requests|wait/i).first()).toBeVisible();
    });

    // ─── Test 13: Full-Page Redirect Flow (Safari Logic) ─────────────────────
    // NOTE: On Safari, when queue polling sees position 0, the app calls redirectToStravaAuth()
    // instead of window.open() (which Safari blocks in async contexts).
    test('Test 13: Performs full-page redirect when queue clears in Safari context', async ({ page }) => {
        const api = new MockStravaClient(page);
        const feedPage = new FeedPage(page);

        let capturedRedirectUrl = '';

        // 1. Force Safari-like user agent
        await page.addInitScript(() => {
            Object.defineProperty(navigator, 'userAgent', {
                value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
                configurable: true
            });
        });

        // Intercept all navigations to strava.com
        await page.route('https://www.strava.com/**', async route => {
            capturedRedirectUrl = route.request().url();
            await route.abort(); // Prevent actual navigation
        });

        // 2. Mock sequence: Join Queue -> Busy (Position 1), Status Check -> Turn (Position 0)
        await api.mockQueueBusy({ position: 1, sessionId: 'safari-session-123', estimatedWait: 30 });
        
        await page.route('**/api/queue-status?sessionId=safari-session-123', async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ position: 0 })
            });
        });

        // 3. Navigate and click login
        await feedPage.goto();
        await feedPage.waitForLoaderToHide();
        
        // Ensure we are on login screen
        await expect(page.locator('[data-testid="strava-login-btn"]')).toBeVisible();

        // Click login -> Should enter queue screen
        await feedPage.clickLoginButton();
        
        // Wait for it to switch to queue screen
        await expect(page.locator('#screen-queue')).toBeVisible();

        // 4. Polling should trigger (internal 3s timer)
        // We wait for the capturedRedirectUrl to be populated
        const startTime = Date.now();
        while (!capturedRedirectUrl && Date.now() - startTime < 10000) {
            await page.waitForTimeout(200);
        }

        // 5. ✅ Core assertion: Polling triggered the full-page redirect in Safari context
        expect(capturedRedirectUrl).toContain('strava.com/oauth/authorize');
    });
});
