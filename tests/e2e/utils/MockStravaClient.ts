import { Page } from '@playwright/test';
import { mockActivities } from '../../fixtures/stravaData';

/**
 * Layer 3 Core Networking Module.
 * Abstracts all route interceptions behind intent-driven methods.
 */
export class MockStravaClient {
    private page: Page;

    constructor(page: Page) {
        this.page = page;

        // Universally mock the new deauthorization endpoint so tests never throw 404s
        // when the auto-logout mechanism triggers in the background.
        this.page.route('**/api/strava-deauth', async route => {
            await route.fulfill({ status: 200, body: JSON.stringify({ success: true }) });
        });
    }

    /**
     * Mocks a successful token exchange matching the callback code.
     */
    async mockTokenExchange(expectedCode: string) {
        await this.page.route('**/api/strava-token', async route => {
            const postData = route.request().postDataJSON();
            if (postData && postData.code === expectedCode) {
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        access_token: 'mock_access_token',
                        refresh_token: 'mock_refresh_token',
                        expires_at: Math.floor(Date.now() / 1000) + 3600
                    })
                });
            } else {
                await route.fallback();
            }
        });
    }

    /**
     * Mocks a successful fetch returning our standard Fixture data.
     */
    async mockSuccessfulActivities() {
        await this.page.route('**/api/strava-activities', async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ activities: mockActivities })
            });
        });
    }

    /**
     * Mocks a 401 Unauthorized Response (Expired Token Scenario)
     */
    async mockUnauthorizedError() {
        await this.page.route('**/api/strava-activities', async route => {
            await route.fulfill({
                status: 401,
                contentType: 'application/json',
                body: JSON.stringify({ error: 'Unauthorized' })
            });
        });
    }

    /**
     * Mocks a valid user with absolutely zero activity history.
     */
    async mockEmptyActivities() {
        await this.page.route('**/api/strava-activities', async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ activities: [] })
            });
        });
    }

    /**
     * Mocks a valid user with exactly one activity.
     */
    async mockSingleActivity() {
        await this.page.route('**/api/strava-activities', async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ activities: [mockActivities[0]] })
            });
        });
    }

    /**
     * Mocks a busy queue (slot taken). Returns the given position response from queue-join.
     */
    async mockQueueBusy(payload: { position: number; sessionId: string; estimatedWait: number }) {
        await this.page.route('**/api/queue-join', async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify(payload)
            });
        });
    }

    /**
     * Mocks a successful queue-join that encountered an orphaned token,
     * to simulate the backend dead-man switch activating.
     */
    async mockQueueJoinWithOrphanCleanup() {
        let deauthCalled = false;
        
        // Listen for the backend-side deauth call happening "behind the scenes"
        // In Playwright, we can't easily mock fetch calls made by our BE to Strava's BE,
        // unless they are made by the browser. 
        // 🚨 Note: The orphaned token cleanup is a pure Backend-to-Backend call. 
        // We will mock the queue-join response and verify the frontend behavior.
        
        await this.page.route('**/api/queue-join', async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    sessionId: 'session-orphan-cleared-abc',
                    position: 0,
                    estimatedWait: 0
                })
            });
        });
    }

    /**
     * Mocks a detailed activity response including splits_metric.
     * Useful for testing templates that require per-km breakdown.
     */
    async mockDetailedActivity(activityId: number, splitsCount: number = 5) {
        await this.page.route('**/api/strava-activities', async route => {
            const postData = route.request().postDataJSON();
            if (postData && postData.activity_id === activityId) {
                // Find base activity or use a default one
                const base = mockActivities.find(a => a.id === activityId) || mockActivities[0];
                
                // Generate splits
                const splits_metric = Array.from({ length: splitsCount }, (_, i) => ({
                    distance: 1000,
                    elapsed_time: 300 + Math.random() * 60,
                    elevation_difference: Math.random() * 10,
                    moving_time: 300 + Math.random() * 60,
                    split: i + 1,
                    average_speed: 1000 / (300 + Math.random() * 60), // ~5:00 pace
                    pace_zone: 0
                }));

                // Add a remainder if splitsCount is not an integer? 
                // For simplicity, splitsCount is the index.
                
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        activity: {
                            ...base,
                            splits_metric,
                            device_name: 'Garmin Forerunner 955'
                        }
                    })
                });
            } else {
                // Fallback to summary response for other calls
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({ activities: mockActivities })
                });
            }
        });
    }

    /**
     * Mocks an Internal Server Error (500)
     */
    async mockServerError() {
        await this.page.route('**/api/strava-activities', async route => {
            await route.fulfill({
                status: 500,
                contentType: 'application/json',
                body: JSON.stringify({ error: 'Internal Server Error' })
            });
        });
    }

    /**
     * Mocks a Rate Limit error (429)
     */
    async mockRateLimitError() {
        await this.page.route('**/api/strava-activities', async route => {
            await route.fulfill({
                status: 429,
                contentType: 'application/json',
                headers: { 'Retry-After': '60' },
                body: JSON.stringify({ error: 'Rate limit exceeded. Try again in 60 seconds.' })
            });
        });
    }
}
