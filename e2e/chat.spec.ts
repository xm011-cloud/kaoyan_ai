import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { expect, test } from "@playwright/test";
import { createTestDbPool } from "./test-db";

test.describe("AI 工作区入口", () => {
  test("桌面端旧 /chat 链接会打开工作台中的 AI 协作区", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/chat?chat=nonexistent-id");

    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByRole("heading", { name: "AI 学习管家" })).toBeVisible();
    await expect(page.getByPlaceholder(/描述计划、复盘或调整需要|配置 AI 后开启学习管家/)).toBeVisible();
  });

  test("手机端旧 /chat 链接以全屏 AI 工作区呈现", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/chat");

    await expect(page.getByRole("heading", { name: "AI 学习管家" })).toBeVisible();
    await expect(page.getByPlaceholder(/描述计划、复盘或调整需要|配置 AI 后开启学习管家/)).toBeVisible();
  });
});

test("AI 任务草稿不会写入其他用户传入的对话", async ({ page }) => {
  test.setTimeout(120000);
  const pool = createTestDbPool();
  const suffix = randomUUID();
  const ownerEmail = process.env.E2E_TEST_USER || "";
  const ownerResult = await pool.query('SELECT id, "aiKey", "aiUrl", "aiModel" FROM "User" WHERE email = $1', [ownerEmail]);
  const owner = ownerResult.rows[0] as {
    id: string;
    aiKey: string | null;
    aiUrl: string | null;
    aiModel: string | null;
  } | undefined;
  expect(owner?.id).toBeTruthy();

  const foreignUserId = `e2e-chat-foreign-user-${suffix}`;
  const foreignChatId = `e2e-chat-foreign-chat-${suffix}`;
  let createdChatId: string | null = null;
  let provider: ReturnType<typeof createServer> | null = null;

  try {
    await pool.query(
      `INSERT INTO "User" ("id", "email", "reminderDays", "createdAt", "updatedAt")
       VALUES ($1, $2, ARRAY[]::text[], now(), now())`,
      [foreignUserId, `e2e-chat-foreign-${suffix}@example.test`],
    );
    await pool.query(
      `INSERT INTO "Chat" ("id", "userId", "messages", "createdAt", "updatedAt")
       VALUES ($1, $2, $3::jsonb, now(), now())`,
      [foreignChatId, foreignUserId, JSON.stringify([])],
    );

    let aiCallCount = 0;
    provider = createServer((request, response) => {
      request.resume();
      request.on("end", () => {
        aiCallCount += 1;
        const message = aiCallCount === 1
          ? {
              content: "",
              tool_calls: [{
                id: "call_propose_tasks",
                type: "function",
                function: {
                  name: "propose_tasks",
                  arguments: JSON.stringify({
                    items: [{ title: "安全回归任务", date: "2026-10-01", duration: 30, subject: "数学" }],
                    note: "仅用于验证对话归属",
                  }),
                },
              }],
            }
          : { content: "已生成待确认的任务草稿。" };
        response.writeHead(200, { "Content-Type": "application/json" });
        response.end(JSON.stringify({ choices: [{ message }] }));
      });
    });
    await new Promise<void>((resolve, reject) => {
      provider!.once("error", reject);
      provider!.listen(0, "127.0.0.1", () => resolve());
    });
    const address = provider.address();
    expect(address && typeof address !== "string").toBeTruthy();
    const port = typeof address === "object" && address ? address.port : 0;

    const saveConfig = await page.request.put("/api/user/settings", {
      data: { aiKey: "sk-e2e-security", aiUrl: `http://127.0.0.1:${port}/v1`, aiModel: "e2e" },
    });
    expect(saveConfig.status()).toBe(200);

    const chatResponse = await page.request.post("/api/ai/chat", {
      data: {
        chatId: foreignChatId,
        messages: [{ role: "user", content: "请安排今天的一项复习任务" }],
      },
    });
    expect(chatResponse.status()).toBe(200);
    const chatBody = await chatResponse.json();
    createdChatId = chatBody.chatId;
    expect(createdChatId).toBeTruthy();
    expect(createdChatId).not.toBe(foreignChatId);
    expect(chatBody.proposal).toMatchObject({ action: "wait_for_confirmation", total: 1 });

    const foreignChat = await pool.query('SELECT "pendingProposal" FROM "Chat" WHERE id = $1', [foreignChatId]);
    expect(foreignChat.rows[0]?.pendingProposal).toBeNull();
    const ownChat = await pool.query('SELECT "userId", "pendingProposal" FROM "Chat" WHERE id = $1', [createdChatId]);
    expect(ownChat.rows[0]).toMatchObject({ userId: owner!.id });
    expect(ownChat.rows[0]?.pendingProposal).toBeTruthy();
  } finally {
    if (createdChatId) await pool.query('DELETE FROM "Chat" WHERE id = $1', [createdChatId]);
    await pool.query('DELETE FROM "Chat" WHERE id = $1', [foreignChatId]);
    await pool.query('DELETE FROM "User" WHERE id = $1', [foreignUserId]);
    if (owner) {
      await pool.query(
        'UPDATE "User" SET "aiKey" = $1, "aiUrl" = $2, "aiModel" = $3 WHERE id = $4',
        [owner.aiKey, owner.aiUrl, owner.aiModel, owner.id],
      );
    }
    if (provider) await new Promise<void>((resolve) => provider!.close(() => resolve()));
    await pool.end();
  }
});
