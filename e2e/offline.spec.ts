import { test, expect } from "@playwright/test";

/**
 * 离线能力：
 * - 离线横幅出现/消失
 * - 离线打卡 → 乐观成功 +「离线已保存」提示 + 入队
 * - 恢复联网 → 队列自动补传 → 刷新后读到服务端真实数据
 *
 * 注意：打卡按日期 upsert，今天可能已被 checkin.spec.ts 打卡（fullyParallel），
 * 所以进入页面时若已是成功态，先点「修改打卡」回到编辑态，断言也只做宽泛检查。
 */
test.describe("Offline", () => {
  test("迟到的今日记录不会覆盖已经开始填写的打卡", async ({ page }) => {
    let resolveRead!: () => void;
    const delayedReadDelivered = new Promise<void>((resolve) => {
      resolveRead = resolve;
    });

    await page.route(/\/api\/checkin\?date=/, async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      await route.fulfill({
        json: { checkIn: { duration: 30, status: "good", note: null } },
      });
      resolveRead();
    });

    await page.goto("/checkin");
    const duration = page.locator("#checkin-duration");
    await expect(duration).toBeVisible();
    await duration.fill("45");

    await delayedReadDelivered;
    await expect(duration).toHaveValue("45");
    await expect(page.getByText("今日已打卡", { exact: false })).toHaveCount(0);
  });

  test("offline banner + offline check-in queues and syncs on reconnect", async ({ page, context }) => {
    await page.goto("/checkin");
    await page.waitForTimeout(1500);

    // 若今天已打卡 → 回到编辑态
    const alreadySubmitted = await page
      .getByText("今日已打卡", { exact: false })
      .isVisible({ timeout: 3000 })
      .catch(() => false);
    if (alreadySubmitted) {
      await page.locator("main").getByRole("button", { name: "修改打卡" }).click();
      await page.waitForTimeout(500);
    }

    // 切到离线 → 横幅出现
    await context.setOffline(true);
    await expect(page.getByText(/离线模式/)).toBeVisible({ timeout: 5000 });

    // 离线提交打卡 → 乐观成功 + 离线提示
    await page.fill("#checkin-duration", "45");
    await page.locator("main").getByRole("button", { name: /完成打卡|打卡/ }).first().click();
    await expect(page.getByText("今日已打卡", { exact: false }).first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/离线已保存/)).toBeVisible();

    // 恢复联网 → 队列补传 → 横幅消失
    await context.setOffline(false);
    await expect(page.getByText(/离线模式/)).toBeHidden({ timeout: 8000 });

    // 刷新后从服务端读到真实数据（不再显示离线提示）
    await page.reload();
    await expect(page.getByText("今日已打卡", { exact: false }).first()).toBeVisible({ timeout: 8000 });
    await expect(page.getByText(/离线已保存/)).toBeHidden();
  });

  test("离线完成任务后仍可记录理解，并按顺序同步任务与笔记", async ({ page, context }) => {
    const pad = (n: number) => String(n).padStart(2, "0");
    const localDate = (dt: Date) => `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() + (today.getDay() === 0 ? -6 : 1 - today.getDay()));
    const week = localDate(weekStart);
    const title = `E2E 离线理解 ${Date.now()}`;
    const content = `E2E 离线方法 ${Date.now()}`;
    const created = await page.request.post("/api/tasks", {
      data: { title, date: localDate(today), weekStartDate: week, curriculumNodeIds: ["ds-tree"] },
    });
    expect(created.status()).toBe(200);
    const { task } = await created.json();

    try {
      await page.goto(`/tasks?week=${week}`);
      const row = page.locator(`#task-${task.id}`);
      await expect(row).toBeVisible({ timeout: 30_000 });

      await context.setOffline(true);
      await row.locator('input[type="checkbox"]').click();
      const dialog = page.getByRole("dialog", { name: "任务已完成，留下一句给未来的自己" });
      await expect(dialog).toBeVisible();
      await dialog.getByLabel("完成任务后的理解记录", { exact: true }).fill(content);
      await dialog.getByRole("button", { name: "保存理解" }).click();
      await expect(dialog).toBeHidden();

      await context.setOffline(false);
      await expect(page.getByText(/离线模式/)).toBeHidden({ timeout: 8_000 });
      await page.reload();
      await expect(page.locator(`#task-${task.id} input[type="checkbox"]`)).toBeChecked({ timeout: 15_000 });

      await expect.poll(async () => {
        const response = await page.request.get(`/api/study-notes?taskId=${task.id}`);
        const body = await response.json();
        return body.notes.some((note: { content: string }) => note.content === content);
      }, { timeout: 15_000 }).toBe(true);
      const notes = (await (await page.request.get(`/api/study-notes?taskId=${task.id}`)).json()).notes as Array<{ id: string; content: string }>;
      const note = notes.find((item) => item.content === content);
      if (note) await page.request.delete(`/api/study-notes/${note.id}`);
    } finally {
      await context.setOffline(false);
      await page.request.delete(`/api/tasks/${task.id}`);
    }
  });
});
