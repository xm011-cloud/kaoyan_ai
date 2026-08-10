import { defineConfig, devices } from "@playwright/test";

const BASE_URL = process.env.CI ? "http://localhost:3000" : "http://localhost:3000";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "list",
  globalSetup: "./e2e/global-setup.ts",
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    // Authenticated tests (use saved storage state)
    {
      name: "authenticated",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "e2e/.auth/user.json",
      },
      testMatch: [
        "dashboard.spec.ts",
        "goal.spec.ts",
        "tasks.spec.ts",
        "checkin.spec.ts",
        "pomodoro.spec.ts",
        "materials.spec.ts",
        "chat.spec.ts",
        "practice.spec.ts",
        "wrong-questions.spec.ts",
        "feedback.spec.ts",
        "knowledge-graph.spec.ts",
        "study-path.spec.ts",
        "admission.spec.ts",
        "settings.spec.ts",
        "navigation.spec.ts",
        "suggestions.spec.ts",
        "admin.spec.ts",
        "leaderboard.spec.ts",
        "export.spec.ts",
      ],
    },
    // Unauthenticated tests (no storage state)
    {
      name: "unauthenticated",
      use: {
        ...devices["Desktop Chrome"],
        storageState: { cookies: [], origins: [] },
      },
      testMatch: ["unauthenticated.spec.ts", "support.spec.ts"],
    },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
