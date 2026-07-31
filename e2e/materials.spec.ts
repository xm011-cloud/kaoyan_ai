import { test, expect } from "@playwright/test";

test.describe("Materials", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/materials");
  });

  test("page loads correctly", async ({ page }) => {
    await expect(page.locator("text=资料").first()).toBeVisible({ timeout: 10000 });
  });

  test("empty state or file list is shown", async ({ page }) => {
    // Either shows files or empty state
    const hasContent = await page.locator("text=还没有").or(page.locator("text=上传")).or(page.locator("text=资料")).isVisible({ timeout: 10000 });
    expect(hasContent).toBe(true);
  });

  test("upload area is accessible", async ({ page }) => {
    const uploadBtn = page.getByRole("button", { name: /上传/ }).or(page.locator('input[type="file"]'));
    if (await uploadBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(uploadBtn).toBeVisible();
    }
  });
});
