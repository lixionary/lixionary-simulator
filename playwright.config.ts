import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: ['tests/**/*.spec.ts', '4g-lte/tests/**/*.spec.ts'],
  fullyParallel: true,
  use: { baseURL: 'http://127.0.0.1:4177', browserName: 'chromium', trace: 'retain-on-failure' },
  webServer: {
    command: process.env.BROWSER_PRODUCTION === '1'
      ? 'npm run preview -- --port 4177 --strictPort'
      : 'npm run dev -- --port 4177 --strictPort',
    url: 'http://127.0.0.1:4177',
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
