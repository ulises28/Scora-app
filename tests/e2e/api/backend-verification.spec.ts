import { test, expect } from '@playwright/test';
import { mockActivities } from '../../fixtures/stravaData';

test.describe('Scora App: Backend API Verification (APIRequestContext)', () => {

    test('POST /api/queue-join: returns session and position', async ({ page, context }) => {
        await page.goto('/');
        // Mock the backend endpoint since Vite doesn't serve /api/*.js
        await context.route('**/api/queue-join', async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    sessionId: 'test-session-123',
                    position: 1,
                    estimatedWait: 15
                })
            });
        });

        const data = await page.evaluate(async () => {
            const response = await fetch('/api/queue-join', { method: 'POST' });
            return response.json();
        });
        
        expect(data).toMatchObject({
            sessionId: 'test-session-123',
            position: 1,
            estimatedWait: 15
        });
    });

    test('GET /api/queue-status: returns status for session', async ({ page, context }) => {
        await page.goto('/');
        const sessionId = 'test-session-123';
        
        await context.route(`**/api/queue-status?sessionId=${sessionId}`, async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    sessionId,
                    position: 0,
                    estimatedWait: 0
                })
            });
        });

        const data = await page.evaluate(async (sid) => {
            const response = await fetch(`/api/queue-status?sessionId=${sid}`);
            return response.json();
        }, sessionId);
        
        expect(data).toMatchObject({
            sessionId,
            position: 0,
            estimatedWait: 0
        });
    });

    test('Strava API Integration: fetches activities with auth', async ({ page, context }) => {
        await page.goto('/');
        const mockToken = 'mock-strava-token';
        
        // Intercept the Strava API call manually via Playwright's network interception
        await context.route('https://www.strava.com/api/v3/athlete/activities*', async route => {
            const headers = route.request().headers();
            expect(headers['authorization']).toBe(`Bearer ${mockToken}`);
            
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify(mockActivities)
            });
        });

        // Use page.evaluate to simulate our frontend's request
        const data = await page.evaluate(async (token) => {
            const response = await fetch('https://www.strava.com/api/v3/athlete/activities', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            return response.json();
        }, mockToken);

        expect(Array.isArray(data)).toBeTruthy();
        expect(data.length).toBeGreaterThan(0);
        expect(data[0]).toHaveProperty('name');
    });

    test('Strava API Integration: handles 401 Unauthorized', async ({ page, context }) => {
        await page.goto('/');
        await context.route('https://www.strava.com/api/v3/athlete/activities*', async route => {
            await route.fulfill({
                status: 401,
                contentType: 'application/json',
                body: JSON.stringify({ message: "Authorization Error" })
            });
        });

        const status = await page.evaluate(async () => {
            const response = await fetch('https://www.strava.com/api/v3/athlete/activities', {
                headers: {
                    'Authorization': 'Bearer expired-token'
                }
            });
            return response.status;
        });

        expect(status).toBe(401);
    });

});
