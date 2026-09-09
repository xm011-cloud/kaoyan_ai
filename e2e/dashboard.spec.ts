import { test, expect } from "@playwright/test";

test.describe("Dashboard", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dashboard");
  });

  test("stats cards are visible", async ({ page }) => {
    // 首页主叙事已改为“现在，只做下一步”，不再依赖已废弃的“学习概览”标题。
    await expect(page.getByText("现在，只做下一步")).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole("link", { name: /开始这一项|安排今天|查看本周计划|查看完成情况/ })).toBeVisible();
  });

  test("quick-entry grid has module links", async ({ page }) => {
    // Check a few key quick-entry links exist
    const links = ["/tasks", "/checkin", "/chat", "/wrong-questions", "/practice", "/pomodoro"];
    for (const href of links) {
      await expect(page.locator(`a[href="${href}"]`).first()).toBeVisible({ timeout: 5000 });
    }
  });

  test("today tasks section is visible", async ({ page }) => {
    await expect(page.getByText("现在，只做下一步")).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole("link", { name: /查看周计划/ })).toBeVisible();
  });

  test("planning overview links goal, stage, week and today to actionable pages", async ({ page }) => {
    const commandCenter = page.locator("section").filter({ hasText: "现在，只做下一步" }).first();
    await expect(commandCenter).toBeVisible({ timeout: 10000 });
    await expect(commandCenter.locator('a[href^="/tasks"], a[href^="/courses"]').first()).toBeVisible();
    await expect(commandCenter.locator('a[href^="/tasks?week="]').first()).toBeVisible();
  });
});
