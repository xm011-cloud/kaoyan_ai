import { test, expect } from "@playwright/test";

// AI 技能系统（已登录）：模板播种 + 技能架页 + CRUD
// 避开真实 AI 调用：只测页面渲染 + 技能 CRUD API
// 首访断言放宽到 20s：fresh 测试库首次触库（Neon 冷启动）可能偏慢

test("skills page loads with 3 template skills seeded", async ({ page }) => {
  await page.goto("/skills");
  await expect(page.getByRole("heading", { name: "⚡ 我的技能" })).toBeVisible({ timeout: 20000 });
  await expect(page.getByText("每日复盘", { exact: true }).first()).toBeVisible({ timeout: 20000 });
  await expect(page.getByText("错题变式训练", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("费曼抽查", { exact: true }).first()).toBeVisible();
});

test("run button links to chat with skill param", async ({ page }) => {
  await page.goto("/skills");
  await expect(page.getByText("每日复盘", { exact: true }).first()).toBeVisible({ timeout: 20000 });
  const href = await page
    .getByText("每日复盘", { exact: true })
    .first()
    .locator("xpath=ancestor::div[contains(@class,'flex flex-col')][1]")
    .getByRole("link", { name: /运行/ })
    .getAttribute("href");
  expect(href).toMatch(/^\/chat\?skill=/);
});

test("create, edit and delete a custom skill via API + UI", async ({ page }) => {
  // 唯一名称：测试库跨 run 持久化，避免与上次 run 残留的同名技能冲突
  const stamp = Date.now();
  const origName = `测试技能${stamp}`;
  const newName = `测试技能改${stamp}`;

  await page.goto("/skills");
  await expect(page.getByRole("heading", { name: "⚡ 我的技能" })).toBeVisible({ timeout: 20000 });

  const id = await page.evaluate(async (name) => {
    const res = await fetch("/api/skills", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        description: "自动测试创建",
        triggerKeywords: ["测试"],
        steps: [{ type: "ai", instruction: "说一句你好" }, { type: "finish" }],
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "create failed");
    return data.skill.id;
  }, origName);
  expect(id).toBeTruthy();

  await page.reload();
  await expect(page.getByText(origName, { exact: true }).first()).toBeVisible({ timeout: 20000 });

  // 编辑改名
  await page
    .getByText(origName, { exact: true })
    .first()
    .locator("xpath=ancestor::div[contains(@class,'flex flex-col')][1]")
    .getByRole("button", { name: "编辑" })
    .click();
  await page.locator(`input[value="${origName}"]`).fill(newName);
  await page.getByRole("button", { name: /保存/ }).click();
  await expect(page.getByText(newName, { exact: true }).first()).toBeVisible({ timeout: 10000 });

  // 删除
  await page
    .getByText(newName, { exact: true })
    .first()
    .locator("xpath=ancestor::div[contains(@class,'flex flex-col')][1]")
    .getByRole("button", { name: "删除" })
    .click();
  await page.getByRole("dialog", { name: "删除技能确认" }).getByRole("button", { name: "删除", exact: true }).click();
  await expect(page.getByText(newName, { exact: true })).toHaveCount(0, { timeout: 10000 });
});

test("duplicate skill name returns 409", async ({ page }) => {
  await page.goto("/skills");
  await expect(page.getByRole("heading", { name: "⚡ 我的技能" })).toBeVisible({ timeout: 20000 });

  const status = await page.evaluate(async () => {
    const res = await fetch("/api/skills", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "每日复盘", steps: [{ type: "ai", instruction: "x" }] }),
    });
    return res.status;
  });
  expect(status).toBe(409);
});

// ── Round B：技能运行引擎（避开真实 AI 调用，只测 UI 承载位）──

