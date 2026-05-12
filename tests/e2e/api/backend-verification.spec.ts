import { test, expect } from '@playwright/test';

/**
 * 🛠️ BACKEND INTEGRATION SUITE
 * These tests verify the actual Serverless Functions in /api/*.js
 * They must run against 'vercel dev' (configured in the Regression-API project).
 */
test.describe('Scora App: Backend API Verification (Real Integration) [ @regression ]', () => {

    // ─── QUEUE SYSTEM VERIFICATION ───────────────────────────────────────────
    
    test('Queue API: Full Join/Status lifecycle', async ({ request }) => {
        // 1. Join the queue
        const joinResponse = await request.post('/api/queue-join');
        expect(joinResponse.ok(), `Failed to join queue: ${joinResponse.status()}`).toBeTruthy();
        
        const joinData = await joinResponse.json();
        expect(joinData).toMatchObject({
            sessionId: expect.any(String),
            position: expect.any(Number),
            estimatedWait: expect.any(Number)
        });

        const sessionId = joinData.sessionId;

        // 2. Immediate status check for that session
        const statusResponse = await request.get(`/api/queue-status?sessionId=${sessionId}`);
        expect(statusResponse.ok(), `Failed to get status: ${statusResponse.status()}`).toBeTruthy();
        
        const statusData = await statusResponse.json();
        expect(statusData).toMatchObject({
            sessionId: sessionId,
            position: expect.any(Number),
            estimatedWait: expect.any(Number)
        });
    });

    test('Queue API: Handles missing sessionId in status', async ({ request }) => {
        const response = await request.get('/api/queue-status');
        expect(response.status()).toBe(400);
        const data = await response.json();
        expect(data.error).toContain('sessionId is required');
    });

    // ─── STRAVA WRAPPER VERIFICATION ─────────────────────────────────────────

    test('Strava API Wrapper: Returns 400 when access_token missing', async ({ request }) => {
        const response = await request.post('/api/strava-activities', {
            data: { sessionId: 'test-session-123' }
        });
        
        expect(response.status()).toBe(400);
        const data = await response.json();
        expect(data.error).toBe('Access token is required');
    });

    // ─── ADMIN TOOLS & SECURITY ──────────────────────────────────────────────

    test('Admin Reset: Rejects unauthorized requests (401)', async ({ request }) => {
        // Attempt reset with no/bad credentials
        const response = await request.post('/api/admin-reset', {
            headers: {
                'Authorization': 'Basic d3Jvbmc6Y3JlZGVudGlhbHM=' // wrong:credentials
            }
        });
        
        expect(response.status()).toBe(401);
        const data = await response.json();
        expect(data.error).toContain('Unauthorized');
    });

    // ─── HTTP METHOD VALIDATION ──────────────────────────────────────────────

    test('Method Check: POST endpoints reject GET requests (405)', async ({ request }) => {
        const endpoints = ['/api/queue-join', '/api/admin-reset', '/api/strava-activities'];
        
        for (const url of endpoints) {
            const response = await request.get(url);
            expect(response.status(), `Endpoint ${url} should reject GET`).toBe(405);
        }
    });

});
