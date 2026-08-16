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

// 确保 E2E 用户有目标科目（真题导入/练习出题的科目下拉依赖 goal.subjects）
// 用 upsert 防并行用例相互覆盖（Goal.userId unique）
async function ensureGoalSubjects(subjects: string[]) {
  const email = process.env.E2E_TEST_USER || "";
  const pool = new pg.Pool({ connectionString: testDbUrl() });
  try {
    const u = await pool.query('SELECT id FROM "User" WHERE email = $1', [email]);
    const userId = u.rows[0]?.id || "";
    expect(userId).toBeTruthy();
    await pool.query(
      `INSERT INTO "Goal" ("id","userId","university","major","examDate","subjects","createdAt","updatedAt")
       VALUES (gen_random_uuid(), $1, 'E2E 测试大学', 'E2E 测试专业', now() + interval '200 days', $2, now(), now())
       ON CONFLICT ("userId") DO UPDATE SET "subjects" = $2, "updatedAt" = now()`,
      [userId, subjects]
    );
  } finally {
    await pool.end();
  }
}

test("exam import shows wait-soothing bubble and can cancel", async ({ page }) => {
  // 准备：目标科目（导入表单的科目下拉依赖它）
  await ensureGoalSubjects(["计算机"]);

  // 拦截导入接口：延迟 6s 响应（联网搜题需 AI 提取，真实链路慢且依赖网络）
  await page.route("**/api/questions/import", async (route) => {
    await new Promise((r) => setTimeout(r, 6000));
    try {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ totalImported: 0, sources: [] }),
      });
    } catch {
      // 已取消，丢弃
    }
  });

  await page.goto("/wrong-questions?tab=exam");
  // subjects 异步加载（goal 需先取回），等科目下拉出现「真实科目」选项
  // （注意 fallback 项「请先设置目标科目」value=""，不能作为可选科目）
  const subjectSelect = page.locator("select").first();
  await page.waitForFunction(
    () => {
      const sel = document.querySelector("select");
      const first = sel?.options[0];
      return !!first && first.value !== "";
    },
    null,
    { timeout: 10000 }
  );
  const firstVal = await subjectSelect.locator("option").first().getAttribute("value");
  await subjectSelect.selectOption(firstVal!);

  const importBtn = page.getByRole("button", { name: "🔍 联网搜索并导入真题" });
  await expect(importBtn).toBeVisible({ timeout: 10000 });
  await importBtn.click();

  // 行内等待指示：阶段文案出现
  await expect(page.getByText("正在连接 AI")).toBeVisible({ timeout: 5000 });
  await expect(page.getByText("正在理解你的情况")).toBeVisible({ timeout: 6000 });

  // 取消：指示消失 + 按钮恢复 + 安静收场（无「导入失败」toast）
  await page.getByRole("button", { name: "取消本次生成" }).click();
  await expect(page.getByText(/正在理解你的情况|正在连接 AI/)).toHaveCount(0, { timeout: 10000 });
  await expect(page.getByRole("button", { name: "🔍 联网搜索并导入真题" })).toBeVisible({ timeout: 10000 });
  await expect(page.getByText("导入失败，请稍后再试")).toHaveCount(0);
});

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
  await expect(page.getByText("📚 真题库").first()).toBeVisible();

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
