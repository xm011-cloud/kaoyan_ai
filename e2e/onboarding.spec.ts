import { test, expect } from "@playwright/test";

// 新用户引导（开放注册后真实注册新账号验证引导展示）

test("new user sees onboarding modal and card after registration", async ({ page }) => {
  // 唯一新账号（开放注册，无需邀请码）
  const stamp = Date.now() % 10000000;
  const email = `e2e-onboard-${stamp}@example.com`;
  const password = "test-pass-123";

  // 注册
  const reg = await page.request.post("/api/auth/register", {
    data: { email, password, honeypot: "" },
  });
  expect(reg.status()).toBe(200);

  // 登录
  await page.goto("/login");
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.getByRole("button", { name: "登录" }).click();

  // 进入 dashboard（新用户）
  await page.waitForURL(/\/dashboard/, { timeout: 20000 });

  // 首次引导弹窗出现（欢迎 + AI 使用说明）
  await expect(page.getByText("🎉 欢迎来到 AI 考研助手")).toBeVisible({ timeout: 15000 });
  await expect(page.getByText(/AI 功能如何使用/)).toBeVisible();
  // 关闭弹窗
  await page.getByRole("button", { name: "先逛逛" }).click();

  // 引导卡常驻（3 步清单）
  await expect(page.getByText(/新手上路/)).toBeVisible({ timeout: 10000 });
  await expect(page.getByText("配置 AI Key", { exact: false }).first()).toBeVisible();
  await expect(page.getByText("设置考研目标", { exact: false }).first()).toBeVisible();
});
