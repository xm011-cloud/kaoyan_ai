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
    const section = page.getByRole("link", { name: "📋 今日任务" });
    await expect(section).toBeVisible({ timeout: 10000 });
  });

  test("planning overview links goal, stage, week and today to actionable pages", async ({ page }) => {
    const overview = page.locator("section").filter({ hasText: "你的学习计划" }).first();
    await expect(overview).toBeVisible({ timeout: 10000 });
    await expect(overview.locator('a[href="/goal"]')).toBeVisible();
    await expect(overview.locator('a[href^="/study-path"]').first()).toBeVisible();
    const taskLinks = overview.locator('a[href^="/tasks?week="]');
    await expect(taskLinks.first()).toBeVisible();
    expect(await taskLinks.count()).toBeGreaterThanOrEqual(2);
    await expect(overview.getByText(/查看或调整阶段|建立路线/)).toBeVisible();
    await expect(overview.getByText(/查看今日任务|安排今天/)).toBeVisible();
  });
});
