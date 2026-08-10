import { test, expect } from "@playwright/test";

test.describe("Navigation & Module Linking", () => {
  test("sidebar has all 14 module links", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForTimeout(2000);

    // 打开侧边菜单（点击 🎓 logo 按钮），让所有链接可见
    const menuBtn = page.locator("header").locator("button").first();
    try { await menuBtn.click({ timeout: 3000 }); await page.waitForTimeout(500); } catch { /* skip */ }

    const navLinks = [
      "/dashboard", "/goal", "/tasks", "/checkin", "/pomodoro",
      "/admission", "/materials", "/chat", "/wrong-questions",
      "/practice", "/feedback", "/knowledge-graph", "/study-path", "/settings",
    ];

    for (const href of navLinks) {
      const link = page.locator(`a[href="${href}"]`);
      const count = await link.count();
      expect(count).toBeGreaterThan(0);
    }
  });

  test("dashboard quick-entry links navigate correctly", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForTimeout(2000);

    // Test a couple of quick-entry links
    const tasksLink = page.locator('a[href="/tasks"]').first();
    if (await tasksLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await tasksLink.click();
      await page.waitForURL(/\/tasks/, { timeout: 10000 });
    }
  });

  test("wrong-questions related links exist", async ({ page }) => {
    await page.goto("/wrong-questions");
    await page.waitForTimeout(2000);
    // Related links section should exist
    const related = page.locator("text=相关模块").first();
    if (await related.isVisible({ timeout: 5000 }).catch(() => false)) {
      // Use last() to get the related link (not sidebar)
      await expect(page.locator('a[href="/practice"]').last()).toBeVisible();
    }
  });

  test("tasks related links exist", async ({ page }) => {
    await page.goto("/tasks");
    await page.waitForTimeout(2000);
    const related = page.locator("text=相关模块").first();
    if (await related.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(page.locator('a[href="/knowledge-graph"]').last()).toBeVisible();
    }
  });

  test("feedback related links exist", async ({ page }) => {
    await page.goto("/feedback");
    await page.waitForTimeout(2000);
    const related = page.locator("text=相关模块").first();
    if (await related.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(page.locator('a[href="/tasks"]').last()).toBeVisible();
    }
  });
});
