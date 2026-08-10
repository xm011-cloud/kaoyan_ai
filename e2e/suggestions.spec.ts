import { test, expect } from "@playwright/test";

// 意见反馈页（需登录，authenticated 项目）

test("suggestions page renders", async ({ page }) => {
  await page.goto("/suggestions");
  await expect(page.locator("h1", { hasText: "意见反馈" })).toBeVisible({ timeout: 10000 });
  await expect(page.locator('textarea[id="fb-content"]')).toBeVisible();
});

test("submit suggestion with star rating shows success", async ({ page }) => {
  await page.goto("/suggestions");
  await page.locator('button[aria-label="5 星"]').click();
  await page.fill('textarea[id="fb-content"]', "E2E 测试反馈");
  await page.getByRole("button", { name: "提交反馈" }).click();
  await expect(page.locator("text=已收到你的反馈")).toBeVisible({ timeout: 10000 });
});
