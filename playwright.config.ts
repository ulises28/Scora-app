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
    baseURL: process.env.BASE_URL || 'http://localhost:3000',

    /* DEBUGGING: 'on-first-retry' is the professional standard for lean disk usage.
       It only saves traces and videos if a test fails and needs to be retried. */
    trace: 'retain-on-failure',
    
    /* PRO-LEVEL EVIDENCE: Automatic video and screenshots for failed tests. */
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',

    /* HEADLESS: Default to true, but allow override for local debugging. */
    headless: true,
  },

  projects: [
    /* -------------------------------------------------------------------------
     * TIER 1: SMOKE TESTS (@smoke)
     * Goal: 60-second feedback loop. Verifies only critical user paths.
     * ------------------------------------------------------------------------- */
    {
      name: 'Smoke: Chromium',
      grep: /@smoke/,
      testIgnore: /.*mobile.*\.spec\.ts/, // Guardrail: Desktop ignores mobile logic
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'Smoke: Mobile Safari',
      grep: /@smoke/,
      use: { ...devices['iPhone 13'] },
    },

    /* -------------------------------------------------------------------------
     * TIER 2: FULL REGRESSION (Exhaustive)
     * Goal: 100% Coverage. Every test file and every case.
     * Use this before merges to Master.
     * ------------------------------------------------------------------------- */
    {
      name: 'Regression: Chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'Regression: Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },

    /* -------------------------------------------------------------------------
     * TIER 3: VISUAL INTEGRITY (@visual)
     * Goal: "Absolute Truth" Screenshot validation.
     * NOTE: We keep this separate to avoid "Screenshot Flakiness" in logic runs.
     * ------------------------------------------------------------------------- */
    {
      name: 'Visual: Docker-Linux',
      grep: /@visual/,
      use: { ...devices['Desktop Chrome'] },
      /* Architect Hint: You can use testIgnore here if certain visual tests 
         only make sense in specific resolutions. */
    },

    /* -------------------------------------------------------------------------
     * SPECIAL CONTEXT: MOBILE-ONLY RULES
     * Logic that ONLY makes sense on touch-devices.
     * ------------------------------------------------------------------------- */
    {
      name: 'Mobile-Only Features',
      testMatch: /.*mobile-gestures\.spec\.ts/,
      use: { ...devices['iPhone 13'] },
    },
  ],

  webServer: {
    command: 'vercel dev --yes --scope team_laRoHIAGhFSpCKAzcEhgFk4Z',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000, // Give the build time to finish
  },
});