test("chat slash menu lists user skills", async ({ page }) => {
  await page.goto("/chat");
  // 注意：页面右下角有浮动 AI 组件（自带输入框），用占位符精确锁定主对话输入框
  const chatInput = page.getByPlaceholder(/输入你的问题/);
  await expect(chatInput).toBeVisible({ timeout: 20000 });

  await chatInput.type("/");
  await expect(page.getByRole("menu", { name: "运行技能" })).toBeVisible({ timeout: 10000 });
  await expect(page.getByRole("menuitem", { name: /每日复盘/ })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: /错题变式训练/ })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: /费曼抽查/ })).toBeVisible();
});

test("chat restores skill chat with running badge + kickoff notice", async ({ page }) => {
  // 先造一条技能对话（首条 kickoff 消息），走 /api/chat 持久化
  await page.goto("/chat");
  await expect(page.locator("h1").filter({ hasText: "AI 对话" })).toBeVisible({ timeout: 20000 });
  const id = await page.evaluate(async () => {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chatId: null,
        messages: [{ id: "seed_0", role: "user", content: "运行技能「每日复盘」" }],
      }),
    });
    const data = await res.json();
    return data.chat.id;
  });
  expect(id).toBeTruthy();

  await page.goto(`/chat?chat=${id}`);
  await expect(page.getByText("⚡ 正在运行技能：每日复盘")).toBeVisible({ timeout: 20000 });
  await expect(page.getByText("⚡ 技能：每日复盘", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "结束技能" })).toBeVisible();
});

test("chat ?skill=nonexistent falls back to normal chat", async ({ page }) => {
  await page.goto("/chat?skill=nonexistent-id");
  await expect(page.locator("h1").filter({ hasText: "AI 对话" })).toBeVisible({ timeout: 20000 });
  await expect(page.getByText("开始提问吧")).toBeVisible({ timeout: 20000 });
});

// ── Round C：对话蒸馏 + AI 主动提议（避开真实 AI 调用）──

test("skill distill API validates chatId", async ({ page }) => {
  await page.goto("/chat");
  await expect(page.locator("h1").filter({ hasText: "AI 对话" })).toBeVisible({ timeout: 20000 });

  const missing = await page.evaluate(async () => {
    const res = await fetch("/api/skills/distill", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    return res.status;
  });
  expect(missing).toBe(400);

  const notFound = await page.evaluate(async () => {
    const res = await fetch("/api/skills/distill", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chatId: "nonexistent-chat" }),
    });
    return res.status;
  });
  expect(notFound).toBe(404);
});

test("chat shows skill suggestion chip (suggestedSkill field) and can close it", async ({ page }) => {
  await page.goto("/chat");
  await expect(page.locator("h1").filter({ hasText: "AI 对话" })).toBeVisible({ timeout: 20000 });

  // 造一条带 suggestedSkill 的消息（模拟 AI 主动提议响应），走 /api/chat 持久化
  const id = await page.evaluate(async () => {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chatId: null,
        messages: [
          { id: "seed_0", role: "user", content: "帮我复盘一下今天" },
          {
            id: "seed_1",
            role: "assistant",
            content: "好的，这是今天的复盘。",
            suggestedSkill: { id: "sug-skill", name: "每日复盘", icon: "🌅", description: "看看今天学了什么" },
          },
        ],
      }),
    });
    const data = await res.json();
    return data.chat.id;
  });
  expect(id).toBeTruthy();

  await page.goto(`/chat?chat=${id}`);
  // 有消息 → 「存为技能」按钮可见
  await expect(page.getByRole("button", { name: "💾 存为技能" })).toBeVisible({ timeout: 20000 });
  // 建议芯片渲染
  await expect(page.getByText(/你可能想用「🌅 每日复盘」/)).toBeVisible({ timeout: 20000 });
  // 可关闭
  await page.getByRole("button", { name: "关闭技能建议" }).click();
  await expect(page.getByText(/你可能想用「🌅 每日复盘」/)).toHaveCount(0, { timeout: 10000 });
});
