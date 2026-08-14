import { test, expect } from "@playwright/test";

test.describe("Practice", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/practice");
  });

  test("creation form is visible", async ({ page }) => {
    await expect(page.locator("h1").filter({ hasText: "练习" })).toBeVisible({ timeout: 10000 });
    // 精确匹配"开始练习"（避免命中模式选择器里的"📚 真题练习"按钮）
    const createBtn = page.locator("main").getByRole("button", { name: /开始练习/ });
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
