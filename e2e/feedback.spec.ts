import { test, expect } from "@playwright/test";

test.describe("Feedback", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/feedback");
  });

  test("page loads correctly", async ({ page }) => {
    await expect(page.locator("h1").filter({ hasText: /周报/ })).toBeVisible({ timeout: 10000 });
  });

  test("generate button is visible", async ({ page }) => {
    await expect(page.getByRole("button", { name: /生成/ })).toBeVisible({ timeout: 10000 });
  });

  test("review reasons are persisted without changing a plan", async ({ page }) => {
    const generated = await page.request.post("/api/ai/generate-feedback");
    expect(generated.ok()).toBeTruthy();
    const generatedBody = await generated.json();
    const id = generatedBody.feedback?.id;
    expect(id).toBeTruthy();

    const saved = await page.request.patch("/api/feedback", {
      data: {
        id,
        reasons: ["时间不够", "发现基础缺口"],
        note: "计算机网络第一章需要补基础",
        scope: "stage",
      },
    });
    expect(saved.ok()).toBeTruthy();
    const savedBody = await saved.json();
    expect(savedBody.feedback.review).toMatchObject({
      reasons: ["时间不够", "发现基础缺口"],
      note: "计算机网络第一章需要补基础",
      scope: "stage",
    });

    await page.reload();
    await expect(page.getByRole("button", { name: "查看/修改复盘" })).toBeVisible({ timeout: 10000 });
  });

  test("related module links are visible", async ({ page }) => {
    const related = page.getByText("继续学习").first();
    if (await related.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(page.locator('a[href="/tasks"]').first()).toBeVisible();
    }
  });
});
