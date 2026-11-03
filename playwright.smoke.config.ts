import { defineConfig, devices } from "@playwright/test";

// CI checks the deployed publication without importing or building app code.
// The wider editorial/regression suites keep their existing configuration.
export default defineConfig({
  testDir: "./tests",
  testMatch: "production-availability.spec.ts",
  forbidOnly: Boolean(process.env.CI),
  workers: 1,
  timeout: 45_000,
  globalTimeout: 240_000,
  retries: process.env.CI ? 1 : 0,
  expect: { timeout: 15_000 },
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: {
    ...devices["Desktop Chrome"],
    baseURL: process.env.MOOSQA_SMOKE_BASE_URL || "https://moosqa.vercel.app",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "prod-smoke" }],
});
