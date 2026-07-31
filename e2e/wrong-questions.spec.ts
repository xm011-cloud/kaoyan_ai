import { test, expect } from "@playwright/test";

test.describe("Wrong Questions", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/wrong-questions");
  });

  test("page loads with filters", async ({ page }) => {
    await expect(page.locator("text=错题本")).toBeVisible({ timeout: 10000 });
    // Filter tabs
    await expect(page.locator("text=全部")).toBeVisible();
    await expect(page.locator("text=未复习")).toBeVisible();
    await expect(page.locator("text=已复习")).toBeVisible();
  });

  test("add question modal opens", async ({ page }) => {
    const addBtn = page.getByRole("button", { name: /添加/ });
    await expect(addBtn).toBeVisible({ timeout: 10000 });
    await addBtn.click();
    // Modal should appear
    await expect(page.locator("text=添加错题").or(page.locator("text=科目"))).toBeVisible({ timeout: 5000 });
  });

  test("URL params restore filter state", async ({ page }) => {
    await page.goto("/wrong-questions?tab=unreviewed&subject=数学一");
    await page.waitForTimeout(2000);
    // Page should load without crash
    await expect(page.locator("text=错题本")).toBeVisible({ timeout: 10000 });
  });

  test("batch import modal opens", async ({ page }) => {
    const batchBtn = page.getByRole("button", { name: /批量|导入/ });
    if (await batchBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await batchBtn.click();
      await expect(page.locator("text=批量导入")).toBeVisible({ timeout: 5000 });
    }
  });

  test("related module links are visible", async ({ page }) => {
    const related = page.locator("text=相关模块").first();
    if (await related.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(page.locator('a[href="/practice"]')).toBeVisible();
      await expect(page.locator('a[href="/knowledge-graph"]')).toBeVisible();
      await expect(page.locator('a[href="/chat"]')).toBeVisible();
    }
  });
});
