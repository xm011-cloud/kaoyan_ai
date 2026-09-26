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

// 仅用于服务端已保证幂等的更新：重复请求不会重复计入学习证据。
async function patchWithTransientRetry(page: Page, url: string, data: unknown): Promise<APIResponse> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await page.request.patch(url, { data, timeout: 30_000 });
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
      data: { content: "遇到滑动窗口题，先判断发送窗口、接收窗口与确认机制，再推导可靠性和效率。", kind: "method" },
    });
    expect(updateNote.status()).toBe(200);
    expect((await updateNote.json()).note).toMatchObject({
      id: savedNote.id,
      content: "遇到滑动窗口题，先判断发送窗口、接收窗口与确认机制，再推导可靠性和效率。",
      kind: "method",
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
    // 该链路会验证课程、任务、理解记录、课程知识点详情与手机布局；测试库冷连接时给予完整预算。
    test.setTimeout(120_000);
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
    const taskTitle = `E2E关联任务${suffix}`;
    const task = await page.request.post("/api/tasks", {
      data: { title: taskTitle, date: today, courseLessonId: lesson.id, duration: 30 },
    });
    expect(task.status()).toBe(200);
    const taskBody = await task.json();
    // 认证项目会复用同一测试账号；重试或此前的用例可能已经给该系统节点留下证据。
    // 因此这里验证本次操作带来的增量，而不是假定全局证据从零开始。
    const beforeCurriculumDetail = await page.request.get("/api/curriculum/nodes/network-tcp");
    expect(beforeCurriculumDetail.status()).toBe(200);
    const beforeEvidence = (await beforeCurriculumDetail.json()).evidence;

    const knowledgeNode = await page.request.post("/api/knowledge-graph", {
      data: { name: `网络层解题框架${suffix}`, subject: "408", category: "method" },
    });
    expect(knowledgeNode.status()).toBe(200);
    const node = (await knowledgeNode.json()).node;

    const methodNote = await page.request.post("/api/study-notes", {
      data: {
        taskId: taskBody.task.id,
        kind: "method",
        content: "遇到网络层基础题，先确认题目考察的是寻址、转发还是路由，再选择对应知识点。",
        knowledgeNodeIds: [node.id],
      },
    });
    expect(methodNote.status()).toBe(201);
    expect((await methodNote.json()).note).toMatchObject({ taskId: taskBody.task.id, kind: "method" });
    const taskNotes = await page.request.get(`/api/study-notes?taskId=${taskBody.task.id}`);
    expect(taskNotes.status()).toBe(200);
    const notes = (await taskNotes.json()).notes;
    expect(notes).toHaveLength(1);
    expect(notes[0].knowledgeLinks).toEqual(expect.arrayContaining([
      expect.objectContaining({ node: expect.objectContaining({ id: node.id, name: node.name }) }),
    ]));
    const clearLinks = await page.request.patch(`/api/study-notes/${notes[0].id}/knowledge`, {
      data: { knowledgeNodeIds: [] },
    });
    expect(clearLinks.status()).toBe(200);
    expect((await clearLinks.json()).note.knowledgeLinks).toHaveLength(0);
    const relink = await page.request.patch(`/api/study-notes/${notes[0].id}/knowledge`, {
      data: { knowledgeNodeIds: [node.id] },
    });
    expect(relink.status()).toBe(200);
    expect((await relink.json()).note.knowledgeLinks).toHaveLength(1);
    const linkCurriculum = await page.request.patch(`/api/study-notes/${notes[0].id}/curriculum`, {
      data: { curriculumNodeIds: ["network-tcp"] },
    });
    expect(linkCurriculum.status()).toBe(200);
    expect((await linkCurriculum.json()).note.curriculumNodeIds).toEqual(["network-tcp"]);
    const linkTaskCurriculum = await page.request.patch(`/api/tasks/${taskBody.task.id}`, {
      data: { curriculumNodeIds: ["network-tcp"] },
    });
    expect(linkTaskCurriculum.status()).toBe(200);
    expect((await linkTaskCurriculum.json()).task.curriculumNodeIds).toEqual(["network-tcp"]);
    const curriculumDetail = await page.request.get("/api/curriculum/nodes/network-tcp");
    expect(curriculumDetail.status()).toBe(200);
    const curriculumPayload = await curriculumDetail.json();
    expect(curriculumPayload.node).toMatchObject({ id: "network-tcp", title: "TCP 可靠传输与连接管理" });
    expect(curriculumPayload.evidence).toMatchObject({
      totalNotes: beforeEvidence.totalNotes + 1,
      taskCount: beforeEvidence.taskCount + 1,
      taskSourceCount: beforeEvidence.taskSourceCount + 1,
    });
    expect(curriculumPayload.notes).toEqual(expect.arrayContaining([expect.objectContaining({ id: notes[0].id })]));
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/knowledge/nodes/network-tcp");
    await expect(page.getByRole("heading", { name: "TCP 可靠传输与连接管理" })).toBeVisible({ timeout: 30_000 });
    await expect(page.locator(`a[href="/tasks?task=${taskBody.task.id}"]`).first()).toBeVisible();
    await expect(page.getByText("你的理解与方法")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    const rejectUnknownCurriculum = await page.request.patch(`/api/study-notes/${notes[0].id}/curriculum`, {
      data: { curriculumNodeIds: ["unknown-curriculum-node"] },
    });
    expect(rejectUnknownCurriculum.status()).toBe(400);
    const review = await page.request.post(`/api/study-notes/${notes[0].id}/review`, { data: { rating: "fuzzy" } });
    expect(review.status()).toBe(200);
    expect((await review.json()).note).toMatchObject({ id: notes[0].id, reviewCount: 1 });

    const started = await page.request.post(`/api/lessons/${lesson.id}/sessions`, { data: { taskId: taskBody.task.id } });
    expect(started.status()).toBe(201);
    const session = (await started.json()).session;
    expect(session.taskId).toBe(taskBody.task.id);
    const finished = await patchWithTransientRetry(page, `/api/study-sessions/${session.id}`, {
      status: "completed", selfAssessment: "clear", actualMinutes: 30,
    });
    expect(finished.status()).toBe(200);

    const storedTask = await page.request.get(`/api/tasks?weekStart=${weekStart}`);
    const storedTasks = (await storedTask.json()).tasks;
    expect(storedTasks.find((item: { id: string }) => item.id === taskBody.task.id).completed).toBe(false);
  });

  test("课程知识点详情在临时读取失败后给出可恢复提示", async ({ page }) => {
    await page.route("**/api/curriculum/nodes/network-tcp", async (route) => {
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: "服务暂时不可用，请稍后再试" }),
      });
    });

    await page.goto("/knowledge/nodes/network-tcp");
    await expect(page.getByText("服务暂时不可用，请稍后再试")).toBeVisible({ timeout: 5_000 });
    await expect(page.getByRole("button", { name: "重试" })).toBeVisible();
    await expect(page.getByRole("link", { name: "返回理解库" })).toBeVisible();
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
