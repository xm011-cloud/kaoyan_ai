import { test, expect } from "@playwright/test";

// 产品反馈页（需登录，authenticated 项目）

test("suggestions page renders", async ({ page }) => {
  await page.goto("/suggestions");
  await expect(page.locator("h1", { hasText: "问题与建议" })).toBeVisible({ timeout: 10000 });
  await expect(page.locator('textarea[id="fb-content"]')).toBeVisible();
  await expect(page.getByRole("button", { name: "页面有问题" })).toBeVisible();
});

test("用户无需星级即可提交带页面上下文的问题，并看到处理进度", async ({ page }) => {
  await page.goto("/suggestions");
  await page.getByRole("button", { name: "这里看不懂" }).click();
  const content = `E2E 产品反馈 ${Date.now()}`;
  await page.fill('textarea[id="fb-content"]', content);
  await page.getByRole("button", { name: "提交给作者" }).click();
  await expect(page.getByText("反馈已收到")).toBeVisible({ timeout: 10000 });
  const item = page.locator("article", { hasText: content });
  await expect(item).toContainText("已收到");
  await expect(item).toContainText("来自 /suggestions");
});
