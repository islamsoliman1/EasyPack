import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 120000,
  workers: 1,
  use: { baseURL: process.env.EASYBACK_WEB_URL ?? 'http://localhost:5173', channel: process.env.PLAYWRIGHT_CHANNEL, viewport: { width: 1440, height: 900 }, screenshot: 'only-on-failure', trace: 'off' },
  reporter: 'list',
});
