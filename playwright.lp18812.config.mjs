import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  testMatch: 'lp18812-wave0.spec.mjs',
  workers: 1,
  retries: 0,
  reporter: 'line',
  use: { browserName: 'chromium', channel: 'chromium', headless: true, serviceWorkers: 'block', trace: 'off', video: 'off' }
});
