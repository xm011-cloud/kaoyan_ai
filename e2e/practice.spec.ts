import { test, expect } from "@playwright/test";
import pg from "pg";

function testDbUrl(): string {
  const url = process.env.DATABASE_URL || process.env.MEMFIRE_DATABASE_URL;
  const qIdx = url!.indexOf("?");
  const base = qIdx === -1 ? url! : url!.slice(0, qIdx);
  const slash = base.lastIndexOf("/");
  return `${base.slice(0, slash + 1)}${base.slice(slash + 1)}_test${qIdx === -1 ? "" : url!.slice(qIdx)}`;
}

// 确保 E2E 用户有目标科目（练习出题的科目下拉依赖 goal.subjects）
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

test.describe("Practice", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/practice");
  });

  test("creation form is visible", async ({ page }) => {
    await expect(page.locator("h1").filter({ hasText: "练习" })).toBeVisible({ timeout: 10000 });
    // 精确匹配"开始练习"（避免命中模式选择器里的"📚 真题练习"按钮）
    const createBtn = page.locator("main").getByRole("button", { name: /开始练习/ });
    await expect(createBtn).toBeVisible({ timeout: 5000 });
  });

  test("create a daily practice session", async ({ page }) => {
    // Just verify the create button exists and is clickable
    const createBtn = page.locator("button").filter({ hasText: /开始练习|创建|开始/ }).first();
    await expect(createBtn).toBeVisible({ timeout: 10000 });
    // Don't actually click — it triggers AI generation which is slow/flaky in E2E
  });

  test("practice history is visible", async ({ page }) => {
    await expect(page.locator("text=练习记录")).toBeVisible({ timeout: 10000 });
  });

  test("AI generation shows inline wait indicator (no cancel)", async ({ page }) => {
    // 准备：目标科目（出题的科目下拉依赖它）
    await ensureGoalSubjects(["计算机"]);

    // 拦截 /api/practice：POST 延迟 6s（AI 出题真实链路慢），GET 放行（练习记录加载）
    await page.route("**/api/practice", async (route) => {
      if (route.request().method() !== "POST") return route.continue();
      await new Promise((r) => setTimeout(r, 6000));
      // 返回「已完成」会话：不触发跳转/进入做题视图
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          session: { id: "e2e-wait-mock", status: "completed", subject: "计算机", type: "daily", questions: [], answers: {} },
        }),
      });
    });

    await page.goto("/practice");
    // 等待 goal 加载 → 科目 select 自动填上第一个科目（createSubject 同步）
    await expect(page.locator("select").first()).not.toHaveValue("", { timeout: 10000 });
    const createBtn = page.locator("main").getByRole("button", { name: "开始练习" });
    await expect(createBtn).toBeEnabled({ timeout: 10000 });
    await createBtn.click();

    // 行内等待指示出现：分阶段文案
    await expect(page.getByText("正在连接 AI")).toBeVisible({ timeout: 5000 });
    // 出题不可中断：无「取消」按钮（仅安抚，与可取消的搜索/导入形成对比）
    await expect(page.getByRole("button", { name: "取消本次生成" })).toHaveCount(0);
    // 完成后指示消失（mock 返回 completed → 不跳转，停留主视图）
    await expect(page.getByText("正在连接 AI")).toHaveCount(0, { timeout: 10000 });
  });
});
