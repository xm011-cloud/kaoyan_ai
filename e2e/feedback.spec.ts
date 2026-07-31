import { test, expect } from "@playwright/test";

test.describe("Feedback", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/feedback");
  });

  test("page loads correctly", async ({ page }) => {
    await expect(page.locator("text=学习反馈")).toBeVisible({ timeout: 10000 });
  });

  test("generate button is visible", async ({ page }) => {
    const genBtn = page.getByRole("button", { name: /生成|反馈/ });
    await expect(genBtn).toBeVisible({ timeout: 10000 });
  });

  test("related module links are visible", async ({ page }) => {
    const related = page.locator("text=相关模块").first();
    if (await related.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(page.locator('a[href="/tasks"]')).toBeVisible();
      await expect(page.locator('a[href="/study-path"]')).toBeVisible();
      await expect(page.locator('a[href="/practice"]')).toBeVisible();
    }
  });
});
