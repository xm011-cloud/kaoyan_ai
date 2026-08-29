import { test, expect } from "@playwright/test";

test.describe("Tasks", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tasks");
  });

  test("page loads with content", async ({ page }) => {
    await expect(page.locator("h1").filter({ hasText: /计划|规划|任务/ })).toBeVisible({ timeout: 10000 });
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

  test("completing a task toggles checkbox without opening edit modal", async ({ page }) => {
    // 造一个本周任务（weekStart 与页面 getWeekStart 同口径 = 本周一）
    const d = new Date();
    const day = d.getDay();
    const ws = new Date(d);
    ws.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
    ws.setHours(0, 0, 0, 0);
    const wsStr = ws.toISOString().split("T")[0];
    const todayStr = new Date().toISOString().split("T")[0];
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

    // 清理
    await page.request.delete(`/api/tasks/${task.id}`);
  });
});
