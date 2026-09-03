import { test, expect } from "@playwright/test";

test.describe("Goal", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/goal");
  });

  test("form fields are visible", async ({ page }) => {
    await expect(page.locator("h1").filter({ hasText: /考研方向/ })).toBeVisible({ timeout: 10000 });
    await expect(page.locator("#goal-university")).toBeVisible();
    await expect(page.locator("#goal-major")).toBeVisible();
    await expect(page.locator("#goal-exam-date")).toBeVisible();
  });

  test("fill and save goal", async ({ page }) => {
    await page.fill("#goal-university", "测试大学");
    await page.fill("#goal-major", "计算机科学与技术");
    await page.fill("#goal-exam-date", "2026-12-25");

    // Click save button
    const saveBtn = page.getByRole("button", { name: /保存|更新/ });
    await expect(saveBtn).toBeVisible();
    await saveBtn.click();

    // Should show some feedback (success or loading)
    await page.waitForTimeout(2000);
  });

  test("subject selector is interactive", async ({ page }) => {
    // Subject selector should be present
    await expect(page.locator("text=考试科目")).toBeVisible({ timeout: 10000 });
  });

  test("can save an exploring direction without inventing a school or date", async ({ page }) => {
    test.setTimeout(120000);
    const original = await page.evaluate(async () => {
      const res = await fetch("/api/goal");
      return (await res.json()).goal;
    });

    try {
      const result = await page.evaluate(async () => {
        const res = await fetch("/api/goal", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            direction: "计算机类考研",
            university: null,
            major: null,
            examDate: null,
            subjects: [],
          }),
        });
        return { status: res.status, body: await res.json() };
      });

      expect(result.status).toBe(200);
      expect(result.body.goal).toMatchObject({
        direction: "计算机类考研",
        university: null,
        major: null,
        examDate: null,
        status: "exploring",
      });

      await page.reload();
      await expect(page.locator("#goal-direction")).toHaveValue("计算机类考研");
      await expect(page.getByText("目标探索中", { exact: true }).first()).toBeVisible();

      await page.goto("/dashboard");
      await expect(page.getByText("🎯 计算机类考研", { exact: true })).toBeVisible();
      await expect(page.getByRole("link", { name: "完善目标 →" })).toBeVisible();

      const pathResult = await page.evaluate(async () => {
        const res = await fetch("/api/study-path", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ generationMode: "local" }),
        });
        return { status: res.status, body: await res.json() };
      });
      expect(pathResult.status).toBe(200);
      expect(pathResult.body.isDraft).toBe(true);
      expect(pathResult.body.stages.map((stage: { key: string }) => stage.key)).toEqual(["explore", "foundation"]);
      expect(pathResult.body.path.description).toContain("当前信息尚不完整");
      await page.evaluate(async (pathId) => {
        await fetch("/api/study-path", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pathId, action: "discard" }),
        });
      }, pathResult.body.path.id);
    } finally {
      if (original) {
        await page.evaluate(async (goal) => {
          await fetch("/api/goal", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(goal),
          });
        }, original);
      }
    }
  });

  test("planning statement is reviewed before becoming long-term memory and can be withdrawn", async ({ page }) => {
    test.setTimeout(120000);
    const statement = `E2E-${Date.now()}：我想考研，但是 408 还有计算机网络没学，数学基础也弱，英语四级过了六级没过，我想学习没完成的课程，同时补一遍所有课程的基础。`;

    const analysisResult = await page.evaluate(async (text) => {
      const res = await fetch("/api/study-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "analyze", statement: text }),
      });
      return { status: res.status, body: await res.json() };
    }, statement);
    expect(analysisResult.status).toBe(200);
    expect(analysisResult.body.analysis.facts.map((fact: { label: string }) => fact.label)).toEqual(expect.arrayContaining([
      "计算机网络尚未开始",
      "数学基础薄弱",
      "英语四级已通过",
      "英语六级尚未通过",
      "未完成课程与全科基础并行",
    ]));
    expect(analysisResult.body.analysis.questions.length).toBeGreaterThan(0);

    await page.reload();
    await expect(page.locator("#planning-statement")).toBeVisible({ timeout: 10000 });
    await page.locator("#planning-statement").fill(statement);
    await page.getByRole("button", { name: "先看看系统怎么理解" }).click();
    await expect(page.getByText("计算机网络尚未开始", { exact: true })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("设计长期路线前还要逐步确认", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "能独立完成典型题" }).click();

    const before = await page.evaluate(async (text) => {
      const res = await fetch("/api/study-profile");
      const data = await res.json();
      return data.facts.some((fact: { value?: { text?: string } }) => fact.value?.text === text);
    }, statement);
    expect(before).toBe(false);

    const confirmed = await page.evaluate(async (text) => {
      const res = await fetch("/api/study-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "confirm",
          statement: text,
          answers: { foundation_exit: "能独立完成典型题", weekly_capacity: "12" },
        }),
      });
      return { status: res.status, body: await res.json() };
    }, statement);
    expect(confirmed.status).toBe(200);
    expect(confirmed.body.facts.length).toBeGreaterThanOrEqual(8);
    expect(confirmed.body.facts.map((fact: { label: string }) => fact.label)).toContain("基础阶段退出标准");

    const after = await page.evaluate(async (text) => {
      const res = await fetch("/api/study-profile");
      const data = await res.json();
      return data.facts.some((fact: { value?: { text?: string } }) => fact.value?.text === text);
    }, statement);
    expect(after).toBe(true);

    const ids = (confirmed.body.facts as Array<{ id: string }>).map((fact) => fact.id).join(",");
    const rejected = await page.request.delete("/api/study-profile?ids=" + encodeURIComponent(ids));
    expect(rejected.status()).toBe(200);
  });
});
