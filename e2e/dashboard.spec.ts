import { test, expect } from "@playwright/test";

test.describe("Dashboard", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dashboard");
  });

  test("stats cards are visible", async ({ page }) => {
    // Should see the welcome banner
    await expect(page.locator("text=欢迎回来").first()).toBeVisible({ timeout: 10000 });
    // Stats cards area
    await expect(page.locator("text=今日任务")).toBeVisible();
    await expect(page.locator("text=本周学习")).toBeVisible();
    await expect(page.locator("text=连续打卡")).toBeVisible();
    await expect(page.locator("text=任务完成率")).toBeVisible();
  });

  test("quick-entry grid has 12 module links", async ({ page }) => {
    const quickLinks = page.locator('a[href="/tasks"], a[href="/checkin"], a[href="/goal"], a[href="/materials"], a[href="/chat"], a[href="/feedback"], a[href="/wrong-questions"], a[href="/knowledge-graph"], a[href="/study-path"], a[href="/practice"], a[href="/pomodoro"], a[href="/admission"]');
    // At least 10 of the 12 should be visible
    await expect(quickLinks).toHaveCount(12, { timeout: 5000 });
  });

  test("today tasks section is visible", async ({ page }) => {
    await expect(page.locator("text=今日任务").last()).toBeVisible();
    // "查看全部" link to tasks
    await expect(page.locator('a[href="/tasks"]').first()).toBeVisible();
  });
});
