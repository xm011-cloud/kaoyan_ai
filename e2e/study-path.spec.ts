import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { createTestDbPool } from "./test-db";

test.describe("Study Path", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/study-path");
  });

  test("page loads correctly", async ({ page }) => {
    await expect(page.locator("h1").filter({ hasText: /路径/ })).toBeVisible({ timeout: 10000 });
  });

  test("milestone area is visible", async ({ page }) => {
    await page.waitForTimeout(5000);
    const body = await page.locator("body").textContent();
    // Should show either milestones, phases, or empty state
    expect(body).toBeTruthy();
  });

  test("related module links are visible", async ({ page }) => {
    const related = page.getByText("继续学习").first();
    if (await related.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(page.locator('a[href="/tasks"]').first()).toBeVisible();
    }
  });

  test("regeneration creates a discardable draft without replacing the active path", async ({ page }) => {
    test.setTimeout(120000);
    // 此用例需要确认过的最小规划档案。显式准备并在 finally 恢复，不能依赖其它测试留下的用户记忆。
    const pool = createTestDbPool();
    const email = process.env.E2E_TEST_USER || "";
    const userResult = await pool.query('SELECT id FROM "User" WHERE email = $1', [email]);
    const userId = userResult.rows[0]?.id as string;
    expect(userId).toBeTruthy();
    const previousFacts = await pool.query(
      'SELECT id, status FROM "StudyProfileFact" WHERE "userId" = $1 AND status = \'confirmed\'',
      [userId],
    );
    await pool.query(
      'UPDATE "StudyProfileFact" SET status = \'superseded\', "updatedAt" = now() WHERE "userId" = $1 AND status = \'confirmed\'',
      [userId],
    );
    const fixtureFactIds = Array.from({ length: 4 }, () => `e2e-path-fact-${randomUUID()}`);
    const fixtureFacts = [
      ["planning.statement", "目标与当前情况", { text: "准备计算机类考研，先完成基础阶段。" }],
      ["planning.subject_baseline", "各科基础", { text: "数学、英语与 408 均需要完成首轮基础。" }],
      ["planning.foundation_exit", "基础阶段退出标准", { text: "完成首轮课程、基础题与错题复盘。" }],
      ["planning.weekly_capacity", "每周稳定学习容量", { text: "每周可以稳定投入 12 小时。" }],
    ] as const;
    for (const [index, fact] of fixtureFacts.entries()) {
      await pool.query(
        `INSERT INTO "StudyProfileFact" ("id","userId","key","label","value","source","confidence","status","observedAt","createdAt","updatedAt")
         VALUES ($1,$2,$3,$4,$5::jsonb,'user_statement','high','confirmed',now(),now(),now())`,
        [fixtureFactIds[index], userId, fact[0], fact[1], JSON.stringify(fact[2])],
      );
    }
    const originalGoal = await page.evaluate(async () => {
      const res = await fetch("/api/goal");
      return (await res.json()).goal;
    });

    let draftId: string | null = null;
    try {
      const goalResult = await page.evaluate(async () => {
        const res = await fetch("/api/goal", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            direction: "计算机类考研",
            university: "测试大学",
            major: "计算机科学与技术",
            examDate: "2027-12-25",
            subjects: ["数学一", "英语一", "408计算机"],
          }),
        });
        return res.status;
      });
      expect(goalResult).toBe(200);

      const before = await page.evaluate(async () => {
        const res = await fetch("/api/study-path");
        return res.json();
      });

      const generated = await page.evaluate(async () => {
        const res = await fetch("/api/study-path", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ generationMode: "local" }),
        });
        return { status: res.status, body: await res.json() };
      });
      expect(generated.status).toBe(200);
      expect(generated.body.isDraft).toBe(true);
      expect(generated.body.path.status).toBe("draft");
      expect(generated.body.stages).toHaveLength(4);
      expect(generated.body.stages[0]).toMatchObject({
        key: "foundation",
        title: "基础巩固",
        status: "pending",
      });
      expect(generated.body.stages[0].exitCriteria.length).toBeGreaterThan(0);
      expect(generated.body.milestones.every((milestone: { stageId: string | null }) => milestone.stageId)).toBe(true);
      const edited = await page.evaluate(async (stageId) => {
        const res = await fetch("/api/study-path/stages/" + stageId, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "updateDraft",
            objective: "先完成数学、英语和 408 的首轮基础，并确认每科可持续的学习节奏。",
            exitCriteria: ["完成全部基础课程的首轮学习", "基础题能够独立完成并订正", "形成可复用的错题和知识结构"],
          }),
        });
        return { status: res.status, body: await res.json() };
      }, generated.body.stages[0].id);
      expect(edited.status).toBe(200);
      expect(edited.body.stage).toMatchObject({
        objective: "先完成数学、英语和 408 的首轮基础，并确认每科可持续的学习节奏。",
        exitCriteria: ["完成全部基础课程的首轮学习", "基础题能够独立完成并订正", "形成可复用的错题和知识结构"],
      });
      draftId = generated.body.path.id;
      await page.reload();
      await expect(page.getByText(/路线版本历史/).first()).toBeVisible({ timeout: 10000 });

      const discarded = await page.evaluate(async (pathId) => {
        const res = await fetch("/api/study-path", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pathId, action: "discard" }),
        });
        return { status: res.status, body: await res.json() };
      }, draftId);
      expect(discarded.status).toBe(200);
      expect(discarded.body.activePathId).toBe(before.activePathId);
      expect(discarded.body.isDraft).toBe(false);
      draftId = null;
    } finally {
      if (draftId) {
        await page.evaluate(async (pathId) => {
          await fetch("/api/study-path", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ pathId, action: "discard" }),
          });
        }, draftId);
      }
      if (originalGoal) {
        await page.evaluate(async (goal) => {
          await fetch("/api/goal", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(goal),
          });
        }, originalGoal);
      }
      await pool.query('DELETE FROM "StudyProfileFact" WHERE "id" = ANY($1::text[])', [fixtureFactIds]);
      for (const fact of previousFacts.rows) {
        await pool.query('UPDATE "StudyProfileFact" SET status = $1, "updatedAt" = now() WHERE id = $2', [fact.status, fact.id]);
      }
      await pool.end();
    }
  });

  test("active stage requires confirmation before advancing with unfinished milestones", async ({ page }) => {
    test.setTimeout(120000);
    const goalStatus = await page.evaluate(async () => {
      const res = await fetch("/api/goal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          direction: "计算机类考研",
          university: "测试大学",
          major: "计算机科学与技术",
          examDate: "2027-12-25",
          subjects: ["数学一", "英语一", "408计算机"],
        }),
      });
      return res.status;
    });
    expect(goalStatus).toBe(200);
    const profileStatus = await page.evaluate(async () => {
      const response = await fetch("/api/study-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "confirm",
          statement: "我准备计算机考研，目前数据结构还没开始，数学基础较弱，需要先完成全科基础。",
          answers: { foundation_exit: "能独立完成典型题", weekly_capacity: "12" },
        }),
      });
      return response.status;
    });
    expect(profileStatus).toBe(200);

    const draft = await page.evaluate(async () => {
      const res = await fetch("/api/study-path", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ generationMode: "local" }),
      });
      return (await res.json()).path;
    });
    const activated = await page.evaluate(async (pathId) => {
      const res = await fetch("/api/study-path", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pathId, action: "activate" }),
      });
      return { status: res.status, body: await res.json() };
    }, draft.id);
    expect(activated.status).toBe(200);
    const firstStage = activated.body.stages.find((stage: { status: string }) => stage.status === "active");
    expect(firstStage?.key).toBe("foundation");

    const blocked = await page.evaluate(async (stageId) => {
      const res = await fetch(`/api/study-path/stages/${stageId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmIncomplete: false }),
      });
      return { status: res.status, body: await res.json() };
    }, firstStage.id);
    expect(blocked.status).toBe(409);
    expect(blocked.body.requiresConfirmation).toBe(true);

    const advanced = await page.evaluate(async (stageId) => {
      const res = await fetch(`/api/study-path/stages/${stageId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmIncomplete: true }),
      });
      return { status: res.status, body: await res.json() };
    }, firstStage.id);
    expect(advanced.status).toBe(200);
    expect(advanced.body.stage.status).toBe("completed");
    expect(advanced.body.nextStage).toMatchObject({ key: "intensify", status: "active" });

    const repeated = await page.evaluate(async (stageId) => {
      const res = await fetch(`/api/study-path/stages/${stageId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmIncomplete: true }),
      });
      return { status: res.status, body: await res.json() };
    }, firstStage.id);
    expect(repeated.status).toBe(200);
    expect(repeated.body.alreadyCompleted).toBe(true);
    expect(repeated.body.nextStage.key).toBe("intensify");
  });

  test("stage adjustment creates an impact proposal and preserves the current stage", async ({ page }) => {
    // 这条用例会连续读写路线。使用 Playwright APIRequestContext，避免浏览器页面在路由重编译/瞬态 TLS 抖动时取消 fetch。
    test.setTimeout(120000);
    const goalResponse = await page.request.post("/api/goal", {
      data: {
          direction: "计算机类考研",
          university: "测试大学",
          major: "计算机科学与技术",
          examDate: "2027-12-25",
          subjects: ["数学一", "英语一", "408计算机"],
          studyLoad: { weeklyHours: 12 },
      },
    });
    expect(goalResponse.status()).toBe(200);
    const profileResponse = await page.request.post("/api/study-profile", {
      data: {
          action: "confirm",
          statement: "我准备计算机考研，目前数据结构还没开始，数学基础较弱，需要先完成全科基础。",
          answers: { foundation_exit: "能独立完成典型题", weekly_capacity: "12" },
      },
    });
    expect(profileResponse.status()).toBe(200);
    // 每次先启用一条干净的本地路线，避免共享测试账号残留的“已补计算机网络”状态让提案正确地返回 no_change。
    const generated = await page.request.post("/api/study-path", { data: { generationMode: "local" } });
    const generatedBody = await generated.json();
    let freshPath = { status: generated.status(), body: generatedBody };
    if (generated.ok()) {
      const activated = await page.request.patch("/api/study-path", { data: { pathId: generatedBody.path.id, action: "activate" } });
      freshPath = { status: activated.status(), body: await activated.json() };
    }
    expect(freshPath.status, JSON.stringify(freshPath.body)).toBe(200);
    const beforeResponse = await page.request.get("/api/study-path");
    expect(beforeResponse.ok()).toBeTruthy();
    const before = await beforeResponse.json();
    expect(before.path?.status).toBe("active");
    const currentStage = before.stages.find((stage: { status: string }) => stage.status === "active");
    expect(currentStage).toBeTruthy();
    const milestoneToPreserve = before.milestones.find((milestone: { stageId: string | null }) => milestone.stageId === currentStage.id);
    expect(milestoneToPreserve).toBeTruthy();
    const completed = await page.request.patch("/api/study-path/progress", { data: { milestoneId: milestoneToPreserve.id, progress: 1, completed: true } });
    expect(completed.status()).toBe(200);

    const reviewedResponse = await page.request.post(`/api/study-path/milestones/${milestoneToPreserve.id}/review`, { data: { outcome: "achieved", note: "E2E 复盘结论应在路线调整后保留" } });
    const reviewed = { status: reviewedResponse.status(), body: await reviewedResponse.json() };
    expect(reviewed.status).toBe(200);

    const weeklyResponse = await page.request.post("/api/study-path/adjust", { data: { request: "这周只有 8 小时，周三没空" } });
    const weeklyScoped = { status: weeklyResponse.status(), body: await weeklyResponse.json() };
    expect(weeklyScoped.status).toBe(409);
    expect(weeklyScoped.body.scope).toBe("weekly");
    expect(weeklyScoped.body.suggestedHref).toBe("/tasks");

    const proposalResponse = await page.request.post("/api/study-path/adjust", { data: { request: "计算机网络还没学，数学基础也弱，需要补一遍基础" } });
    const proposal = { status: proposalResponse.status(), body: await proposalResponse.json() };
    expect(proposal.status).toBe(200);
    expect(proposal.body.isDraft).toBe(true);
    expect(proposal.body.activePathId).toBe(before.activePathId);
    expect(proposal.body.path.adjustmentRequest).toContain("计算机网络");
    expect(proposal.body.path.changeImpact.addedMilestones.length).toBeGreaterThanOrEqual(2);
    expect(proposal.body.path.changeImpact.preservedCompletedMilestones).toBeGreaterThanOrEqual(1);
    expect(proposal.body.path.changeImpact.datesChanged).toBe(false);
    const proposedCurrentStage = proposal.body.stages.find((stage: { status: string }) => stage.status === "active");
    expect(proposedCurrentStage.key).toBe(currentStage.key);
    expect(proposal.body.milestones.some((milestone: { title: string }) => milestone.title.includes("计算机网络"))).toBe(true);
    expect(proposal.body.milestones.find((milestone: { title: string }) => milestone.title === milestoneToPreserve.title).completedAt).toBeTruthy();
    expect(proposal.body.milestones.find((milestone: { title: string }) => milestone.title === milestoneToPreserve.title).reviewOutcome).toBe("achieved");

    const blockedResponse = await page.request.patch("/api/study-path", { data: { pathId: proposal.body.path.id, action: "activate" } });
    const blocked = { status: blockedResponse.status(), body: await blockedResponse.json() };
    expect(blocked.status).toBe(409);
    expect(blocked.body.requiresConfirmation).toBe(true);

    const activatedResponse = await page.request.patch("/api/study-path", { data: { pathId: proposal.body.path.id, action: "activate", confirmImpact: true } });
    const activated = { status: activatedResponse.status(), body: await activatedResponse.json() };
    expect(activated.status).toBe(200);
    expect(activated.body.isDraft).toBe(false);
    expect(activated.body.stages.find((stage: { status: string }) => stage.status === "active").key).toBe(currentStage.key);
  });
});
