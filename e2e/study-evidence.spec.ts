import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { createTestDbPool } from "./test-db";

function nextMondayLocal(): string {
  const next = new Date();
  next.setDate(next.getDate() + (next.getDay() === 0 ? 1 : 8 - next.getDay()));
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${next.getFullYear()}-${pad(next.getMonth() + 1)}-${pad(next.getDate())}`;
}

test.describe("Study evidence", () => {
  test("任务、课程、练习和错题只向明确关联的里程碑累计一次证据", async ({ page }) => {
    test.setTimeout(120000);
    const suffix = randomUUID();
    const pool = createTestDbPool();
    const email = process.env.E2E_TEST_USER || "";
    const userResult = await pool.query('SELECT id FROM "User" WHERE email = $1', [email]);
    const userId = userResult.rows[0]?.id as string;
    expect(userId).toBeTruthy();

    const pathId = `e2e-evidence-path-${suffix}`;
    const milestoneId = `e2e-evidence-milestone-${suffix}`;
    const importedQuestionId = `e2e-evidence-question-${suffix}`;
    const subject = `证据科目-${suffix.slice(0, 8)}`;
    let taskId: string | null = null;
    let courseId: string | null = null;
    const practiceIds: string[] = [];
    let wrongQuestionId: string | null = null;

    try {
      const versionResult = await pool.query('SELECT COALESCE(MAX("version"), 0) + 1 AS version FROM "StudyPath" WHERE "userId" = $1', [userId]);
      await pool.query(
        `INSERT INTO "StudyPath" ("id","userId","title","subjects","version","status","generatedBy","createdAt","updatedAt")
         VALUES ($1,$2,$3,$4,$5,'superseded','manual',now(),now())`,
        [pathId, userId, `证据测试路线-${suffix}`, [subject], Number(versionResult.rows[0].version)],
      );
      await pool.query(
        `INSERT INTO "StudyPathMilestone" ("id","studyPathId","title","phase","subject","order","progress","createdAt","updatedAt")
         VALUES ($1,$2,$3,'基础巩固',$4,0,0,now(),now())`,
        [milestoneId, pathId, `证据测试里程碑-${suffix}`, subject],
      );
      await pool.query(
        `INSERT INTO "ImportedQuestion" ("id","userId","subject","year","source","question","type","options","answer","explanation","tags","createdAt")
         VALUES ($1,$2,$3,2026,'e2e',$4,'choice',$5::jsonb,'A','测试解析',ARRAY['e2e'],now())`,
        [importedQuestionId, userId, subject, `证据测试题-${suffix}`, JSON.stringify(["A. 正确", "B. 错误"])],
      );

      const taskResponse = await page.request.post("/api/tasks", {
        data: { title: `证据测试任务-${suffix}`, date: new Date().toISOString(), duration: 30, subject, milestoneId },
      });
      expect(taskResponse.status()).toBe(200);
      taskId = (await taskResponse.json()).task.id;

      // 重复完成同一任务只 upsert 同一个来源事件。
      expect((await page.request.patch(`/api/tasks/${taskId}`, { data: { completed: true } })).status()).toBe(200);
      expect((await page.request.patch(`/api/tasks/${taskId}`, { data: { completed: true } })).status()).toBe(200);

      const courseResponse = await page.request.post("/api/courses", {
        data: { title: `证据测试课程-${suffix}`, subject, firstLessonTitle: `证据测试课时-${suffix}` },
      });
      expect(courseResponse.status()).toBe(201);
      const course = (await courseResponse.json()).course;
      courseId = course.id;
      const lessonId = course.units[0].lessons[0].id as string;
      expect((await page.request.patch(`/api/tasks/${taskId}`, { data: { courseLessonId: lessonId } })).status()).toBe(200);
      const started = await page.request.post(`/api/lessons/${lessonId}/sessions`, { data: { taskId } });
      expect(started.status()).toBe(201);
      const studySession = (await started.json()).session;
      expect(studySession.milestoneId).toBe(milestoneId);
      expect((await page.request.patch(`/api/study-sessions/${studySession.id}`, {
        data: { status: "completed", selfAssessment: "needs_practice", actualMinutes: 25 },
      })).status()).toBe(200);
      expect((await page.request.patch(`/api/study-sessions/${studySession.id}`, {
        data: { status: "completed", selfAssessment: "clear", actualMinutes: 99 },
      })).status()).toBe(409);

      const linkedPracticeResponse = await page.request.post("/api/practice", {
        data: { type: "daily", subject, count: 1, generationMode: "exam_questions", taskId, milestoneId },
      });
      expect(linkedPracticeResponse.status()).toBe(200);
      const linkedPractice = (await linkedPracticeResponse.json()).session;
      practiceIds.push(linkedPractice.id);
      expect(linkedPractice).toMatchObject({ taskId, milestoneId });
      const linkedAnswer = { [linkedPractice.questions[0].id]: linkedPractice.questions[0].correctAnswer };
      expect((await page.request.patch(`/api/practice/${linkedPractice.id}`, { data: { answers: linkedAnswer } })).status()).toBe(200);
      const repeatedPractice = await page.request.patch(`/api/practice/${linkedPractice.id}`, { data: { answers: linkedAnswer } });
      expect(repeatedPractice.status()).toBe(200);
      expect((await repeatedPractice.json()).deduplicated).toBe(true);

      const wrongResponse = await page.request.post("/api/wrong-questions", {
        data: {
          subject,
          question: `证据测试错题-${suffix}`,
          answer: "测试答案",
          source: "practice",
          practiceSessionId: linkedPractice.id,
          tags: ["e2e"],
        },
      });
      expect(wrongResponse.status()).toBe(200);
      const wrongQuestion = (await wrongResponse.json()).question;
      wrongQuestionId = wrongQuestion.id;
      expect(wrongQuestion).toMatchObject({ taskId, milestoneId, practiceSessionId: linkedPractice.id });
      const reviewEventId = `e2e-review-${suffix}`;
      const [firstReview, repeatedReview] = await Promise.all([
        page.request.patch(`/api/wrong-questions/${wrongQuestionId}`, {
          data: { reviewed: true, rating: 4, reviewEventId, taskId, milestoneId },
        }),
        page.request.patch(`/api/wrong-questions/${wrongQuestionId}`, {
          data: { reviewed: true, rating: 4, reviewEventId, taskId, milestoneId },
        }),
      ]);
      expect(firstReview.status()).toBe(200);
      expect(repeatedReview.status()).toBe(200);
      const reviewBodies = await Promise.all([firstReview.json(), repeatedReview.json()]);
      expect(reviewBodies.filter((body) => body.deduplicated === true)).toHaveLength(1);
      const reviewedQuestion = await page.request.get(`/api/wrong-questions/${wrongQuestionId}`);
      expect((await reviewedQuestion.json()).question.reviewCount).toBe(1);

      // 同科目但未关联的练习仍进入个人证据账本，不得被猜测计入该里程碑。
      const unlinkedPracticeResponse = await page.request.post("/api/practice", {
        data: { type: "daily", subject, count: 1, generationMode: "exam_questions" },
      });
      expect(unlinkedPracticeResponse.status()).toBe(200);
      const unlinkedPractice = (await unlinkedPracticeResponse.json()).session;
      practiceIds.push(unlinkedPractice.id);
      const unlinkedAnswer = { [unlinkedPractice.questions[0].id]: unlinkedPractice.questions[0].correctAnswer };
      expect((await page.request.patch(`/api/practice/${unlinkedPractice.id}`, { data: { answers: unlinkedAnswer } })).status()).toBe(200);

      const evidenceResponse = await page.request.get(`/api/study-path/milestones/${milestoneId}/evidence`);
      expect(evidenceResponse.status()).toBe(200);
      const evidence = (await evidenceResponse.json()).evidence;
      expect(evidence.tasks).toMatchObject({ total: 1, completed: 1 });
      expect(evidence.learning.sessions).toBe(1);
      expect(evidence.practice.completed).toBe(1);
      expect(evidence.wrongQuestions.reviewed).toBe(1);
      expect(evidence.items.map((item: { kind: string }) => item.kind).sort()).toEqual([
        "course_session",
        "practice_session",
        "task_completion",
        "wrong_review",
      ]);

      const ledgerCounts = await pool.query(
        `SELECT "kind", COUNT(*)::int AS count FROM "StudyEvidence"
         WHERE "userId" = $1 AND "milestoneId" = $2 AND "status" = 'active'
         GROUP BY "kind"`,
        [userId, milestoneId],
      );
      expect(Object.fromEntries(ledgerCounts.rows.map((row) => [row.kind, row.count]))).toMatchObject({
        task_completion: 1,
        course_session: 1,
        practice_session: 1,
        wrong_review: 1,
      });

      // 用户显式归属后，原本未计入路线的事实开始推进里程碑，且来源对象同步保存归属。
      const unlinkedResponse = await page.request.get("/api/study-evidence?limit=20");
      expect(unlinkedResponse.status()).toBe(200);
      const unlinkedItems = (await unlinkedResponse.json()).evidence as Array<{ id: string; title: string }>;
      const unlinkedItem = unlinkedItems.find((item) => item.title === `练习：${subject}`);
      expect(unlinkedItem).toBeTruthy();
      const assignResponse = await page.request.patch("/api/study-evidence", {
        data: { evidenceId: unlinkedItem!.id, milestoneId },
      });
      expect(assignResponse.status()).toBe(200);
      expect((await page.request.patch("/api/study-evidence", {
        data: { evidenceId: unlinkedItem!.id, milestoneId },
      })).status()).toBe(404);

      const reassignedPractice = await pool.query(
        `SELECT "milestoneId" FROM "PracticeSession" WHERE "id" = $1`,
        [unlinkedPractice.id],
      );
      expect(reassignedPractice.rows[0].milestoneId).toBe(milestoneId);
      const evidenceAfterAssignment = await page.request.get(`/api/study-path/milestones/${milestoneId}/evidence`);
      expect(evidenceAfterAssignment.status()).toBe(200);
      expect((await evidenceAfterAssignment.json()).evidence.practice.completed).toBe(2);
    } finally {
      await pool.query('DELETE FROM "StudyEvidence" WHERE "userId" = $1 AND ("milestoneId" = $2 OR "title" LIKE $3)', [userId, milestoneId, `%${suffix}%`]);
      if (wrongQuestionId) await pool.query('DELETE FROM "WrongQuestion" WHERE "id" = $1', [wrongQuestionId]);
      if (practiceIds.length) await pool.query('DELETE FROM "PracticeSession" WHERE "id" = ANY($1::text[])', [practiceIds]);
      if (taskId) await pool.query('DELETE FROM "Task" WHERE "id" = $1', [taskId]);
      if (courseId) await pool.query('DELETE FROM "Course" WHERE "id" = $1', [courseId]);
      await pool.query('DELETE FROM "ImportedQuestion" WHERE "id" = $1', [importedQuestionId]);
      await pool.query('DELETE FROM "StudyPath" WHERE "id" = $1', [pathId]);
      await pool.end();
    }
  });

  test("复盘结论自动生成下一周草稿，但不会直接改动正式计划", async ({ page }) => {
    test.setTimeout(120000);
    const suffix = randomUUID();
    const pool = createTestDbPool();
    const email = process.env.E2E_TEST_USER || "";
    const userResult = await pool.query('SELECT id FROM "User" WHERE email = $1', [email]);
    const userId = userResult.rows[0]?.id as string;
    expect(userId).toBeTruthy();

    // 上一轮若在远程测试库断连时中止，先按严格的 E2E 命名前缀清掉残留，避免伪造多个 active 路线。
    await pool.query(
      `DELETE FROM "StudyEvidence" WHERE "userId" = $1 AND ("title" LIKE '待归属任务-%' OR "title" LIKE '今日下一步-%')`,
      [userId],
    );
    await pool.query(
      `DELETE FROM "Task" WHERE "userId" = $1 AND ("title" LIKE '待归属任务-%' OR "title" LIKE '今日下一步-%')`,
      [userId],
    );
    await pool.query(
      `DELETE FROM "WeeklyPlan" WHERE "userId" = $1 AND "adjustmentRequest" LIKE '%需要继续巩固-e2e-%'`,
      [userId],
    );
    await pool.query(`DELETE FROM "StudyPath" WHERE "userId" = $1 AND "id" LIKE 'e2e-review-path-%'`, [userId]);
    await pool.query(`DELETE FROM "Goal" WHERE "userId" = $1 AND "id" LIKE 'e2e-review-goal-%'`, [userId]);
    await pool.query(
      `UPDATE "Goal" SET "subjects" = ARRAY(
         SELECT item FROM unnest("subjects") AS item WHERE item NOT LIKE '无对应里程碑-e2e-%'
       ), "updatedAt" = now()
       WHERE "userId" = $1 AND EXISTS (
         SELECT 1 FROM unnest("subjects") AS item WHERE item LIKE '无对应里程碑-e2e-%'
       )`,
      [userId],
    );

    const existingPaths = await pool.query(
      `SELECT "id", "status" FROM "StudyPath" WHERE "userId" = $1 AND "status" IN ('active','draft')`,
      [userId],
    );
    await pool.query(
      `UPDATE "StudyPath" SET "status" = 'paused', "updatedAt" = now()
       WHERE "userId" = $1 AND "status" IN ('active','draft')`,
      [userId],
    );
    const goalResult = await pool.query('SELECT "id", "subjects" FROM "Goal" WHERE "userId" = $1', [userId]);
    const createdGoalId = goalResult.rows.length ? null : `e2e-review-goal-${suffix}`;
    const subject = (goalResult.rows[0]?.subjects as string[] | undefined)?.[0] || "数学一";
    const mismatchSubject = `无对应里程碑-e2e-${suffix.slice(0, 8)}`;
    const originalGoalSubjects = (goalResult.rows[0]?.subjects as string[] | undefined) ?? null;
    if (createdGoalId) {
      await pool.query(
        `INSERT INTO "Goal" ("id","userId","university","major","examDate","subjects","studyLoad","createdAt","updatedAt")
         VALUES ($1,$2,'证据测试大学','证据测试专业',now() + interval '300 days',$3,$4::jsonb,now(),now())`,
        [createdGoalId, userId, [subject, mismatchSubject], JSON.stringify({ weeklyHours: 8 })],
      );
    } else {
      await pool.query(
        'UPDATE "Goal" SET "subjects" = $1, "updatedAt" = now() WHERE "id" = $2',
        [Array.from(new Set([subject, mismatchSubject, ...originalGoalSubjects!])), goalResult.rows[0].id],
      );
    }

    const pathId = `e2e-review-path-${suffix}`;
    const stageId = `e2e-review-stage-${suffix}`;
    const milestoneId = `e2e-review-milestone-${suffix}`;
    const nextMilestoneId = `e2e-review-next-milestone-${suffix}`;
    const milestoneTitle = `需要继续巩固-${suffix}`;
    const nextMilestoneTitle = `下一里程碑-${suffix}`;
    const unlinkedTaskTitle = `待归属任务-e2e-${suffix}`;
    let unlinkedTaskId: string | null = null;
    let nextTaskId: string | null = null;
    const versionResult = await pool.query('SELECT COALESCE(MAX("version"), 0) + 1 AS version FROM "StudyPath" WHERE "userId" = $1', [userId]);
    const weekStart = nextMondayLocal();
    const savedWeeklyStatuses = await pool.query(
      `SELECT "id", "status" FROM "WeeklyPlan" WHERE "userId" = $1 AND "weekStart" = $2::date`,
      [userId, weekStart],
    );
    let mismatchDraftId: string | null = null;

    try {
      await pool.query(
        `INSERT INTO "StudyPath" ("id","userId","title","subjects","version","status","generatedBy","confirmedAt","createdAt","updatedAt")
         VALUES ($1,$2,$3,$4,$5,'active','manual',now(),now(),now())`,
        [pathId, userId, `自动草稿测试路线-${suffix}`, [subject], Number(versionResult.rows[0].version)],
      );
      await pool.query(
        `INSERT INTO "StudyPathStage" ("id","studyPathId","key","title","order","objective","exitCriteria","status","createdAt","updatedAt")
         VALUES ($1,$2,'foundation','基础巩固',0,'完成证据测试目标',$3::jsonb,'active',now(),now())`,
        [stageId, pathId, JSON.stringify(["完成针对性练习", "完成复盘确认"])],
      );
      await pool.query(
        `INSERT INTO "StudyPathMilestone" ("id","studyPathId","stageId","title","phase","subject","order","progress","createdAt","updatedAt")
         VALUES ($1,$2,$3,$4,'基础巩固',$5,0,0.6,now(),now())`,
        [milestoneId, pathId, stageId, milestoneTitle, subject],
      );

      const ordinaryDraftResponse = await page.request.post("/api/ai/generate-plan", {
        data: {
          weekStartDate: `${weekStart}T00:00:00`,
          weekStartLocal: weekStart,
          todayLocal: weekStart,
          generationMode: "local",
        },
      });
      expect(ordinaryDraftResponse.status()).toBe(200);
      const ordinaryDraft = (await ordinaryDraftResponse.json()).draft;
      mismatchDraftId = ordinaryDraft.id;
      const ordinaryItems = ordinaryDraft.items as Array<{ subject: string; milestoneId?: string | null }>;
      expect(ordinaryItems.some((item) => item.subject === mismatchSubject)).toBe(true);
      expect(ordinaryItems.filter((item) => item.subject === mismatchSubject).every((item) => !item.milestoneId)).toBe(true);
      expect(ordinaryItems.filter((item) => item.subject === subject).every((item) => item.milestoneId === milestoneId)).toBe(true);

      const taskResponse = await page.request.post("/api/tasks", {
        data: { title: unlinkedTaskTitle, date: new Date().toISOString(), duration: 20, subject },
      });
      expect(taskResponse.status()).toBe(200);
      unlinkedTaskId = (await taskResponse.json()).task.id;
      expect((await page.request.patch(`/api/tasks/${unlinkedTaskId}`, { data: { completed: true } })).status()).toBe(200);

      // 浏览器端明确选择归属；归属前不猜，归属后任务与证据同步到路线。
      await page.goto("/study-path");
      await page.getByText(/待归属学习记录/).click();
      const unlinkedTaskEvidence = await pool.query(
        `SELECT "id" FROM "StudyEvidence" WHERE "userId" = $1 AND "taskId" = $2 AND "milestoneId" IS NULL`,
        [userId, unlinkedTaskId],
      );
      const evidenceId = unlinkedTaskEvidence.rows[0]?.id as string;
      expect(evidenceId).toBeTruthy();
      const evidenceRow = page.getByTestId(`unlinked-evidence-${evidenceId}`);
      await expect(evidenceRow).toBeVisible({ timeout: 10000 });
      await evidenceRow.getByRole("combobox").selectOption(milestoneId);
      const assignResponsePromise = page.waitForResponse(
        (response) => response.url().endsWith("/api/study-evidence") && response.request().method() === "PATCH",
        { timeout: 60000 },
      );
      await evidenceRow.getByRole("button", { name: "确认归属" }).click();
      expect((await assignResponsePromise).status()).toBe(200);
      await expect(page.getByText(/路线证据已更新/)).toBeVisible({ timeout: 10000 });
      expect((await pool.query('SELECT "milestoneId" FROM "Task" WHERE "id" = $1', [unlinkedTaskId])).rows[0].milestoneId).toBe(milestoneId);

      const nextTaskResponse = await page.request.post("/api/tasks", {
        data: { title: `今日下一步-e2e-${suffix}`, date: new Date().toISOString(), duration: 25, subject, milestoneId },
      });
      expect(nextTaskResponse.status()).toBe(200);
      nextTaskId = (await nextTaskResponse.json()).task.id;
      // 共享测试账号可能已有今日任务；将本任务固定为“今日下一步”，避免依赖历史数据顺序。
      await pool.query('UPDATE "Task" SET "createdAt" = $1::timestamptz WHERE "id" = $2', ["2000-01-01T00:00:00Z", nextTaskId]);
      await page.goto("/dashboard");
      await expect(page.getByText(`正在推进：${milestoneTitle}`)).toBeVisible({ timeout: 10000 });
      await expect(page.getByRole("link", { name: "开始这一项" })).toHaveAttribute("href", new RegExp(`task=${nextTaskId}`));

      await page.goto(`/study-path?review=${milestoneId}`);
      const dialog = page.getByRole("dialog", { name: "里程碑复盘" });
      await expect(dialog).toBeVisible({ timeout: 15000 });
      const draftResponsePromise = page.waitForResponse(
        (response) => response.url().endsWith("/api/ai/generate-plan") && response.request().method() === "POST",
        { timeout: 60000 },
      );
      await dialog.getByRole("button", { name: "继续巩固" }).click();
      const draftResponse = await draftResponsePromise;
      expect(draftResponse.status()).toBe(200);
      await expect(page.getByRole("link", { name: "查看并确认下周草稿" })).toBeVisible({ timeout: 10000 });

      const planResponse = await page.request.get(`/api/weekly-plans?weekStart=${weekStart}`);
      expect(planResponse.status()).toBe(200);
      const planState = await planResponse.json();
      expect(planState.draft.status).toBe("draft");
      expect(planState.draft.adjustmentRequest).toContain(milestoneTitle);
      expect(planState.draft.items).toHaveLength(3);
      expect(planState.draft.items.every((item: { milestoneId: string }) => item.milestoneId === milestoneId)).toBe(true);
      expect(planState.active?.id ?? null).not.toBe(planState.draft.id);

      // “已达成”应跳到同阶段的下一个未完成里程碑；仍然只创建草稿。
      await pool.query(
        `INSERT INTO "StudyPathMilestone" ("id","studyPathId","stageId","title","phase","subject","order","progress","createdAt","updatedAt")
         VALUES ($1,$2,$3,$4,'基础巩固',$5,1,0,now(),now())`,
        [nextMilestoneId, pathId, stageId, nextMilestoneTitle, subject],
      );
      const achievedReview = await page.request.post(`/api/study-path/milestones/${milestoneId}/review`, {
        data: { outcome: "achieved", note: `已达成-e2e-${suffix}` },
      });
      expect(achievedReview.status()).toBe(200);
      expect((await achievedReview.json()).milestone).toMatchObject({ progress: 1, reviewOutcome: "achieved" });

      const achievedDraftResponse = await page.request.post("/api/ai/generate-plan", {
        data: {
          weekStartDate: `${weekStart}T00:00:00`,
          weekStartLocal: weekStart,
          todayLocal: weekStart,
          generationMode: "local",
          adjustmentRequest: `已达成后推进下一项-e2e-${suffix}`,
        },
      });
      expect(achievedDraftResponse.status()).toBe(200);
      const achievedDraft = (await achievedDraftResponse.json()).draft;
      const achievedItems = achievedDraft.items as Array<{ subject: string; milestoneId?: string | null }>;
      expect(achievedDraft.status).toBe("draft");
      expect(achievedItems.filter((item) => item.subject === subject).every((item) => item.milestoneId === nextMilestoneId)).toBe(true);
      expect(achievedItems.some((item) => item.milestoneId === milestoneId)).toBe(false);

      // “需要重学”必须回到该里程碑生成基础补学三步，不能扩散到其他里程碑或直接生效。
      const relearnReview = await page.request.post(`/api/study-path/milestones/${nextMilestoneId}/review`, {
        data: { outcome: "relearn", note: `需要重学-e2e-${suffix}` },
      });
      expect(relearnReview.status()).toBe(200);
      expect((await relearnReview.json()).milestone).toMatchObject({ progress: 0, reviewOutcome: "relearn" });

      const relearnDraftResponse = await page.request.post("/api/ai/generate-plan", {
        data: {
          weekStartDate: `${weekStart}T00:00:00`,
          weekStartLocal: weekStart,
          todayLocal: weekStart,
          generationMode: "local",
          adjustmentRequest: `需要重学后回到基础-e2e-${suffix}`,
          focusMilestoneId: nextMilestoneId,
          reviewOutcome: "relearn",
        },
      });
      expect(relearnDraftResponse.status()).toBe(200);
      const relearnDraft = (await relearnDraftResponse.json()).draft;
      const relearnItems = relearnDraft.items as Array<{ title: string; milestoneId?: string | null }>;
      expect(relearnDraft.status).toBe("draft");
      expect(relearnItems.map((item) => item.title)).toEqual([
        `重新梳理：${nextMilestoneTitle}`,
        `基础练习：${nextMilestoneTitle}`,
        `复述与复盘：${nextMilestoneTitle}`,
      ]);
      expect(relearnItems.every((item) => item.milestoneId === nextMilestoneId)).toBe(true);
      expect(planState.active?.id ?? null).not.toBe(relearnDraft.id);
    } finally {
      await pool.query(
        `DELETE FROM "WeeklyPlan" WHERE "userId" = $1 AND "adjustmentRequest" LIKE $2`,
        [userId, `%${suffix}%`],
      );
      if (mismatchDraftId) await pool.query('DELETE FROM "WeeklyPlan" WHERE "id" = $1', [mismatchDraftId]);
      for (const plan of savedWeeklyStatuses.rows) {
        await pool.query('UPDATE "WeeklyPlan" SET "status" = $1, "updatedAt" = now() WHERE "id" = $2', [plan.status, plan.id]);
      }
      await pool.query('DELETE FROM "StudyEvidence" WHERE "userId" = $1 AND "title" LIKE $2', [userId, `%${suffix}%`]);
      if (nextTaskId) await pool.query('DELETE FROM "Task" WHERE "id" = $1', [nextTaskId]);
      if (unlinkedTaskId) await pool.query('DELETE FROM "Task" WHERE "id" = $1', [unlinkedTaskId]);
      await pool.query('DELETE FROM "StudyPath" WHERE "id" = $1', [pathId]);
      for (const path of existingPaths.rows) {
        await pool.query('UPDATE "StudyPath" SET "status" = $1, "updatedAt" = now() WHERE "id" = $2', [path.status, path.id]);
      }
      if (createdGoalId) await pool.query('DELETE FROM "Goal" WHERE "id" = $1', [createdGoalId]);
      else if (originalGoalSubjects) {
        await pool.query('UPDATE "Goal" SET "subjects" = $1, "updatedAt" = now() WHERE "id" = $2', [originalGoalSubjects, goalResult.rows[0].id]);
      }
      await pool.end();
    }
  });
});
