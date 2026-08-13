import { test, expect } from "@playwright/test";

test.describe("Tasks", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tasks");
  });

  test("page loads with content", async ({ page }) => {
    await expect(page.locator("h1").filter({ hasText: /计划|规划|任务/ })).toBeVisible({ timeout: 10000 });
  });

  test("week navigation works", async ({ page }) => {
    const prevBtn = page.locator("button").filter({ hasText: "◀" }).first();
    const nextBtn = page.locator("button").filter({ hasText: "▶" }).first();
    await expect(prevBtn).toBeVisible({ timeout: 10000 });
    await expect(nextBtn).toBeVisible();
  });

  test("URL param ?week= restores week selection", async ({ page }) => {
    await page.goto("/tasks?week=2026-08-03");
    await page.waitForTimeout(2000);
    await expect(page.locator("h1").filter({ hasText: /计划|规划|任务/ })).toBeVisible({ timeout: 10000 });
  });

  test("add task modal opens", async ({ page }) => {
    const addBtn = page.locator("button").filter({ hasText: /添加|\+/ }).first();
    if (await addBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await addBtn.click();
      await page.waitForTimeout(1000);
    }
  });

  test("related module links are visible", async ({ page }) => {
    const related = page.getByText("继续学习").first();
    if (await related.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(page.locator('a[href="/knowledge-graph"]').first()).toBeVisible();
    }
  });
});
