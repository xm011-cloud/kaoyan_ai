import { test, expect } from "@playwright/test";

// 合规页面与入口（隐私/协议/注销请求）

test.describe("合规", () => {
  test("privacy page renders with data-export disclosure", async ({ page }) => {
    await page.goto("/privacy");
    await expect(page.locator("h1").filter({ hasText: "隐私政策" })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/数据存储与出境说明/)).toBeVisible();
    await expect(page.getByText(/部署于海外服务商/)).toBeVisible();
    await expect(page.getByText(/迁回国内服务商/)).toBeVisible();
  });

  test("terms page renders with AI and copyright clauses", async ({ page }) => {
    await page.goto("/terms");
    await expect(page.locator("h1").filter({ hasText: "用户协议" })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/自带 Key 模式/)).toBeVisible();
    await expect(page.getByText(/版权声明/)).toBeVisible();
    await expect(page.getByText(/真题为/).first()).toBeVisible();
  });

  test("settings page shows account deletion request entry", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.getByRole("button", { name: /请求注销账号/ })).toBeVisible({ timeout: 20000 });
    await expect(page.getByRole("link", { name: /隐私政策/ })).toBeVisible();
  });
});
