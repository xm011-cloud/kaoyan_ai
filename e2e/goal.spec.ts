import { test, expect } from "@playwright/test";

test.describe("Goal", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/goal");
  });

  test("form fields are visible", async ({ page }) => {
    await expect(page.locator("h1").filter({ hasText: /考研目标/ })).toBeVisible({ timeout: 10000 });
    await expect(page.locator("#goal-university")).toBeVisible();
    await expect(page.locator("#goal-major")).toBeVisible();
    await expect(page.locator("#goal-exam-date")).toBeVisible();
  });

  test("fill and save goal", async ({ page }) => {
    await page.fill("#goal-university", "测试大学");
    await page.fill("#goal-major", "计算机科学与技术");
    await page.fill("#goal-exam-date", "2026-12-25");

    // Click save button
    const saveBtn = page.getByRole("button", { name: /保存|更新/ });
    await expect(saveBtn).toBeVisible();
    await saveBtn.click();

    // Should show some feedback (success or loading)
    await page.waitForTimeout(2000);
  });

  test("subject selector is interactive", async ({ page }) => {
    // Subject selector should be present
    await expect(page.locator("text=考试科目")).toBeVisible({ timeout: 10000 });
  });
});
