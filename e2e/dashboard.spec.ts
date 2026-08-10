import { test, expect } from "@playwright/test";

test.describe("Dashboard", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dashboard");
  });

  test("stats cards are visible", async ({ page }) => {
    // 欢迎语随是否有目标而变化（欢迎回来 ✨ / 欢迎来到考研助手 🎓），用稳定 h1 断言页面已加载
    await expect(page.locator("h1").filter({ hasText: /学习概览/ })).toBeVisible({ timeout: 10000 });
    // At least one stat card should be visible
    await expect(page.locator("text=今日任务").first()).toBeVisible();
  });

  test("quick-entry grid has module links", async ({ page }) => {
    // Check a few key quick-entry links exist
    const links = ["/tasks", "/checkin", "/chat", "/wrong-questions", "/practice", "/pomodoro"];
    for (const href of links) {
      await expect(page.locator(`a[href="${href}"]`).first()).toBeVisible({ timeout: 5000 });
    }
  });

  test("today tasks section is visible", async ({ page }) => {
    // The section title
    const section = page.locator("h3").filter({ hasText: "今日任务" });
    await expect(section).toBeVisible({ timeout: 10000 });
  });
});
