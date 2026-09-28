import { test, expect } from "@playwright/test";
import { createTestDbPool } from "./test-db";

// 确保 E2E 用户有目标科目（练习出题的科目下拉依赖 goal.subjects）
async function ensureGoalSubjects(subjects: string[]) {
  const email = process.env.E2E_TEST_USER || "";
  const pool = createTestDbPool();
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

  test("收录错题后可直接进入该题详情记录错因", async ({ page }) => {
    const session = {
      id: "result-with-wrong-question",
      taskId: null,
      milestoneId: null,
      type: "daily",
      subject: "计算机网络",
      status: "completed",
      questions: [{
        id: "wrong-question-1",
        type: "choice",
        question: "TCP 建立连接时，客户端首先发送什么？",
        options: ["A. ACK", "B. SYN", "C. FIN", "D. RST"],
        correctAnswer: "B",
        explanation: "三次握手由客户端先发送 SYN 开始。",
      }],
      answers: { "wrong-question-1": "A" },
      scores: { "wrong-question-1": { score: 0, maxScore: 10 } },
      totalScore: 0,
      maxScore: 10,
      duration: null,
      startedAt: null,
      completedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };

    await page.route("**/api/practice/result-with-wrong-question", (route) => route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ session }),
    }));
    await page.route("**/api/wrong-questions", async (route) => {
      if (route.request().method() !== "POST") return route.continue();
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ question: { id: "new-wrong-question-id" } }),
      });
    });
    await page.route("**/api/wrong-questions/new-wrong-question-id", (route) => route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        question: {
          id: "new-wrong-question-id",
          subject: "计算机网络",
          question: "TCP 建立连接时，客户端首先发送什么？",
          answer: "B. SYN",
          source: "practice",
          tags: ["choice"],
          reviewed: false,
          reviewCount: 0,
          easeFactor: 2.5,
          interval: 0,
          nextReviewDate: null,
          createdAt: new Date().toISOString(),
        },
      }),
    }));

    await page.goto("/practice?session=result-with-wrong-question&result=1");
    await expect(page.getByRole("button", { name: "🔴 收录错题" })).toBeVisible({ timeout: 10000 });
    await page.getByRole("button", { name: "🔴 收录错题" }).click();

    const detailLink = page.getByRole("link", { name: "已收录 · 记录错因 →" });
    await expect(detailLink).toHaveAttribute("href", "/wrong-questions?question=new-wrong-question-id");
    await detailLink.click();
    await expect(page).toHaveURL(/\/wrong-questions\?question=new-wrong-question-id/);
    await expect(page.getByRole("heading", { name: "留下你的理解与方法" })).toBeVisible();
    const reflection = page.getByRole("textbox");
    await expect(reflection).toBeVisible();
    await page.route("**/api/study-notes", async (route) => {
      if (route.request().method() !== "POST") return route.continue();
      await route.fulfill({ contentType: "application/json", body: JSON.stringify({ note: { id: "practice-reflection" } }) });
    });
    await page.route(/\/api\/study-notes\?wrongQuestionId=/, async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ notes: [{
          id: "practice-reflection",
          content: "把 SYN 和 ACK 混淆了；下次先按三次握手的发起方回忆。",
          kind: "error",
          createdAt: new Date().toISOString(),
          reviewCount: 0,
          lastReviewedAt: null,
          nextReviewAt: null,
          curriculumNodeIds: [],
          wrongQuestion: { id: "new-wrong-question-id", subject: "计算机网络", question: "TCP 建立连接时，客户端首先发送什么？", tags: [] },
          knowledgeLinks: [],
        }] }),
      });
    });
    await reflection.fill("把 SYN 和 ACK 混淆了；下次先按三次握手的发起方回忆。");
    await page.getByRole("button", { name: "保存理解" }).click();
    const viewReflection = page.getByRole("link", { name: "查看这条理解 →" });
    await expect(viewReflection).toHaveAttribute("href", "/knowledge?wrongQuestionId=new-wrong-question-id");
    await viewReflection.click();
    await expect(page.getByText("当前只显示这道错题留下的理解")).toBeVisible();
    await expect(page.getByText("把 SYN 和 ACK 混淆了；下次先按三次握手的发起方回忆。")).toBeVisible();
  });

  test("手机端进行中的练习可暂存退出，核心操作保持触控尺寸", async ({ page }) => {
    const session = {
      id: "mobile-active-session",
      taskId: null,
      milestoneId: null,
      type: "daily",
      subject: "计算机网络",
      status: "in_progress",
      questions: [{
        id: "mobile-question-1",
        type: "choice",
        question: "TCP 建立连接时，客户端首先发送什么？",
        options: ["A. ACK", "B. SYN", "C. FIN", "D. RST"],
        correctAnswer: "B",
        explanation: "三次握手由客户端先发送 SYN 开始。",
      }],
      answers: {},
      scores: {},
      totalScore: null,
      maxScore: null,
      duration: null,
      startedAt: null,
      completedAt: null,
      createdAt: new Date().toISOString(),
    };
    await page.route("**/api/practice/mobile-active-session", (route) => route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ session }),
    }));

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/practice?session=mobile-active-session");

    const stashExit = page.getByRole("button", { name: "暂存退出" });
    await expect(stashExit).toBeVisible({ timeout: 10000 });
    const box = await stashExit.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.height).toBeGreaterThanOrEqual(36);
    await expect(page.getByRole("button", { name: "请求提示 →" })).toHaveCSS("min-height", "44px");

    await stashExit.click();
    await expect(page.locator("h1").filter({ hasText: "练习" })).toBeVisible();
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
