import { test, expect } from "@playwright/test";

// 等待安抚状态机（已登录）：分阶段文案轮播 + 已等待时长/预估 + 可取消
// 用 page.route 拦截 AI 接口并延迟响应，模拟真实 AI 长等待 —— 不依赖真实 AI 调用
// 首访断言放宽到 20s：fresh 测试库首次触库（Neon 冷启动）可能偏慢

test("chat shows wait-soothing bubble with phases, estimate and cancel", async ({ page }) => {
  await page.route("**/api/user/settings", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({ json: { hasKey: true, aiConfigured: true, aiUrl: "https://example.com/v1", aiModel: "e2e", drivingMode: "assisted" } });
    } else {
      await route.continue();
    }
  });
  // 拦截 /api/ai/chat 并保持请求挂起，直到已点击取消。用显式门闩而非固定
  // 延迟，避免冷启动下断言与模拟响应互相抢时间，导致测试实际上看不到取消态。
  let markRequestStarted!: () => void;
  const requestStarted = new Promise<void>((resolve) => {
    markRequestStarted = resolve;
  });
  let releaseResponse!: () => void;
  const responseGate = new Promise<void>((resolve) => {
    releaseResponse = resolve;
  });
  await page.route("**/api/ai/chat", async (route) => {
    markRequestStarted();
    await responseGate;
    try {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ reply: "模拟回复", chatId: null }),
      });
    } catch {
      // 请求已被取消（点击了「取消」），丢弃本次响应
    }
  });

  await page.goto("/chat");
  const workspace = page.getByLabel("AI 工作区");
  await expect(workspace.getByRole("heading", { name: "AI 学习管家" })).toBeVisible({ timeout: 20000 });

  // 用当前学习管家的主输入框占位符精确锁定，避免误选其他页面的输入控件。
  const chatInput = workspace.getByPlaceholder(/描述计划、复盘或调整需要/);
  await expect(chatInput).toBeVisible({ timeout: 20000 });
  const sendBtn = workspace.getByRole("button", { name: "发送" });

  await chatInput.fill("你好");
  await sendBtn.click();
  await requestStarted;

  // 阶段 1（0~2.5s）：正在连接 AI
  await expect(workspace.getByText("正在连接 AI")).toBeVisible({ timeout: 5000 });

  // 阶段 2（2.5s+）：正在理解你的情况（阶段轮播生效）
  await expect(workspace.getByText("正在理解你的情况")).toBeVisible({ timeout: 8000 });

  // 已等待时长/预估出现（≥4s 后显示「已等待 N 秒，预计…」）
  await expect(workspace.getByText(/已等待 \d+ 秒/)).toBeVisible({ timeout: 8000 });

  // 取消：气泡消失，输入框恢复可用（不追加错误消息）
  const cancelButton = workspace.getByRole("button", { name: "取消本次生成" });
  await expect(cancelButton).toBeVisible();
  await cancelButton.click();
  // 允许被 abort 的拦截请求收尾，避免遗留一个 pending route。
  releaseResponse();
  await expect(workspace.getByText(/正在理解你的情况|正在连接 AI/)).toHaveCount(0, { timeout: 10000 });
  await expect(chatInput).toBeEnabled({ timeout: 10000 });
  // 安静收场：没有追加「AI 服务暂时不可用」错误气泡
  await expect(page.getByText("AI 服务暂时不可用，请稍后再试。")).toHaveCount(0);
});

test("feedback page shows inline wait indicator and can cancel", async ({ page }) => {
  // 拦截生成反馈接口：延迟 4s 响应
  await page.route("**/api/ai/generate-feedback", async (route) => {
    await new Promise((r) => setTimeout(r, 4000));
    try {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ regenerated: true, feedback: null }),
      });
    } catch {
      // 已取消，丢弃
    }
  });

  await page.goto("/feedback");
  await expect(page.getByRole("button", { name: "生成本周反馈" })).toBeVisible({ timeout: 20000 });

  await page.getByRole("button", { name: "生成本周反馈" }).click();

  // 行内等待指示：阶段文案可见
  await expect(page.getByText("正在连接 AI")).toBeVisible({ timeout: 5000 });

  // 取消：指示消失
  await page.getByRole("button", { name: "取消本次生成" }).click();
  await expect(page.getByText("正在连接 AI")).toHaveCount(0, { timeout: 10000 });
  await expect(page.getByRole("button", { name: "生成本周反馈" })).toBeEnabled({ timeout: 10000 });
});
