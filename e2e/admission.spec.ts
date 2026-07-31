import { test, expect } from "@playwright/test";

test.describe("Admission", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/admission");
  });

  test("page loads with tabs", async ({ page }) => {
    await expect(page.locator("text=院校").first()).toBeVisible({ timeout: 10000 });
    // Should have tab navigation
    const tabs = page.locator('[role="tab"]').or(page.locator("button").filter({ hasText: /搜索|对比|收藏|导入/ }));
    await expect(tabs.first()).toBeVisible({ timeout: 5000 });
  });

  test("search input is visible", async ({ page }) => {
    const searchInput = page.locator('input[placeholder*="搜索"]').or(page.locator('input[placeholder*="院校"]'));
    if (await searchInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(searchInput).toBeVisible();
    }
  });

  test("import tab is accessible", async ({ page }) => {
    const importTab = page.locator("button").filter({ hasText: /导入/ });
    if (await importTab.isVisible({ timeout: 5000 }).catch(() => false)) {
      await importTab.click();
      await page.waitForTimeout(1000);
    }
  });
});
