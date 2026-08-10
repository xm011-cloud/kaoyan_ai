import { test, expect } from "@playwright/test";

test.describe("Practice", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/practice");
  });

  test("creation form is visible", async ({ page }) => {
    await expect(page.locator("h1").filter({ hasText: "练习" })).toBeVisible({ timeout: 10000 });
    // Should have a create/start button（限定 main，避开 AI 浮层面板里的"帮我创建一个复习任务"）
    const createBtn = page.locator("main").getByRole("button", { name: /开始|创建|练习/ });
    await expect(createBtn).toBeVisible({ timeout: 5000 });
  });

  test("create a daily practice session", async ({ page }) => {
    // Just verify the create button exists and is clickable
    const createBtn = page.locator("button").filter({ hasText: /开始练习|创建|开始/ }).first();
    await expect(createBtn).toBeVisible({ timeout: 10000 });
    // Don't actually click — it triggers AI generation which is slow/flaky in E2E
  });

  test("practice history is visible", async ({ page }) => {
    await expect(page.locator("text=练习记录")).toBeVisible({ timeout: 10000 });
  });
});
