import { test, expect } from '@playwright/test';

test.describe('Cron Janitor Security Tests', () => {
  // If the secret is not set in the environment, we skip the test to avoid failures
  test.skip(() => !process.env.CRON_SECRET, 'CRON_SECRET is not set in the environment');

  test('should reject requests without a Bearer token', async ({ request }) => {
    const response = await request.post('/api/cron-janitor');
    expect(response.status()).toBe(401);
    
    const body = await response.json();
    expect(body.error).toContain('Unauthorized');
  });

  test('should reject requests with an invalid Bearer token', async ({ request }) => {
    const response = await request.post('/api/cron-janitor', {
      headers: {
        'Authorization': 'Bearer NOT_THE_REAL_SECRET'
      }
    });
    expect(response.status()).toBe(401);
  });

  test('should accept requests with the correct Bearer token', async ({ request }) => {
    const response = await request.post('/api/cron-janitor', {
      headers: {
        'Authorization': `Bearer ${process.env.CRON_SECRET}`
      }
    });
    
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(['success', 'skipped']).toContain(body.status);
  });

  test('should accept requests using the URL parameter cron_secret', async ({ request }) => {
    const response = await request.post(`/api/cron-janitor?cron_secret=${process.env.CRON_SECRET}`);
    
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(['success', 'skipped']).toContain(body.status);
  });
});
