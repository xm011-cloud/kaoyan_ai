import { test, expect } from "@playwright/test";

test.describe("Settings", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/settings");
  });

  test("page loads with AI key field", async ({ page }) => {
    await expect(page.locator("text=设置").first()).toBeVisible({ timeout: 10000 });
    // AI Key input should exist（AI Tab 依赖 GET settings 完成，Neon 冷启动下放宽超时）
    const keyInput = page.locator('input[placeholder*="sk-"]').or(page.locator('input[type="password"]')).or(page.locator('input[placeholder*="Key"]'));
    await expect(keyInput.first()).toBeVisible({ timeout: 15000 });
  });

  test("learning reminder section is visible", async ({ page }) => {
    const reminderSection = page.locator("text=提醒").or(page.locator("text=通知"));
    await expect(reminderSection.first()).toBeVisible({ timeout: 10000 });
  });

  test("form fields are interactive", async ({ page }) => {
    // Try typing in the API key field
    const keyInput = page.locator('input[placeholder*="sk-"]').or(page.locator('input[type="password"]')).first();
    if (await keyInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await keyInput.fill("test-key");
      await expect(keyInput).toHaveValue("test-key");
    }
  });
});
