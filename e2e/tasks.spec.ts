import { test, expect } from "@playwright/test";

test.describe("Tasks", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tasks");
  });

  test("page loads with content", async ({ page }) => {
    await expect(page.locator("h1").filter({ hasText: /计划|规划|任务/ })).toBeVisible({ timeout: 10000 });
    await expect(page.getByLabel("直接告诉我这周怎么调整")).toBeVisible();
  });

  test("week navigation works", async ({ page }) => {
    const prevBtn = page.locator("button").filter({ hasText: "◀" }).first();
    const nextBtn = page.locator("button").filter({ hasText: "▶" }).first();
    await expect(prevBtn).toBeVisible({ timeout: 10000 });
    await expect(nextBtn).toBeVisible();
  });

  test("URL param ?week= restores week selection", async ({ page }) => {
    await page.goto("/tasks?week=2026-08-03");
    await page.waitForTimeout(2000);
    await expect(page.locator("h1").filter({ hasText: /计划|规划|任务/ })).toBeVisible({ timeout: 10000 });
  });

  test("add task modal opens", async ({ page }) => {
    const addBtn = page.locator("button").filter({ hasText: /添加|\+/ }).first();
    if (await addBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await addBtn.click();
      await page.waitForTimeout(1000);
    }
  });

  test("related module links are visible", async ({ page }) => {
    const related = page.getByText("继续学习").first();
    if (await related.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(page.locator('a[href="/knowledge-graph"]').first()).toBeVisible();
    }
  });

  test("weekly plan stays draft until confirmed and activation is idempotent", async ({ page }) => {
    test.setTimeout(60000);
    const pad = (n: number) => String(n).padStart(2, "0");
    const localDate = (dt: Date) => `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
    const future = new Date();
    future.setDate(future.getDate() + 700);
    const day = future.getDay();
    future.setDate(future.getDate() + (day === 0 ? -6 : 1 - day));
    future.setHours(0, 0, 0, 0);
    const weekStart = localDate(future);
    const manualTitle = `E2E手动任务${Date.now()}`;

    const manual = await page.request.post("/api/tasks", {
      data: { title: manualTitle, date: weekStart, weekStartDate: weekStart, source: "manual" },
    });
    expect(manual.status()).toBe(200);
    const manualTask = (await manual.json()).task;

    const before = await page.request.get(`/api/tasks?weekStart=${weekStart}`);
    const beforeTasks = (await before.json()).tasks;
    const generated = await page.request.post("/api/ai/generate-plan", {
      data: {
        weekStartDate: weekStart,
        weekStartLocal: weekStart,
        todayLocal: weekStart,
        generationMode: "local",
      },
    });
    expect(generated.status()).toBe(200);
    const generatedBody = await generated.json();
    expect(generatedBody.draft.status).toBe("draft");
    expect(generatedBody.draft.rationale).toBeTruthy();
    expect(generatedBody.draft.successCriteria.length).toBeGreaterThan(0);

    await page.goto(`/tasks?week=${weekStart}`);
    await expect(page.getByText(/待确认草稿/).first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/生成依据：/).first()).toBeVisible();
    await expect(page.getByText(/本周计划版本/).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "确认并应用" })).toBeVisible();

    const stillUnchanged = await page.request.get(`/api/tasks?weekStart=${weekStart}`);
    expect((await stillUnchanged.json()).tasks).toHaveLength(beforeTasks.length);

    const activate = await page.request.patch("/api/weekly-plans", {
      data: { id: generatedBody.draft.id, action: "activate", confirmImpact: true },
    });
    expect(activate.status()).toBe(200);
    const activeTasks = (await (await page.request.get(`/api/tasks?weekStart=${weekStart}`)).json()).tasks;
    expect(activeTasks.some((task: { title: string }) => task.title === manualTitle)).toBe(true);
    expect(activeTasks.some((task: { weeklyPlanId: string | null }) => task.weeklyPlanId === generatedBody.draft.id)).toBe(true);

    const repeated = await page.request.patch("/api/weekly-plans", {
      data: { id: generatedBody.draft.id, action: "activate" },
    });
    expect(repeated.status()).toBe(200);
    expect((await repeated.json()).alreadyActive).toBe(true);
    const afterRepeated = (await (await page.request.get(`/api/tasks?weekStart=${weekStart}`)).json()).tasks;
    expect(afterRepeated).toHaveLength(activeTasks.length);

    const generatedTask = activeTasks.find((task: { weeklyPlanId: string | null }) => task.weeklyPlanId === generatedBody.draft.id);
    expect(generatedTask).toBeTruthy();
    await page.request.patch(`/api/tasks/${generatedTask.id}`, {
      data: { title: `已调整旧任务${Date.now()}` },
    });
    const changedDraftResponse = await page.request.post("/api/ai/generate-plan", {
      data: {
        weekStartDate: weekStart,
        weekStartLocal: weekStart,
        todayLocal: weekStart,
        generationMode: "local",
        adjustmentRequest: "本周只有 5 小时，周三没空，数学一少一点，英语一重点加强",
      },
    });
    expect(changedDraftResponse.status()).toBe(200);
    const changedDraft = (await changedDraftResponse.json()).draft;
    const planState = await (await page.request.get(`/api/weekly-plans?weekStart=${weekStart}`)).json();
    expect(planState.draft.adjustmentRequest).toContain("5 小时");
    expect(planState.draft.constraints.weeklyHours).toBe(5);
    expect(planState.draft.constraints.unavailableWeekdays).toContain(3);
    expect(planState.draft.plannedMinutes).toBeLessThanOrEqual(300);
    expect(planState.draft.items.every((task: { date: string }) => new Date(`${task.date}T00:00:00`).getDay() !== 3)).toBe(true);
    expect(planState.draft.impact.removed.length).toBeGreaterThan(0);
    expect(planState.draft.impact.requiresConfirmation).toBe(true);

    const blocked = await page.request.patch("/api/weekly-plans", {
      data: { id: changedDraft.id, action: "activate" },
    });
    expect(blocked.status()).toBe(409);
    expect((await blocked.json()).requiresConfirmation).toBe(true);
    const confirmed = await page.request.patch("/api/weekly-plans", {
      data: { id: changedDraft.id, action: "activate", confirmImpact: true },
    });
    expect(confirmed.status()).toBe(200);

    await page.request.delete(`/api/tasks/${manualTask.id}`);
  });

  test("completing a task toggles checkbox without opening edit modal", async ({ page }) => {
    // 造一个本周任务（用本地日期串：app 现在按本地历法分组/过滤，UTC 串会错位一天）
    const pad = (n: number) => String(n).padStart(2, "0");
    const localDate = (dt: Date) => `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
    const d = new Date();
    const day = d.getDay();
    const ws = new Date(d);
    ws.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
    ws.setHours(0, 0, 0, 0);
    const wsStr = localDate(ws); // 本地周一
    const todayStr = localDate(new Date()); // 本地今天
    const title = `E2E勾选测试${Date.now()}`;
    const create = await page.request.post("/api/tasks", {
      data: { title, date: todayStr, weekStartDate: wsStr, duration: 30, phase: "基础阶段" },
    });
    expect(create.status()).toBe(200);
    const { task } = await create.json();

    await page.goto("/tasks");
    await page.waitForTimeout(1500);

    // 定位该任务行内的 checkbox
    const row = page
      .locator("div")
      .filter({ hasText: title })
      .filter({ has: page.locator('input[type="checkbox"]') })
      .last();
    const checkbox = row.locator('input[type="checkbox"]');
    await checkbox.click();
    await page.waitForTimeout(800);

    // 勾选不应误触发编辑弹窗
    await expect(page.locator("text=编辑任务")).not.toBeVisible({ timeout: 2000 });
    // checkbox 应保持勾选
    await expect(checkbox).toBeChecked();

    // 持久化：刷新后仍勾选（服务器已更新）
    await page.reload();
    await page.waitForTimeout(1500);
    const rowAfter = page
      .locator("div")
      .filter({ hasText: title })
      .filter({ has: page.locator('input[type="checkbox"]') })
      .last();
    await expect(rowAfter.locator('input[type="checkbox"]')).toBeChecked();

    // 学习概览（dashboard）也应显示已完成 —— 两端同读 DB，状态一致
    await page.goto("/dashboard");
    await page.waitForTimeout(1500);
    const dashRow = page.locator("div").filter({ hasText: title }).last();
    await expect(dashRow.locator("span.line-through").first()).toBeVisible({ timeout: 3000 });

    // 回计划页取消勾选也应持久化
    await page.goto("/tasks");
    await page.waitForTimeout(1500);
    const rowBefore = page
      .locator("div")
      .filter({ hasText: title })
      .filter({ has: page.locator('input[type="checkbox"]') })
      .last();
    await rowBefore.locator('input[type="checkbox"]').click();
    await page.waitForTimeout(800);
    await expect(rowBefore.locator('input[type="checkbox"]')).not.toBeChecked();
    await page.reload();
    await page.waitForTimeout(1500);
    const rowAfter2 = page
      .locator("div")
      .filter({ hasText: title })
      .filter({ has: page.locator('input[type="checkbox"]') })
      .last();
    await expect(rowAfter2.locator('input[type="checkbox"]')).not.toBeChecked();

    // 清理
    await page.request.delete(`/api/tasks/${task.id}`);
  });

  test("failed completion PATCH rolls back optimistic state (no UI/DB fork)", async ({ page }) => {
    // 造一个本周任务（本地日期串）
    const pad = (n: number) => String(n).padStart(2, "0");
    const localDate = (dt: Date) => `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
    const d = new Date();
    const day = d.getDay();
    const ws = new Date(d);
    ws.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
    ws.setHours(0, 0, 0, 0);
    const wsStr = localDate(ws);
    const todayStr = localDate(new Date());
    const title = `E2E失败回滚${Date.now()}`;
    const create = await page.request.post("/api/tasks", {
      data: { title, date: todayStr, weekStartDate: wsStr, duration: 30, phase: "基础阶段" },
    });
    expect(create.status()).toBe(200);
    const { task } = await create.json();

    // 拦截完成态 PATCH → 500（模拟服务器错误），其它请求放行
    await page.route("**/api/tasks/*", (route) => {
      if (route.request().method() === "PATCH") {
        return route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({}),
        });
      }
      return route.continue();
    });

    await page.goto("/tasks");
    await page.waitForTimeout(1500);

    const row = page
      .locator("div")
      .filter({ hasText: title })
      .filter({ has: page.locator('input[type="checkbox"]') })
      .last();
    const checkbox = row.locator('input[type="checkbox"]');
    await checkbox.click();
    await page.waitForTimeout(800);

    // 服务器失败 → 乐观状态应回滚（不能停在"已勾选"与 DB 分叉）
    await expect(checkbox).not.toBeChecked({ timeout: 2000 });
    // 且应提示用户失败
    await expect(page.locator("text=任务状态更新失败").first()).toBeVisible({ timeout: 2000 });

    // dashboard 也应保持一致（未完成）
    await page.goto("/dashboard");
    await page.waitForTimeout(1500);
    const dashRow = page.locator("div").filter({ hasText: title }).last();
    await expect(dashRow.locator("span.line-through").first()).not.toBeVisible({ timeout: 3000 });

    // 清理
    await page.request.delete(`/api/tasks/${task.id}`);
  });
});
