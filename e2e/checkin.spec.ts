import { test, expect } from "@playwright/test";

test.describe("Check-in", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/checkin");
  });

  test("form is visible", async ({ page }) => {
    await expect(page.locator("h1").filter({ hasText: "每日打卡" })).toBeVisible({ timeout: 10000 });
    await expect(page.locator("#checkin-duration")).toBeVisible();
  });

  test("submit check-in", async ({ page }) => {
    await page.fill("#checkin-duration", "60");
    await page.locator("text=状态很好").click();
    const noteField = page.locator("#checkin-note");
    if (await noteField.isVisible({ timeout: 3000 }).catch(() => false)) {
      await noteField.fill("E2E 测试打卡");
    }
    const submitBtn = page.getByRole("button", { name: /打卡/ });
    await submitBtn.click();
    await page.waitForTimeout(2000);
  });

  test("related module links are visible", async ({ page }) => {
    const related = page.locator("text=相关模块").first();
    if (await related.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(page.locator('a[href="/pomodoro"]').first()).toBeVisible();
    }
  });
});
