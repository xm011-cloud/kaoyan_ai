import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { createTestDbPool } from "./test-db";

test.describe("Goal", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/goal");
  });

  test("form fields are visible", async ({ page }) => {
    await expect(page.locator("h1").filter({ hasText: /考研方向/ })).toBeVisible({ timeout: 10000 });
    await expect(page.locator("#goal-university")).toBeVisible();
    await expect(page.locator("#goal-major")).toBeVisible();
    await expect(page.locator("#goal-exam-date")).toBeVisible();
  });

  test("fill and save goal", async ({ page }) => {
    await page.fill("#goal-university", "测试大学");
    await page.fill("#goal-major", "计算机科学与技术");
    await page.fill("#goal-exam-date", "2026-12-25");

    // Click save button
    const saveBtn = page.getByRole("button", { name: /保存|更新/ });
    await expect(saveBtn).toBeVisible();
    await saveBtn.click();

    // Should show some feedback (success or loading)
    await page.waitForTimeout(2000);
  });

  test("subject selector is interactive", async ({ page }) => {
    // Subject selector should be present
    await expect(page.locator("text=考试科目")).toBeVisible({ timeout: 10000 });
  });

  test("can save an exploring direction without inventing a school or date", async ({ page }) => {
    test.setTimeout(120000);
    const pool = createTestDbPool();
    const userResult = await pool.query('SELECT id FROM "User" WHERE email = $1', [process.env.E2E_TEST_USER || ""]);
    const userId = userResult.rows[0]?.id as string;
    const confirmedFacts = await pool.query(
      'SELECT id, status FROM "StudyProfileFact" WHERE "userId" = $1 AND status = \'confirmed\'',
      [userId],
    );
    const activePaths = await pool.query(
      'SELECT id, status FROM "StudyPath" WHERE "userId" = $1 AND status = \'active\'',
      [userId],
    );
    await pool.query(
      'UPDATE "StudyProfileFact" SET status = \'superseded\', "updatedAt" = now() WHERE "userId" = $1 AND status = \'confirmed\'',
      [userId],
    );
    // 这条用例验证“首次”生成的保护；暂时移开历史路线，最后按原状态还原。
    await pool.query(
      'UPDATE "StudyPath" SET status = \'archived\', "updatedAt" = now() WHERE "userId" = $1 AND status = \'active\'',
      [userId],
    );
    const original = await page.evaluate(async () => {
      const res = await fetch("/api/goal");
      return (await res.json()).goal;
    });
    let readyFactIds: string[] = [];

    try {
      const result = await page.evaluate(async () => {
        const res = await fetch("/api/goal", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            direction: "计算机类考研",
            university: null,
            major: null,
            examDate: null,
            subjects: [],
          }),
        });
        return { status: res.status, body: await res.json() };
      });

      expect(result.status).toBe(200);
      expect(result.body.goal).toMatchObject({
        direction: "计算机类考研",
        university: null,
        major: null,
        examDate: null,
        status: "exploring",
      });

      await page.reload();
      await expect(page.locator("#goal-direction")).toHaveValue("计算机类考研", { timeout: 15000 });
      await expect(page.getByText("目标探索中", { exact: true }).first()).toBeVisible();

      await page.goto("/dashboard");
      await expect(page.getByText("计算机类考研", { exact: true })).toBeVisible();

      const pathResult = await page.evaluate(async () => {
        const res = await fetch("/api/study-path", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ generationMode: "local" }),
        });
        return { status: res.status, body: await res.json() };
      });
      expect(pathResult.status).toBe(409);
      expect(pathResult.body.needsIntake).toBe(true);
      expect(pathResult.body.readiness.unresolvedFields.length).toBeGreaterThan(0);

      // 周计划入口也必须遵守同一门槛，并且在拒绝时不能创建草稿。
      const weeklyResult = await page.evaluate(async () => {
        await fetch("/api/goal", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            direction: "计算机类考研",
            university: null,
            major: null,
            examDate: null,
            subjects: ["数学一"],
          }),
        });
        const weekStart = "2035-01-01";
        const before = await fetch(`/api/weekly-plans?weekStart=${weekStart}`).then((res) => res.json());
        const res = await fetch("/api/ai/generate-plan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ weekStartDate: weekStart, weekStartLocal: weekStart, todayLocal: weekStart, generationMode: "local" }),
        });
        const after = await fetch(`/api/weekly-plans?weekStart=${weekStart}`).then((response) => response.json());
        return { status: res.status, body: await res.json(), beforeDraftId: before.draft?.id ?? null, afterDraftId: after.draft?.id ?? null };
      });
      expect(weeklyResult.status).toBe(409);
      expect(weeklyResult.body.needsIntake).toBe(true);
      expect(weeklyResult.body.readiness.unresolvedFields).toEqual(expect.arrayContaining(["目标与当前情况", "各科基础"]));
      expect(weeklyResult.afterDraftId).toBe(weeklyResult.beforeDraftId);

      // 资料齐全后也先进入路线确认，不允许绕过阶段和里程碑直接排周任务。
      readyFactIds = Array.from({ length: 4 }, () => `e2e-weekly-route-gate-${randomUUID()}`);
      const readyFacts = [
        ["planning.statement", "目标与当前情况", { text: "准备计算机类考研，先完成基础阶段。" }],
        ["planning.subject_baseline", "各科基础", { text: "数学一需要从基础开始。" }],
        ["planning.foundation_exit", "基础阶段退出标准", { text: "能独立完成典型基础题。" }],
        ["planning.weekly_capacity", "每周稳定学习容量", { text: "每周可以稳定投入 12 小时。" }],
      ] as const;
      for (const [index, fact] of readyFacts.entries()) {
        await pool.query(
          `INSERT INTO "StudyProfileFact" ("id","userId","key","label","value","source","confidence","status","observedAt","createdAt","updatedAt")
           VALUES ($1,$2,$3,$4,$5::jsonb,'user_statement','high','confirmed',now(),now(),now())`,
          [readyFactIds[index], userId, fact[0], fact[1], JSON.stringify(fact[2])],
        );
      }
      const routeGateResult = await page.evaluate(async () => {
        const weekStart = "2035-01-08";
        const before = await fetch(`/api/weekly-plans?weekStart=${weekStart}`).then((res) => res.json());
        const res = await fetch("/api/ai/generate-plan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ weekStartDate: weekStart, weekStartLocal: weekStart, todayLocal: weekStart, generationMode: "local" }),
        });
        const after = await fetch(`/api/weekly-plans?weekStart=${weekStart}`).then((response) => response.json());
        return { status: res.status, body: await res.json(), beforeDraftId: before.draft?.id ?? null, afterDraftId: after.draft?.id ?? null };
      });
      expect(routeGateResult.status).toBe(409);
      expect(routeGateResult.body.needsStudyPath).toBe(true);
      expect(routeGateResult.afterDraftId).toBe(routeGateResult.beforeDraftId);
    } finally {
      if (original) {
        await page.evaluate(async (goal) => {
          await fetch("/api/goal", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(goal),
          });
        }, original);
      } else {
        await pool.query('DELETE FROM "Goal" WHERE "userId" = $1', [userId]);
      }
      for (const fact of confirmedFacts.rows) {
        await pool.query('UPDATE "StudyProfileFact" SET status = $1, "updatedAt" = now() WHERE id = $2', [fact.status, fact.id]);
      }
      for (const path of activePaths.rows) {
        await pool.query('UPDATE "StudyPath" SET status = $1, "updatedAt" = now() WHERE id = $2', [path.status, path.id]);
      }
      if (readyFactIds.length > 0) {
        await pool.query('DELETE FROM "StudyProfileFact" WHERE id = ANY($1::text[])', [readyFactIds]);
      }
      await pool.end();
    }
  });

  test("planning statement is reviewed before becoming long-term memory and can be withdrawn", async ({ page }) => {
    test.setTimeout(120000);
    const statement = `E2E-${Date.now()}：我想考研，但是 408 还有计算机网络没学，数学基础也弱，英语四级过了六级没过，我想学习没完成的课程，同时补一遍所有课程的基础。`;

    const analysisResult = await page.evaluate(async (text) => {
      const res = await fetch("/api/study-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "analyze", statement: text }),
      });
      return { status: res.status, body: await res.json() };
    }, statement);
    expect(analysisResult.status).toBe(200);
    expect(analysisResult.body.analysis.facts.map((fact: { label: string }) => fact.label)).toEqual(expect.arrayContaining([
      "计算机网络尚未开始",
      "数学基础薄弱",
      "英语四级已通过",
      "英语六级尚未通过",
      "未完成课程与全科基础并行",
    ]));
    expect(analysisResult.body.analysis.questions.length).toBeGreaterThan(0);

    await page.reload();
    await expect(page.locator("#planning-statement")).toBeVisible({ timeout: 10000 });
    await page.locator("#planning-statement").fill(statement);
    await page.getByRole("button", { name: "先看看系统怎么理解" }).click();
    await expect(page.getByText("计算机网络尚未开始", { exact: true })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("设计长期路线前还要逐步确认", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "能独立完成典型题" }).click();

    const before = await page.evaluate(async (text) => {
      const res = await fetch("/api/study-profile");
      const data = await res.json();
      return data.facts.some((fact: { value?: { text?: string } }) => fact.value?.text === text);
    }, statement);
    expect(before).toBe(false);

    const confirmed = await page.evaluate(async (text) => {
      const res = await fetch("/api/study-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "confirm",
          statement: text,
          answers: { foundation_exit: "能独立完成典型题", weekly_capacity: "12" },
        }),
      });
      return { status: res.status, body: await res.json() };
    }, statement);
    expect(confirmed.status).toBe(200);
    expect(confirmed.body.facts.length).toBeGreaterThanOrEqual(8);
    expect(confirmed.body.facts.map((fact: { label: string }) => fact.label)).toContain("基础阶段退出标准");
    expect(confirmed.body.readiness.nextStep).toBeTruthy();

    const after = await page.evaluate(async (text) => {
      const res = await fetch("/api/study-profile");
      const data = await res.json();
      return data.facts.some((fact: { value?: { text?: string } }) => fact.value?.text === text);
    }, statement);
    expect(after).toBe(true);

    const ids = (confirmed.body.facts as Array<{ id: string }>).map((fact) => fact.id).join(",");
    const rejected = await page.request.delete("/api/study-profile?ids=" + encodeURIComponent(ids));
    expect(rejected.status()).toBe(200);
  });
});
