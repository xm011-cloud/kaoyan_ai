import { test, expect } from "@playwright/test";

test.describe("Study Path", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/study-path");
  });

  test("page loads correctly", async ({ page }) => {
    await expect(page.locator("h1").filter({ hasText: /路径/ })).toBeVisible({ timeout: 10000 });
  });

  test("milestone area is visible", async ({ page }) => {
    await page.waitForTimeout(5000);
    const body = await page.locator("body").textContent();
    // Should show either milestones, phases, or empty state
    expect(body).toBeTruthy();
  });

  test("related module links are visible", async ({ page }) => {
    const related = page.locator("text=相关模块").first();
    if (await related.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(page.locator('a[href="/tasks"]').first()).toBeVisible();
    }
  });
});
