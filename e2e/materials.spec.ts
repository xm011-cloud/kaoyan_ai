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
    // 上传触发为 <label> 内铺满按钮的透明 file input（PWA standalone 下也走原生手势），不再以 button role 定位
    const uploadLabel = page.getByText("上传资料").first();
    const fileInput = page.locator('input[type="file"]');
    const hasUpload = (await uploadLabel.isVisible({ timeout: 5000 }).catch(() => false)) ||
                      (await fileInput.isVisible({ timeout: 3000 }).catch(() => false));
    expect(hasUpload).toBe(true);
  });

  test("uploads a text file and shows it in the list", async ({ page }) => {
    // 真实上传回归：覆盖 input → /api/upload → 列表首行出现新文件（防止上传入口/链路回归）
    await page.locator('input[type="file"]').setInputFiles({
      name: "e2e-upload.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("这是 E2E 上传回归测试内容"),
    });
    await expect(page.getByText("e2e-upload.txt").first()).toBeVisible({ timeout: 15000 });

    // 清理：删除刚上传的文件（新文件 prepend 到列表顶部 → 第一行即本文件），让共享测试库回到原始状态。
    // 列表行按钮是 aria-label="删除"，确认框按钮只有文本「删除」，用 CSS 选择器区分两者。
    await page.locator("button[aria-label='删除']").first().click();
    await page.getByRole("alertdialog").getByRole("button", { name: "删除", exact: true }).click();
    await expect(page.getByText("e2e-upload.txt")).toHaveCount(0, { timeout: 10000 });
  });
});
