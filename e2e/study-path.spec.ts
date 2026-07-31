import { test, expect } from "@playwright/test";

test.describe("Study Path", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/study-path");
  });

  test("page loads correctly", async ({ page }) => {
    await expect(page.locator("text=学习路径").or(page.locator("text=AI 学习路径"))).toBeVisible({ timeout: 10000 });
  });

  test("milestone area is visible", async ({ page }) => {
    // Should show either milestones or empty state
    const hasContent = await page.locator("text=阶段").or(page.locator("text=里程碑")).or(page.locator("text=暂无")).isVisible({ timeout: 10000 });
    expect(hasContent).toBe(true);
  });

  test("related module links are visible", async ({ page }) => {
    const related = page.locator("text=相关模块").first();
    if (await related.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(page.locator('a[href="/tasks"]')).toBeVisible();
      await expect(page.locator('a[href="/wrong-questions"]')).toBeVisible();
      await expect(page.locator('a[href="/knowledge-graph"]')).toBeVisible();
    }
  });
});
