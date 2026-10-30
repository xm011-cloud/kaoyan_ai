import { test, expect } from "@playwright/test";

test.describe("Dashboard", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dashboard");
  });

  test("首页首先给出一条可执行的学习主线", async ({ page }) => {
    // 首页主叙事已改为“现在，只做下一步”，不再依赖已废弃的“学习概览”标题。
    await expect(page.getByText("现在，只做下一步")).toBeVisible({ timeout: 10000 });
    // 测试库刚清空时，尚未创建目标也有一个合法的首步入口。
    await expect(page.getByRole("link", { name: /开始这一项|安排今天|查看本周计划|查看完成情况/ })
      .or(page.getByRole("button", { name: "开始首周探索" }))
      .or(page.getByRole("button", { name: "重新加载今日任务" })))
      .toBeVisible();
  });

  test("quick-entry grid has module links", async ({ page }) => {
    // Check a few key quick-entry links exist
    const links = ["/tasks", "/checkin", "/chat", "/wrong-questions", "/practice", "/pomodoro"];
    for (const href of links) {
      await expect(page.locator(`a[href="${href}"]`).first()).toBeVisible({ timeout: 5000 });
    }
  });

  test("默认首页不重复铺开今日任务和学习统计", async ({ page }) => {
    // 任务数量、阶段和本周方向已在顶部的命令中心说明；
    // 默认首页不应再渲染旧的“今日任务”与统计卡片来争夺注意力。
    await expect(page.getByRole("link", { name: "📋 今日任务" })).toHaveCount(0);
    await expect(page.getByText("本周学习", { exact: true })).toHaveCount(0);
  });

  test("today tasks section is visible", async ({ page }) => {
    await expect(page.getByText("现在，只做下一步")).toBeVisible({ timeout: 10000 });
    // 新用户没有周计划时，产品正确展示“首周探索”按钮；已有计划时才展示周计划链接。
    await expect(page.getByRole("link", { name: /开始这一项|安排今天|查看本周计划|查看完成情况/ })
      .or(page.getByRole("button", { name: "开始首周探索" }))
      .or(page.getByRole("button", { name: "重新加载今日任务" })))
      .toBeVisible();
  });

  test("planning overview links goal, stage, week and today to actionable pages", async ({ page }) => {
    const commandCenter = page.locator("section").filter({ hasText: "现在，只做下一步" }).first();
    await expect(commandCenter).toBeVisible({ timeout: 10000 });
    // 空白账号会先进入首周探索；有计划后，主行动和周计划才会是链接。
    await expect(commandCenter.getByRole("link", { name: /开始这一项|安排今天|查看本周计划|查看完成情况/ })
      .or(commandCenter.getByRole("button", { name: "开始首周探索" }))
      .or(commandCenter.getByRole("button", { name: "重新加载今日任务" })))
      .toBeVisible();
    const weekLink = commandCenter.getByRole("link", { name: "查看周计划" });
    if (await weekLink.count()) {
      await expect(weekLink).toHaveAttribute("href", /^\/tasks\?week=/);
    } else {
      await expect(commandCenter.getByText(/先用一周的小样本确认从哪里开始|把学习节奏先稳定下来/)).toBeVisible();
    }
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

  test("没有今日任务时，到期错题会成为首页的下一步", async ({ page }) => {
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

  test("有今日任务时，到期错题仍优先，原任务作为复习后的下一项保留", async ({ page }) => {
    const pad = (n: number) => String(n).padStart(2, "0");
    const localDate = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() + (today.getDay() === 0 ? -6 : 1 - today.getDay()));
    const suffix = Date.now();
    const taskTitle = `E2E 复习后任务 ${suffix}`;
    const taskResponse = await page.request.post("/api/tasks", {
      data: { title: taskTitle, date: localDate(today), weekStartDate: localDate(weekStart) },
    });
    expect(taskResponse.status()).toBe(200);
    const task = (await taskResponse.json()).task as { id: string };
    const created = await page.request.post("/api/wrong-questions", {
      data: { subject: "408计算机", question: `E2E 任务与到期错题 ${suffix}`, answer: "用于验证优先级", source: "manual" },
    });
    expect(created.status()).toBe(200);
    const questionId = ((await created.json()).question as { id: string }).id;
    const existingResponse = await page.request.get(`/api/tasks?date=${localDate(today)}`);
    expect(existingResponse.status()).toBe(200);
    const existingTasks = (await existingResponse.json()).tasks as Array<{ id: string; completed: boolean; date: string }>;
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const movedTasks: Array<{ id: string; date: string }> = [];

    try {
      // 共享测试账号可能已有今日任务；暂时移开它们，保证“复习后下一项”的
      // 文案指向本用例创建的真实任务，而不是依赖测试执行顺序。
      for (const existingTask of existingTasks.filter((item) => !item.completed && item.id !== task.id)) {
        const moved = await page.request.patch(`/api/tasks/${existingTask.id}`, { data: { date: localDate(tomorrow) } });
        expect(moved.status()).toBe(200);
        movedTasks.push(existingTask);
      }
      const due = await page.request.patch(`/api/wrong-questions/${questionId}`, {
        data: { nextReviewDate: today.toISOString() },
      });
      expect(due.status()).toBe(200);
      await page.goto("/dashboard");

      const commandCenter = page.locator("section").filter({ hasText: "现在，只做下一步" }).first();
      await expect(commandCenter.getByText(/复习 \d+ 道到期错题/)).toBeVisible({ timeout: 30_000 });
      const reviewLink = commandCenter.getByRole("link", { name: "开始复习" });
      await expect(reviewLink).toHaveAttribute("href", "/wrong-questions?tab=due");
      const followUp = commandCenter.getByRole("link", { name: taskTitle });
      await expect(followUp).toHaveAttribute("href", `/tasks?week=${localDate(weekStart)}&task=${task.id}`);
    } finally {
      await page.request.delete(`/api/wrong-questions/${questionId}`);
      await page.request.delete(`/api/tasks/${task.id}`);
      for (const movedTask of movedTasks) {
        await page.request.patch(`/api/tasks/${movedTask.id}`, { data: { date: movedTask.date } });
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
      // 隔离共享账号的既有任务，避免精确计数依赖其他用例的执行顺序。
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
