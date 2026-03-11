import { defineConfig, devices } from '@playwright/test';
import path from 'path';

/**
 * ARCHITECT NOTE: Centralizing environment variables.
 * This allows you to switch between 'staging' and 'local' easily.
 */
// import dotenv from 'dotenv';
// dotenv.config({ path: path.resolve(__dirname, '.env') });

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  
  /* LEAD STRATEGY: Higher retries on CI, but fail fast locally. */
  retries: process.env.CI ? 2 : 0,
  
  /* SCALE: Dynamic worker allocation based on machine CPU. */
  workers: process.env.CI ? 4 : undefined,

  /* OBSERVABILITY: Use 'blob' for CI merging and 'html' for local reviews. */
  reporter: process.env.CI ? [['github'], ['blob']] : [['html'], ['list']],

  /* TIMEOUTS: Explicit control to prevent "Hung" tests. */
  timeout: 60 * 1000, // 1 minute per test
  expect: {
    timeout: 10 * 1000, // 10 seconds for assertions (Better for SPAs like Scora)
  },

  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:5500',

    /* DEBUGGING: 'retain-on-failure' is better than 'on-first-retry'. 
       It gives you a trace for EVERY failure, which is vital for RCA. */
    trace: 'retain-on-failure',
    
    /* PRO-LEVEL EVIDENCE: Automatic video and screenshots for failed tests. */
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',

    /* HEADLESS: Default to true, but allow override for local debugging. */
    headless: true,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    /* Since you mentioned Capacitor for Scora, we MUST enable mobile. */
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 13'] },
    },
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
  ],

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5500',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000, // Give the build time to finish
  },
});
