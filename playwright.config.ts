import {defineConfig, devices} from '@playwright/test';

const port = Number(process.env['E2E_PORT'] ?? 4200);
const baseURL = `http://localhost:${port}`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 1 : 0,
  reporter: process.env['CI'] ? [['list'], ['html', {open: 'never'}]] : 'list',
  timeout: 30_000,
  expect: {timeout: 7_000},

  use: {
    baseURL,
    locale: 'uk-UA',
    timezoneId: 'Europe/Kyiv',
    viewport: {width: 1440, height: 900},
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure'
  },

  projects: [
    {name: 'chromium', use: {...devices['Desktop Chrome'], viewport: {width: 1440, height: 900}}}
  ],

  webServer: {
    // An already running `ng serve` on the same port is reused.
    command: process.env['E2E_SERVER_COMMAND'] ?? `npm start -- --port ${port}`,
    url: baseURL,
    reuseExistingServer: !process.env['CI'],
    timeout: 180_000
  }
});
