import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './test/electron',
  fullyParallel: false,
  retries: 0,
  timeout: 60_000,
  use: {
    trace: 'on-first-retry',
  },
});
