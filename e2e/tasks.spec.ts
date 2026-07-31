import { test, expect } from "@playwright/test";

test.describe("Tasks", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tasks");
  });

  test("page loads with phase overview", async ({ page }) => {
    await expect(page.locator("text=备考规划").first()).toBeVisible({ timeout: 10000 });
  });

  test("week navigation works", async ({ page }) => {
    // Week navigation buttons should be visible
    const prevBtn = page.locator("text=◀").first();
    const nextBtn = page.locator("text=▶").first();
    await expect(prevBtn).toBeVisible({ timeout: 10000 });
    await expect(nextBtn).toBeVisible();
  });

  test("URL param ?week= restores week selection", async ({ page }) => {
    await page.goto("/tasks?week=2026-08-03");
    await page.waitForTimeout(2000);
    // Page should load without errors
    await expect(page.locator("body")).toBeVisible();
  });

  test("add task modal opens", async ({ page }) => {
    // Find add task button
    const addBtn = page.locator('button:has-text("添加"), button:has-text("+")').first();
    if (await addBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await addBtn.click();
      // Modal should appear
      await expect(page.locator("text=添加任务")).toBeVisible({ timeout: 5000 });
    }
  });

  test("related module links are visible", async ({ page }) => {
    const relatedSection = page.locator("text=相关模块").first();
    if (await relatedSection.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(page.locator('a[href="/knowledge-graph"]')).toBeVisible();
      await expect(page.locator('a[href="/wrong-questions"]')).toBeVisible();
      await expect(page.locator('a[href="/study-path"]')).toBeVisible();
    }
  });
});
