import { test, expect } from "@playwright/test";
import pg from "pg";

// 真题链路（已登录）：真题 Tab 展示 + 真题练习 API
// 直插测试库数据（网络受限不依赖真实导入），验证管理 + 练习闭环

function testDbUrl(): string {
  const url = process.env.DATABASE_URL || process.env.MEMFIRE_DATABASE_URL;
  const qIdx = url!.indexOf("?");
  const base = qIdx === -1 ? url! : url!.slice(0, qIdx);
  const slash = base.lastIndexOf("/");
  return `${base.slice(0, slash + 1)}${base.slice(slash + 1)}_test${qIdx === -1 ? "" : url!.slice(qIdx)}`;
}

test("exam questions: listed in 真题 tab and usable in practice", async ({ page }) => {
  // 准备：E2E 用户 id + 直插两条真题（跨 run 唯一文本）
  const email = process.env.E2E_TEST_USER || "";
  const stamp = Date.now() % 1000000;
  const pool = new pg.Pool({ connectionString: testDbUrl() });
  let userId = "";
  try {
    const u = await pool.query('SELECT id FROM "User" WHERE email = $1', [email]);
    userId = u.rows[0]?.id || "";
    expect(userId).toBeTruthy();
    await pool.query(
      `INSERT INTO "ImportedQuestion" ("id","userId","subject","year","source","question","type","options","answer","explanation","tags","createdAt")
       VALUES (gen_random_uuid(), $1, '计算机', 2024, 'https://example.com/exam', $2, 'choice', $3, 'B', '栈是后进先出（LIFO）。', '{数据结构}', now())`,
      [userId, `栈的特点是什么？E2E${stamp}`, JSON.stringify(["A. 先进先出", "B. 后进先出", "C. 随机存取"])]
    );
  } finally {
    await pool.end();
  }

  // 真题 Tab：列表展示 + 计数
  await page.goto("/wrong-questions?tab=exam");
  await expect(page.getByText(`栈的特点是什么？E2E${stamp}`)).toBeVisible({ timeout: 20000 });
  await expect(page.getByText(/已导入 \d+ 道/)).toBeVisible();
  await expect(page.getByText("📚 真题").first()).toBeVisible();

  // 真题练习 API：generationMode=exam_questions 直接抽真题
  const res = await page.request.post("/api/practice", {
    data: { type: "daily", subject: "计算机", count: 1, generationMode: "exam_questions" },
  });
  const data = await res.json();
  expect(res.status()).toBe(200);
  const qs = data.session?.questions || [];
  const found = qs.find((q: { question: string }) => q.question.includes(`栈的特点`));
  expect(found).toBeTruthy();
  expect(found.correctAnswer).toBe("B");
  expect(found.explanation).toContain("后进先出");

  // 空真题科目 → 友好提示（404）
  const empty = await page.request.post("/api/practice", {
    data: { type: "daily", subject: "政治", count: 5, generationMode: "exam_questions" },
  });
  expect(empty.status()).toBe(404);
});
