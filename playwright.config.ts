import { defineConfig } from '@playwright/test';

const externalBaseURL = process.env.BROWSER_BASE_URL;

export default defineConfig({
  testDir: '.',
  testMatch: ['tests/**/*.spec.ts', '4g-lte/tests/**/*.spec.ts'],
  fullyParallel: true,
  use: { baseURL: externalBaseURL ?? 'http://127.0.0.1:4177', browserName: 'chromium', trace: 'retain-on-failure' },
  webServer: externalBaseURL ? undefined : {
    command: process.env.BROWSER_PRODUCTION === '1'
      ? 'npm run preview -- --port 4177 --strictPort'
      : 'npm run dev -- --port 4177 --strictPort',
    url: 'http://127.0.0.1:4177',
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
