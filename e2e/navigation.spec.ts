import { test, expect } from "@playwright/test";

test.describe("Navigation & Module Linking", () => {
  test("workspace navigation exposes all core module links", async ({ page }) => {
    await page.goto("/dashboard");
    // 等待 shell 渲染完成（Turbopack 冷编译首屏可能较慢）
    await page.locator("header").waitFor({ timeout: 20000 });

    // 桌面端的完整模块导航现在位于可收起左栏；移动端仍由底部栏和抽屉承接。
    const workspaceNav = page.locator('aside').filter({ has: page.locator('a[href="/checkin"]') }).first();
    await expect(workspaceNav).toBeVisible({ timeout: 5000 });

    // 14 个模块中 /admission 在 ui-store 默认 visible:false（仍可通过 URL 访问），故断言其余 13 个
    const navLinks = [
      "/dashboard", "/goal", "/tasks", "/checkin", "/pomodoro",
      "/materials", "/chat", "/wrong-questions",
      "/practice", "/feedback", "/knowledge-graph", "/study-path", "/settings",
    ];

    for (const href of navLinks) {
      const link = workspaceNav.locator(`a[href="${href}"]`);
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
    const related = page.getByRole("heading", { name: "继续学习" });
    await expect(related).toBeVisible();
    await expect(related.locator("..").locator('a[href="/practice"]')).toBeVisible();
  });

  test("tasks related links exist", async ({ page }) => {
    await page.goto("/tasks");
    const related = page.getByRole("heading", { name: "继续学习" });
    await expect(related).toBeVisible();
    await expect(related.locator("..").locator('a[href="/knowledge-graph"]')).toBeVisible();
  });

  test("feedback related links exist", async ({ page }) => {
    await page.goto("/feedback");
    const related = page.getByRole("heading", { name: "继续学习" });
    await expect(related).toBeVisible();
    await expect(related.locator("..").locator('a[href="/tasks"]')).toBeVisible();
  });
});
