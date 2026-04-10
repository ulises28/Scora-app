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
  
  /* LEAD STRATEGY: Always use 1 retry locally to catch 'On-First-Retry' traces and videos
     without bloating storage on passing runs. */
  retries: 1,
  
  /* SCALE: Dynamic worker allocation based on machine CPU. */
  workers: process.env.CI ? 4 : undefined,

  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
    ['monocart-reporter', {
      name: 'Scora E2E Test Report',
      outputFile: './test-results/report.html',
    }]
  ],

  /* TIMEOUTS: Explicit control to prevent "Hung" tests. */
  globalTimeout: 10 * 60 * 1000, // Kill entire run after 10 minutes
  timeout: 60 * 1000, // 1 minute per test
  expect: {
    timeout: 10 * 1000, // 10 seconds for assertions (Better for SPAs like Scora)
  },

  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:5500',

    /* DEBUGGING: 'on-first-retry' is the professional standard for lean disk usage.
       It only saves traces and videos if a test fails and needs to be retried. */
    trace: 'on-first-retry',
    
    /* PRO-LEVEL EVIDENCE: Automatic video and screenshots for failed tests. */
    screenshot: 'only-on-failure',
    video: 'on-first-retry',

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
