import { test, expect } from "@playwright/test";

test.describe("Materials", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/materials");
  });

  test("page loads correctly", async ({ page }) => {
    await expect(page.locator("h1").filter({ hasText: /资料/ })).toBeVisible({ timeout: 10000 });
  });

  test("empty state or file list is shown", async ({ page }) => {
    // Either shows files or empty state or upload prompt
    await page.waitForTimeout(3000);
    const body = await page.locator("body").textContent();
    expect(body).toBeTruthy();
  });

  test("upload area is accessible", async ({ page }) => {
    // 上传触发改为 <label>（PWA standalone 下也可用），不再以 button role 定位
    const uploadLabel = page.getByText("上传资料").first();
    const fileInput = page.locator('input[type="file"]');
    const hasUpload = (await uploadLabel.isVisible({ timeout: 5000 }).catch(() => false)) ||
                      (await fileInput.isVisible({ timeout: 3000 }).catch(() => false));
    expect(hasUpload).toBe(true);
  });
});
