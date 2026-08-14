import { test, expect } from "@playwright/test";

// 未配置状态的标准 GET /api/user/settings 响应（mock 用）
const NOT_CONFIGURED = {
  hasKey: false,
  aiConfigured: false,
  aiUrl: "",
  aiModel: "",
  drivingMode: "assisted",
  aiTaskCount: 0,
  keyHint: "",
  navPreferences: null,
  practicePreferences: null,
};

// 已配置状态的标准响应（mock 用）
const CONFIGURED = {
  ...NOT_CONFIGURED,
  hasKey: true,
  aiConfigured: true,
  aiUrl: "https://api.xiaomimimo.com/v1",
  aiModel: "mimo-v2.5-pro",
  keyHint: "sk-abc...xyz1",
};

function mockSettings(page: import("@playwright/test").Page, payload: Record<string, unknown>) {
  return page.route("**/api/user/settings", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({ json: payload });
    } else {
      await route.continue();
    }
  });
}

test.describe("AI 配置引导", () => {
  test("settings 未配置：状态卡 + 测试按钮禁用", async ({ page }) => {
    await mockSettings(page, NOT_CONFIGURED);
    await page.goto("/settings");
    await expect(page.getByText("AI 未启用").first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/不配置不影响打卡、番茄钟/)).toBeVisible();
    await expect(page.getByRole("button", { name: /测试连接/ })).toBeDisabled();
  });

  test("settings 已配置：状态卡 + 测试连接成功", async ({ page }) => {
    await mockSettings(page, CONFIGURED);
    await page.route("**/api/user/settings/test-ai", async (route) => {
      await route.fulfill({ json: { ok: true, model: "mimo-v2.5-pro", latencyMs: 120 } });
    });
    await page.goto("/settings");
    await expect(page.getByText(/AI 已启用/).first()).toBeVisible({ timeout: 10000 });
    const testBtn = page.getByRole("button", { name: /测试连接/ });
    await expect(testBtn).toBeEnabled();
    await testBtn.click();
    await expect(page.getByText(/连接成功/)).toBeVisible({ timeout: 10000 });
  });

  test("chat 未配置：引导条可见 + 输入禁用", async ({ page }) => {
    await mockSettings(page, NOT_CONFIGURED);
    await page.goto("/chat");
    await expect(page.getByText("AI 未启用").first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole("link", { name: /去配置/ })).toBeVisible();
    await expect(page.locator('input[placeholder*="输入"]')).toBeDisabled();
  });

  test("chat 收到 needConfig 响应后显示引导条", async ({ page }) => {
    // 拦截 AI 对话：返回 needConfig（模拟未配置/Key 失效）
    await page.route("**/api/ai/chat", async (route) => {
      await route.fulfill({
        json: {
          reply: "请先在设置页面配置你的 AI API Key（支持 MiMo、DeepSeek、通义千问等兼容 OpenAI 接口的服务）后，才能使用 AI 问答功能。",
          needConfig: true,
        },
      });
    });
    await page.goto("/chat");
    // 聊天页输入框（浮窗输入框 placeholder 为"输入指令"，不匹配"问题"）
    const input = page
      .locator('input[placeholder*="你的问题"]')
      .or(page.locator('input[placeholder*="输入问题"]'));
    await expect(input).toBeEnabled({ timeout: 10000 });
    await input.fill("你好");
    await page.getByRole("button", { name: "发送" }).click();
    await expect(page.getByText("AI 未启用").first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/请先在设置页面配置/)).toBeVisible();
  });
});
