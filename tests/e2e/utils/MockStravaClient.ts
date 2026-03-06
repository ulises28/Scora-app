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
        await this.page.route('https://www.strava.com/api/v3/athlete/activities*', async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify(mockActivities)
            });
        });
    }

    /**
     * Mocks a 401 Unauthorized Response (Expired Token Scenario)
     */
    async mockUnauthorizedError() {
        await this.page.route('https://www.strava.com/api/v3/athlete/activities*', async route => {
            await route.fulfill({
                status: 401,
                contentType: 'application/json',
                body: JSON.stringify({ message: "Authorization Error" })
            });
        });
    }

    /**
     * Mocks a valid user with absolutely zero activity history.
     */
    async mockEmptyActivities() {
        await this.page.route('https://www.strava.com/api/v3/athlete/activities*', async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify([])
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
}
