import { defineConfig } from '@playwright/test';

// Chromium is preinstalled at /opt/pw-browsers (revision 1194 == Playwright 1.56).
// Pin the executable so a version drift of @playwright/test never triggers a download.
process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/opt/pw-browsers';
process.env.PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD ??= '1';

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    headless: true,
    viewport: { width: 1366, height: 800 },
    launchOptions: { executablePath: '/opt/pw-browsers/chromium', args: ['--mute-audio', '--autoplay-policy=no-user-gesture-required'] },
  },
  webServer: {
    command: 'npx vite preview --host 127.0.0.1 --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: false,
    timeout: 60_000,
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
});
