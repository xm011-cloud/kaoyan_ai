import { test, expect } from "@playwright/test";

test.describe("Dashboard", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dashboard");
  });

  test("stats cards are visible", async ({ page }) => {
    // 首页主叙事已改为“现在，只做下一步”，不再依赖已废弃的“学习概览”标题。
    await expect(page.getByText("现在，只做下一步")).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole("link", { name: /开始这一项|安排今天|查看本周计划|查看完成情况/ })).toBeVisible();
  });

  test("quick-entry grid has module links", async ({ page }) => {
    // Check a few key quick-entry links exist
    const links = ["/tasks", "/checkin", "/chat", "/wrong-questions", "/practice", "/pomodoro"];
    for (const href of links) {
      await expect(page.locator(`a[href="${href}"]`).first()).toBeVisible({ timeout: 5000 });
    }
  });

  test("today tasks section is visible", async ({ page }) => {
    await expect(page.getByText("现在，只做下一步")).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole("link", { name: /查看周计划/ })).toBeVisible();
  });

  test("planning overview links goal, stage, week and today to actionable pages", async ({ page }) => {
    const commandCenter = page.locator("section").filter({ hasText: "现在，只做下一步" }).first();
    await expect(commandCenter).toBeVisible({ timeout: 10000 });
    await expect(commandCenter.locator('a[href^="/tasks"], a[href^="/courses"]').first()).toBeVisible();
    await expect(commandCenter.locator('a[href^="/tasks?week="]').first()).toBeVisible();
  });

  test("visible today course tasks link directly to a lesson in their planned week", async ({ page }) => {
    const pad = (n: number) => String(n).padStart(2, "0");
    const localDate = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() + (today.getDay() === 0 ? -6 : 1 - today.getDay()));
    const title = `E2E 首页课程直达 ${Date.now()}`;

    const createdCourse = await page.request.post("/api/courses", {
      data: { title, subject: "408计算机", firstLessonTitle: "第一节：直达学习桌" },
    });
    expect(createdCourse.status()).toBe(201);
    const course = (await createdCourse.json()).course;
    const lessonId = course.units[0].lessons[0].id as string;

    const createdTask = await page.request.post("/api/tasks", {
      data: {
        title,
        date: localDate(today),
        weekStartDate: localDate(weekStart),
        courseLessonId: lessonId,
      },
    });
    expect(createdTask.status()).toBe(200);
    const task = (await createdTask.json()).task;
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const existingResponse = await page.request.get(`/api/tasks?date=${localDate(today)}`);
    expect(existingResponse.status()).toBe(200);
    const existingTasks = (await existingResponse.json()).tasks as Array<{ id: string; completed: boolean; date: string }>;
    const movedTasks: Array<{ id: string; date: string }> = [];

    try {
      // 首页的主行动只会指向今天最早的未完成项。将共享测试库的既有任务暂时移开，
      // 才能验证用户真的从首页进入这一次创建的课程学习桌。
      for (const existingTask of existingTasks.filter((item) => !item.completed && item.id !== task.id)) {
        const moved = await page.request.patch(`/api/tasks/${existingTask.id}`, { data: { date: localDate(tomorrow) } });
        expect(moved.status()).toBe(200);
        movedTasks.push(existingTask);
      }
      await page.goto("/dashboard");
      const commandCenter = page.locator("section").filter({ hasText: "现在，只做下一步" }).first();
      const start = commandCenter.getByRole("link", { name: "开始这一项" });
      await expect(start).toHaveAttribute("href", `/courses?lesson=${lessonId}&task=${task.id}&week=${localDate(weekStart)}`, { timeout: 30_000 });
      await start.click();
      await expect(page).toHaveURL(new RegExp(`/courses\\?lesson=${lessonId}&task=${task.id}&week=${localDate(weekStart)}`));
      await expect(page.locator(`#lesson-${lessonId}`)).toHaveClass(/ring-2/, { timeout: 30_000 });
    } finally {
      await page.request.delete(`/api/tasks/${task.id}`);
      for (const movedTask of movedTasks) {
        await page.request.patch(`/api/tasks/${movedTask.id}`, { data: { date: movedTask.date } });
      }
    }
  });

  test("当天没有待办时，到期错题会成为首页的下一步", async ({ page }) => {
    const pad = (n: number) => String(n).padStart(2, "0");
    const localDate = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // 测试库的登录账户由全部用例共享。把已有“今天未完成”的任务暂时移出今日，
    // 才能验证无待办时的优先级；finally 中完整恢复，且不会改动完成证据。
    const existingResponse = await page.request.get(`/api/tasks?date=${localDate(today)}`);
    expect(existingResponse.status()).toBe(200);
    const existingTasks = (await existingResponse.json()).tasks as Array<{ id: string; completed: boolean; date: string }>;
    const movedTasks: Array<{ id: string; date: string }> = [];
    let wrongQuestionId: string | null = null;

    try {
      for (const task of existingTasks.filter((item) => !item.completed)) {
        const moved = await page.request.patch(`/api/tasks/${task.id}`, { data: { date: localDate(tomorrow) } });
        expect(moved.status()).toBe(200);
        movedTasks.push(task);
      }

      const created = await page.request.post("/api/wrong-questions", {
        data: { subject: "408计算机", question: `E2E 到期错题 ${Date.now()}`, answer: "用于验证首页复习入口", source: "manual" },
      });
      expect(created.status()).toBe(200);
      wrongQuestionId = ((await created.json()).question as { id: string }).id;
      const due = await page.request.patch(`/api/wrong-questions/${wrongQuestionId}`, {
        data: { nextReviewDate: today.toISOString() },
      });
      expect(due.status()).toBe(200);

      await page.goto("/dashboard");
      const commandCenter = page.locator("section").filter({ hasText: "现在，只做下一步" }).first();
      await expect(commandCenter.getByText(/复习 \d+ 道到期错题/)).toBeVisible({ timeout: 10000 });
      const reviewLink = commandCenter.getByRole("link", { name: "开始复习" });
      await expect(reviewLink).toHaveAttribute("href", "/wrong-questions?tab=due");
      await reviewLink.click();
      await expect(page).toHaveURL(/\/wrong-questions\?tab=due/);
      await expect(page.getByRole("button", { name: /今日到期/ })).toHaveClass(/bg-card/);
    } finally {
      if (wrongQuestionId) await page.request.delete(`/api/wrong-questions/${wrongQuestionId}`);
      for (const task of movedTasks) {
        await page.request.patch(`/api/tasks/${task.id}`, { data: { date: task.date } });
      }
    }
  });

  test("首页到期错题数字不受列表 10 条上限影响", async ({ page }) => {
    // 该用例需要创建并逐条标记 11 道错题，冷测试库下应给予完整写入预算。
    test.setTimeout(120_000);
    const pad = (n: number) => String(n).padStart(2, "0");
    const localDate = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const existingResponse = await page.request.get(`/api/tasks?date=${localDate(today)}`);
    expect(existingResponse.status()).toBe(200);
    const existingTasks = (await existingResponse.json()).tasks as Array<{ id: string; completed: boolean; date: string }>;
    const movedTasks: Array<{ id: string; date: string }> = [];
    const beforeResponse = await page.request.get("/api/wrong-questions?dueToday=true&limit=50");
    expect(beforeResponse.status()).toBe(200);
    const beforeTotal = ((await beforeResponse.json()).total as number) || 0;
    const createdIds: string[] = [];
    const dueDate = today;

    try {
      // 到期复习只会在当天没有未完成任务时成为首页主行动；先隔离共享账号的
      // 既有任务，才能验证精确计数，而不是依赖用例执行顺序。
      for (const task of existingTasks.filter((item) => !item.completed)) {
        const moved = await page.request.patch(`/api/tasks/${task.id}`, { data: { date: localDate(tomorrow) } });
        expect(moved.status()).toBe(200);
        movedTasks.push(task);
      }
      for (let index = 0; index < 11; index += 1) {
        const created = await page.request.post("/api/wrong-questions", {
          data: { subject: "408计算机", question: `E2E 超过十条到期错题 ${Date.now()}-${index}`, answer: "用于验证概览精确计数", source: "manual" },
        });
        expect(created.status()).toBe(200);
        const id = ((await created.json()).question as { id: string }).id;
        createdIds.push(id);
        const markDue = await page.request.patch(`/api/wrong-questions/${id}`, { data: { nextReviewDate: dueDate.toISOString() } });
        expect(markDue.status()).toBe(200);
      }

      await page.goto("/dashboard");
      const expectedTotal = beforeTotal + createdIds.length;
      // 探索期会隐藏下方可定制卡片，但顶部的“今日下一步”始终存在；这里验证
      // 超过列表 10 条上限后，用户仍能看到真实待复习总数。
      const commandCenter = page.locator("section").filter({ hasText: "现在，只做下一步" }).first();
      await expect(commandCenter.getByText(`复习 ${expectedTotal} 道到期错题`, { exact: true })).toBeVisible({ timeout: 30_000 });
    } finally {
      for (const id of createdIds) await page.request.delete(`/api/wrong-questions/${id}`);
      for (const task of movedTasks) {
        await page.request.patch(`/api/tasks/${task.id}`, { data: { date: task.date } });
      }
    }
  });
});
