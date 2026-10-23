import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 120000,
  use: {
    baseURL: process.env.HOOD_CERT_BASE_URL || 'http://127.0.0.1:4177',
    viewport: { width: 390, height: 844 },
    acceptDownloads: true
  },
  webServer: {
    command: 'npx serve .. -l 4177',
    cwd: import.meta.dirname,
    url: 'http://127.0.0.1:4177/hood-cert/',
    reuseExistingServer: true
  }
});
