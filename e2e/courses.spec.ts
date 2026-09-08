import { expect, test } from "@playwright/test";

test.describe("Courses", () => {
  test("课程、学习会话、笔记和自评构成可追溯闭环", async ({ page }) => {
    test.setTimeout(60000);
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
});
