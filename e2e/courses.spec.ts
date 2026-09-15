import { expect, test, type APIResponse, type Page } from "@playwright/test";

async function postWithTransientRetry(page: Page, url: string, data: unknown): Promise<APIResponse> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await page.request.post(url, { data, timeout: 30_000 });
      if (response.status() < 500) return response;
      lastError = new Error(`${url} returned ${response.status()}`);
    } catch (error) {
      lastError = error;
    }
    if (attempt < 2) await page.waitForTimeout([1_000, 3_000][attempt]);
  }
  throw lastError;
}

test.describe("Courses", () => {
  test("课程、学习会话、笔记和自评构成可追溯闭环", async ({ page }) => {
    // 该用例覆盖创建、笔记幂等、会话幂等及页面上下文；Neon 冷连接下单次链路可超过一分钟。
    // 放宽的是这一条完整证据链的时限，不掩盖任何业务断言。
    test.setTimeout(90000);
    const suffix = Date.now();
    const courseTitle = `E2E课程闭环${suffix}`;

    const createCourse = await page.request.post("/api/courses", {
      data: {
        title: courseTitle,
        subject: "408",
        sourceType: "external",
        sourceUrl: "https://example.com/course",
        firstLessonTitle: "传输层：可靠传输",
      },
    });
    expect(createCourse.status()).toBe(201);
    const createdCourse = (await createCourse.json()).course;
    const lesson = createdCourse.units[0].lessons[0];

    const startSession = await page.request.post(`/api/lessons/${lesson.id}/sessions`, { data: {} });
    expect(startSession.status()).toBe(201);
    const session = (await startSession.json()).session;

    const saveNote = await page.request.post("/api/study-notes", {
      data: {
        studySessionId: session.id,
        kind: "question",
        content: "为什么滑动窗口协议能同时保证可靠性和效率？",
      },
    });
    expect(saveNote.status()).toBe(201);
    const savedNote = (await saveNote.json()).note;

    const replayed = await page.request.post("/api/study-notes", {
      data: {
        id: savedNote.id,
        studySessionId: session.id,
        kind: "question",
        content: "为什么滑动窗口协议能同时保证可靠性和效率？",
      },
    });
    expect(replayed.status()).toBe(200);
    expect((await replayed.json()).note.id).toBe(savedNote.id);

    const updateNote = await page.request.patch(`/api/study-notes/${savedNote.id}`, {
      data: { content: "滑动窗口协议如何兼顾可靠性和效率？", kind: "key_point" },
    });
    expect(updateNote.status()).toBe(200);
    expect((await updateNote.json()).note).toMatchObject({
      id: savedNote.id,
      content: "滑动窗口协议如何兼顾可靠性和效率？",
      kind: "key_point",
    });

    const finishSession = await page.request.patch(`/api/study-sessions/${session.id}`, {
      data: {
        status: "completed",
        selfAssessment: "needs_practice",
        actualMinutes: 25,
        blocker: "窗口大小与吞吐量关系不清楚",
        nextStep: "完成两道滑动窗口练习题",
      },
    });
    expect(finishSession.status()).toBe(200);

    const replayFinish = await page.request.patch(`/api/study-sessions/${session.id}`, {
      data: { status: "completed", selfAssessment: "needs_practice", actualMinutes: 25 },
    });
    expect(replayFinish.status()).toBe(200);
    expect((await replayFinish.json()).alreadyCompleted).toBe(true);

    const detail = await page.request.get(`/api/courses/${createdCourse.id}`);
    expect(detail.status()).toBe(200);
    const course = (await detail.json()).course;
    const storedLesson = course.units[0].lessons[0];
    expect(storedLesson.status).toBe("completed");
    expect(storedLesson._count.notes).toBe(1);
    expect(storedLesson.sessions[0]).toMatchObject({
      id: session.id,
      status: "completed",
      selfAssessment: "needs_practice",
    });

    await page.goto("/courses");
    await expect(page.getByRole("heading", { name: "我的课程" })).toBeVisible();
    await expect(page.getByRole("button", { name: new RegExp(courseTitle) })).toBeVisible({ timeout: 10000 });
    await page.getByRole("button", { name: "AI 工作区" }).click();
    const workspace = page.getByRole("complementary", { name: "AI 工作区" });
    await expect(workspace.getByText(`正在协助：${courseTitle} · 传输层：可靠传输`)).toBeVisible();
  });

  test("从计划任务开始课程时，学习会话保留任务关联但不自动完成任务", async ({ page }) => {
    const suffix = Date.now();
    const course = await page.request.post("/api/courses", {
      data: { title: `E2E任务课程${suffix}`, subject: "408", firstLessonTitle: "网络层基础" },
    });
    expect(course.status()).toBe(201);
    const createdCourse = (await course.json()).course;
    const lesson = createdCourse.units[0].lessons[0];
    const pad = (value: number) => String(value).padStart(2, "0");
    const localDate = (value: Date) => `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
    const now = new Date();
    const weekStartDate = new Date(now);
    weekStartDate.setDate(now.getDate() + (now.getDay() === 0 ? -6 : 1 - now.getDay()));
    const today = localDate(now);
    const weekStart = localDate(weekStartDate);
    const task = await page.request.post("/api/tasks", {
      data: { title: `E2E关联任务${suffix}`, date: today, courseLessonId: lesson.id, duration: 30 },
    });
    expect(task.status()).toBe(200);
    const taskBody = await task.json();

    const started = await page.request.post(`/api/lessons/${lesson.id}/sessions`, { data: { taskId: taskBody.task.id } });
    expect(started.status()).toBe(201);
    const session = (await started.json()).session;
    expect(session.taskId).toBe(taskBody.task.id);
    const finished = await page.request.patch(`/api/study-sessions/${session.id}`, {
      data: { status: "completed", selfAssessment: "clear", actualMinutes: 30 },
    });
    expect(finished.status()).toBe(200);

    const storedTask = await page.request.get(`/api/tasks?weekStart=${weekStart}`);
    const storedTasks = (await storedTask.json()).tasks;
    expect(storedTasks.find((item: { id: string }) => item.id === taskBody.task.id).completed).toBe(false);
  });

  test("离线结束课程会话在恢复联网后才计入学习证据", async ({ page, context }) => {
    test.setTimeout(180000);
    const suffix = Date.now();
    const courseTitle = `E2E弱网课程${suffix}`;
    const created = await postWithTransientRetry(page, "/api/courses", {
      title: courseTitle, subject: "数学一", firstLessonTitle: "极限的基本概念",
    });
    expect(created.status()).toBe(201);
    const course = (await created.json()).course;
    const lesson = course.units[0].lessons[0];
    const started = await postWithTransientRetry(page, `/api/lessons/${lesson.id}/sessions`, {});
    expect([200, 201]).toContain(started.status());
    const session = (await started.json()).session;

    await page.goto(`/courses?lesson=${lesson.id}`);
    await expect(page.getByRole("heading", { name: "我的课程" })).toBeVisible();
    await expect(page.getByRole("button", { name: courseTitle })).toBeVisible({ timeout: 30000 });
    await page.evaluate(({ sessionId, lessonId }) => {
      localStorage.setItem(`c6:course-draft:${sessionId}`, JSON.stringify({
        sessionId, lessonId, noteContent: "极限定义的量词顺序需要再确认。", noteKind: "question",
        assessment: "needs_practice", blocker: "ε-δ 的表达", nextStep: "完成两道定义题", savedAt: Date.now(),
      }));
    }, { sessionId: session.id, lessonId: lesson.id });
    await page.reload();
    await expect(page.getByText("本次学习会话已开始")).toBeVisible({ timeout: 30000 });
    await expect(page.getByText("已恢复上次未提交的本地草稿。")).toBeVisible();

    await context.setOffline(true);
    await expect(page.getByText(/离线模式/)).toBeVisible();
    await page.locator('select[name="assessment"]').selectOption("needs_practice");
    await page.getByRole("button", { name: "完成并保存学习证据" }).click();
    await expect(page.getByText("学习结束记录等待联网同步；在同步成功前，它不会计入路线证据。")).toBeVisible();

    await context.setOffline(false);
    await expect(page.getByText("学习结束记录等待联网同步；在同步成功前，它不会计入路线证据。")).toBeHidden({ timeout: 30000 });
    const detail = await page.request.get(`/api/courses/${course.id}`);
    expect(detail.status()).toBe(200);
    expect((await detail.json()).course.units[0].lessons[0].sessions[0]).toMatchObject({
      id: session.id,
      status: "completed",
      selfAssessment: "needs_practice",
    });
  });
});
