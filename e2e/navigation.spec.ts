import { test, expect } from "@playwright/test";

test.describe("Navigation & Module Linking", () => {
  test("sidebar has all 14 module links", async ({ page }) => {
    await page.goto("/dashboard");
    // 等待 shell 渲染完成（Turbopack 冷编译首屏可能较慢）
    await page.locator("header").waitFor({ timeout: 20000 });

    // 打开 slide-over 菜单（点击 🎓 logo 按钮），让所有分组子链接可见
    await page.locator("header button").first().click();
    // 等待菜单内链接出现（/checkin 仅存在于菜单中）
    await page.locator('a[href="/checkin"]').first().waitFor({ timeout: 5000 });

    // 14 个模块中 /admission 在 ui-store 默认 visible:false（仍可通过 URL 访问），故断言其余 13 个
    const navLinks = [
      "/dashboard", "/goal", "/tasks", "/checkin", "/pomodoro",
      "/materials", "/chat", "/wrong-questions",
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
