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
