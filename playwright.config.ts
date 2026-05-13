import { defineConfig, devices } from '@playwright/test';
import path from 'path';

/**
 * ARCHITECT NOTE: Centralizing environment variables.
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 1,
  workers: process.env.CI ? 4 : undefined,

  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
    ['monocart-reporter', {
      name: 'Scora E2E Test Report',
      outputFile: './test-results/report.html',
    }],
    ['blob', { outputDir: 'blob-report' }]
  ],

  globalTimeout: 10 * 60 * 1000, 
  /* Maximum time one test can run for. */
  timeout: process.env.CI ? 90 * 1000 : 60 * 1000, 
  expect: {
    timeout: process.env.CI ? 15 * 1000 : 10 * 1000, 
  },

  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    headless: true,
  },

  projects: [
    {
      name: 'UI-Core',
      use: { ...devices['Desktop Chrome'] },
      grepInvert: /@regression/, // Fast UI tests (No backend needed)
    },
    {
      name: 'Regression-API',
      use: { ...devices['Desktop Chrome'] },
      grep: /@regression/, // Scheduled midnight tests (Vercel needed)
    },
    {
      name: 'Mobile-Chrome',
      use: { ...devices['Pixel 5'] },
      grepInvert: /@regression/,
    },
  ],

  webServer: {
    // 🚀 BIMODAL SERVER: Vite for day-to-day work, Vercel only for scheduled regression
    command: process.env.E2E_SERVER === 'vercel' 
      ? 'vercel dev --yes --scope team_laRoHIAGhFSpCKAzcEhgFk4Z'
      : 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 180 * 1000, 
  },
});
