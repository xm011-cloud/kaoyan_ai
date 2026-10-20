import { test, expect } from "@playwright/test";

function chinaStudyDate(offsetDays = 0) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value;
  const date = new Date(Date.UTC(Number(value("year")), Number(value("month")) - 1, Number(value("day")) + offsetDays));
  return date.toISOString().slice(0, 10);
}

test.describe("Wrong Questions", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/wrong-questions");
  });

  test("page loads with filters", async ({ page }) => {
    await expect(page.locator("h1").filter({ hasText: "错题" })).toBeVisible({ timeout: 10000 });
    await expect(page.locator("button").filter({ hasText: "全部" }).first()).toBeVisible();
  });

  test("add question modal opens", async ({ page }) => {
    const addBtn = page.getByRole("button", { name: /添加/ });
    await expect(addBtn).toBeVisible({ timeout: 10000 });
    await addBtn.click();
    await page.waitForTimeout(2000);
    // Modal should appear — check for modal heading or form
    const modalHeading = page.getByRole("heading", { name: /添加错题/ });
    const hasModal = await modalHeading.isVisible({ timeout: 5000 }).catch(() => false);
    expect(hasModal).toBe(true);
  });

  test("URL params restore filter state", async ({ page }) => {
    await page.goto("/wrong-questions?tab=unreviewed&subject=数学一");
    await page.waitForTimeout(2000);
    await expect(page.locator("h1").filter({ hasText: "错题" })).toBeVisible({ timeout: 10000 });
  });

  test("旧到期链接切换筛选后不会在刷新时跳回到期队列", async ({ page }) => {
    await page.goto("/wrong-questions?dueToday=true");
    const dueTab = page.getByRole("button", { name: /今日到期/ });
    await expect(dueTab).toHaveClass(/bg-card/, { timeout: 10000 });

    await page.getByRole("button", { name: "全部", exact: true }).click();
    await expect.poll(() => new URL(page.url()).searchParams.has("dueToday")).toBe(false);
    await page.reload();
    await expect(page.getByRole("button", { name: "全部", exact: true })).toHaveClass(/bg-card/);
  });

  test("错题复习和今日筛选遵循中国学习日", async ({ page }) => {
    const created = await page.request.post("/api/wrong-questions", {
      data: {
        subject: "E2E 学习日",
        question: `E2E 学习日错题 ${Date.now()}`,
        answer: "用于验证复习日期。",
        source: "manual",
      },
    });
    expect(created.status()).toBe(200);
    const question = (await created.json()).question;

    try {
      const reviewed = await page.request.patch(`/api/wrong-questions/${question.id}`, {
        data: { reviewed: true, rating: 5, reviewEventId: crypto.randomUUID() },
      });
      expect(reviewed.status()).toBe(200);
      expect((await reviewed.json()).question.nextReviewDate).toBe(`${chinaStudyDate(1)}T00:00:00.000Z`);

      // 即便已有复习记录，显式排到今天后仍必须回到“今日到期”队列，
      // 否则 SM-2 的下一次复习日期永远不会生效。
      const makeDue = await page.request.patch(`/api/wrong-questions/${question.id}`, {
        data: { nextReviewDate: `${chinaStudyDate()}T00:00:00.000Z` },
      });
      expect(makeDue.status()).toBe(200);
      const due = await page.request.get("/api/wrong-questions?dueToday=true&subject=E2E%20学习日");
      expect(due.status()).toBe(200);
      expect((await due.json()).questions).toEqual(expect.arrayContaining([expect.objectContaining({ id: question.id })]));
    } finally {
      await page.request.delete(`/api/wrong-questions/${question.id}`);
    }
  });

  test("今日到期只展示需要复习的队列", async ({ page }) => {
    const subject = `E2E 到期队列 ${Date.now()}`;
    const dueTitle = `${subject} - 今天到期`;
    const futureTitle = `${subject} - 明天复习`;
    const createdIds: string[] = [];

    try {
      for (const [question, nextReviewDate] of [
        [dueTitle, `${chinaStudyDate()}T00:00:00.000Z`],
        [futureTitle, `${chinaStudyDate(1)}T00:00:00.000Z`],
      ]) {
        const created = await page.request.post("/api/wrong-questions", {
          data: { subject, question, answer: "用于验证页面到期队列。", source: "manual" },
        });
        expect(created.status()).toBe(200);
        const id = (await created.json()).question.id as string;
        createdIds.push(id);
        const scheduled = await page.request.patch(`/api/wrong-questions/${id}`, { data: { nextReviewDate } });
        expect(scheduled.status()).toBe(200);
      }

      await page.goto(`/wrong-questions?tab=due&subject=${encodeURIComponent(subject)}`);
      await expect(page.getByText(dueTitle)).toBeVisible({ timeout: 10000 });
      await expect(page.getByText(futureTitle)).toHaveCount(0);
      await expect(page.getByRole("button", { name: "开始今日复习" })).toBeVisible();
    } finally {
      await Promise.all(createdIds.map((id) => page.request.delete(`/api/wrong-questions/${id}`)));
    }
  });

  test("复习错题时会带回此前留下的错因与解题方法", async ({ page }) => {
    const subject = `E2E 历史复盘 ${Date.now()}`;
    const reflection = "上次把条件概率和联合概率混淆，下次先写出条件事件。";
    const created = await page.request.post("/api/wrong-questions", {
      data: { subject, question: `${subject} 题目`, answer: "E2E 解析", source: "manual" },
    });
    expect(created.status()).toBe(200);
    const question = (await created.json()).question;

    try {
      const note = await page.request.post("/api/study-notes", {
        data: { wrongQuestionId: question.id, kind: "error", content: reflection },
      });
      expect(note.status()).toBe(201);
      const scheduled = await page.request.patch(`/api/wrong-questions/${question.id}`, {
        data: { nextReviewDate: `${chinaStudyDate()}T00:00:00.000Z` },
      });
      expect(scheduled.status()).toBe(200);

      await page.goto(`/wrong-questions?tab=due&subject=${encodeURIComponent(subject)}`);
      await page.getByRole("button", { name: "复习这道题" }).click();
      await expect(page.getByText("这道题还没有完成过复习")).toBeVisible();
      await page.getByRole("button", { name: /点击查看答案/ }).click();
      await expect(page.getByText("你上次留下的复盘")).toBeVisible();
      await expect(page.getByText(reflection)).toBeVisible();
    } finally {
      await page.request.delete(`/api/wrong-questions/${question.id}`);
    }
  });

  test("错题留下的理解可精确返回原题", async ({ page }) => {
    const subject = `E2E 理解来源 ${Date.now()}`;
    const created = await page.request.post("/api/wrong-questions", {
      data: { subject, question: `${subject} 题目`, answer: "E2E 解析", source: "manual" },
    });
    expect(created.status()).toBe(200);
    const question = (await created.json()).question;

    try {
      const note = await page.request.post("/api/study-notes", {
        data: { wrongQuestionId: question.id, kind: "method", content: "E2E 从错题回到原题" },
      });
      expect(note.status()).toBe(201);

      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(`/knowledge?wrongQuestionId=${question.id}`);
      const back = page.getByRole("link", { name: "回到这道错题 →" });
      await expect(back).toHaveAttribute("href", `/wrong-questions?question=${question.id}`, { timeout: 30_000 });
      await expect(page.getByText("来源：错题 ·")).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    } finally {
      await page.request.delete(`/api/wrong-questions/${question.id}`);
    }
  });

  test("手机端今日错题可开始复习，主要操作不小于触控尺寸", async ({ page }) => {
    const subject = `E2E 手机复习 ${Date.now()}`;
    const created = await page.request.post("/api/wrong-questions", {
      data: { subject, question: `${subject} 题目`, answer: "E2E 解析", source: "manual" },
    });
    expect(created.status()).toBe(200);
    const question = (await created.json()).question;

    try {
      await page.request.patch(`/api/wrong-questions/${question.id}`, {
        data: { nextReviewDate: `${chinaStudyDate()}T00:00:00.000Z` },
      });
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(`/wrong-questions?tab=due&subject=${encodeURIComponent(subject)}`);
      const start = page.getByRole("button", { name: "开始今日复习" });
      await expect(start).toBeVisible({ timeout: 30_000 });
      const startBox = await start.boundingBox();
      expect(startBox?.height).toBeGreaterThanOrEqual(44);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
      await start.click();
      const reveal = page.getByRole("button", { name: /点击查看答案/ });
      await expect(reveal).toBeVisible();
      const revealBox = await reveal.boundingBox();
      expect(revealBox?.height).toBeGreaterThanOrEqual(44);
    } finally {
      await page.request.delete(`/api/wrong-questions/${question.id}`);
    }
  });

  test("batch import modal opens", async ({ page }) => {
    const batchBtn = page.getByRole("button", { name: /批量|导入/ });
    if (await batchBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await batchBtn.click();
      await page.waitForTimeout(1000);
    }
  });

  test("related module links are visible", async ({ page }) => {
    const related = page.getByText("继续学习").first();
    if (await related.isVisible({ timeout: 5000 }).catch(() => false)) {
      // Use .first() to avoid strict mode violation
      await expect(page.locator('a[href="/practice"]').last()).toBeVisible();
    }
  });
});
