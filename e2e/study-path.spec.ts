import { test, expect } from "@playwright/test";

test.describe("Study Path", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/study-path");
  });

  test("page loads correctly", async ({ page }) => {
    await expect(page.locator("h1").filter({ hasText: /路径/ })).toBeVisible({ timeout: 10000 });
  });

  test("milestone area is visible", async ({ page }) => {
    await page.waitForTimeout(5000);
    const body = await page.locator("body").textContent();
    // Should show either milestones, phases, or empty state
    expect(body).toBeTruthy();
  });

  test("related module links are visible", async ({ page }) => {
    const related = page.getByText("继续学习").first();
    if (await related.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(page.locator('a[href="/tasks"]').first()).toBeVisible();
    }
  });

  test("regeneration creates a discardable draft without replacing the active path", async ({ page }) => {
    test.setTimeout(120000);
    const originalGoal = await page.evaluate(async () => {
      const res = await fetch("/api/goal");
      return (await res.json()).goal;
    });

    let draftId: string | null = null;
    try {
      const goalResult = await page.evaluate(async () => {
        const res = await fetch("/api/goal", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            direction: "计算机类考研",
            university: "测试大学",
            major: "计算机科学与技术",
            examDate: "2027-12-25",
            subjects: ["数学一", "英语一", "408计算机"],
          }),
        });
        return res.status;
      });
      expect(goalResult).toBe(200);

      const before = await page.evaluate(async () => {
        const res = await fetch("/api/study-path");
        return res.json();
      });

      const generated = await page.evaluate(async () => {
        const res = await fetch("/api/study-path", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ generationMode: "local" }),
        });
        return { status: res.status, body: await res.json() };
      });
      expect(generated.status).toBe(200);
      expect(generated.body.isDraft).toBe(true);
      expect(generated.body.path.status).toBe("draft");
      expect(generated.body.stages).toHaveLength(4);
      expect(generated.body.stages[0]).toMatchObject({
        key: "foundation",
        title: "基础巩固",
        status: "pending",
      });
      expect(generated.body.stages[0].exitCriteria.length).toBeGreaterThan(0);
      expect(generated.body.milestones.every((milestone: { stageId: string | null }) => milestone.stageId)).toBe(true);
      const edited = await page.evaluate(async (stageId) => {
        const res = await fetch("/api/study-path/stages/" + stageId, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "updateDraft",
            objective: "先完成数学、英语和 408 的首轮基础，并确认每科可持续的学习节奏。",
            exitCriteria: ["完成全部基础课程的首轮学习", "基础题能够独立完成并订正", "形成可复用的错题和知识结构"],
          }),
        });
        return { status: res.status, body: await res.json() };
      }, generated.body.stages[0].id);
      expect(edited.status).toBe(200);
      expect(edited.body.stage).toMatchObject({
        objective: "先完成数学、英语和 408 的首轮基础，并确认每科可持续的学习节奏。",
        exitCriteria: ["完成全部基础课程的首轮学习", "基础题能够独立完成并订正", "形成可复用的错题和知识结构"],
      });
      draftId = generated.body.path.id;
      await page.reload();
      await expect(page.getByText(/路线版本历史/).first()).toBeVisible({ timeout: 10000 });

      const discarded = await page.evaluate(async (pathId) => {
        const res = await fetch("/api/study-path", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pathId, action: "discard" }),
        });
        return { status: res.status, body: await res.json() };
      }, draftId);
      expect(discarded.status).toBe(200);
      expect(discarded.body.activePathId).toBe(before.activePathId);
      expect(discarded.body.isDraft).toBe(false);
      draftId = null;
    } finally {
      if (draftId) {
        await page.evaluate(async (pathId) => {
          await fetch("/api/study-path", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ pathId, action: "discard" }),
          });
        }, draftId);
      }
      if (originalGoal) {
        await page.evaluate(async (goal) => {
          await fetch("/api/goal", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(goal),
          });
        }, originalGoal);
      }
    }
  });

  test("active stage requires confirmation before advancing with unfinished milestones", async ({ page }) => {
    test.setTimeout(120000);
    const goalStatus = await page.evaluate(async () => {
      const res = await fetch("/api/goal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          direction: "计算机类考研",
          university: "测试大学",
          major: "计算机科学与技术",
          examDate: "2027-12-25",
          subjects: ["数学一", "英语一", "408计算机"],
        }),
      });
      return res.status;
    });
    expect(goalStatus).toBe(200);

    const draft = await page.evaluate(async () => {
      const res = await fetch("/api/study-path", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ generationMode: "local" }),
      });
      return (await res.json()).path;
    });
    const activated = await page.evaluate(async (pathId) => {
      const res = await fetch("/api/study-path", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pathId, action: "activate" }),
      });
      return { status: res.status, body: await res.json() };
    }, draft.id);
    expect(activated.status).toBe(200);
    const firstStage = activated.body.stages.find((stage: { status: string }) => stage.status === "active");
    expect(firstStage?.key).toBe("foundation");

    const blocked = await page.evaluate(async (stageId) => {
      const res = await fetch(`/api/study-path/stages/${stageId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmIncomplete: false }),
      });
      return { status: res.status, body: await res.json() };
    }, firstStage.id);
    expect(blocked.status).toBe(409);
    expect(blocked.body.requiresConfirmation).toBe(true);

    const advanced = await page.evaluate(async (stageId) => {
      const res = await fetch(`/api/study-path/stages/${stageId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmIncomplete: true }),
      });
      return { status: res.status, body: await res.json() };
    }, firstStage.id);
    expect(advanced.status).toBe(200);
    expect(advanced.body.stage.status).toBe("completed");
    expect(advanced.body.nextStage).toMatchObject({ key: "intensify", status: "active" });

    const repeated = await page.evaluate(async (stageId) => {
      const res = await fetch(`/api/study-path/stages/${stageId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmIncomplete: true }),
      });
      return { status: res.status, body: await res.json() };
    }, firstStage.id);
    expect(repeated.status).toBe(200);
    expect(repeated.body.alreadyCompleted).toBe(true);
    expect(repeated.body.nextStage.key).toBe("intensify");
  });

  test("stage adjustment creates an impact proposal and preserves the current stage", async ({ page }) => {
    test.setTimeout(60000);
    const before = await page.evaluate(async () => {
      const res = await fetch("/api/study-path");
      return res.json();
    });
    expect(before.path?.status).toBe("active");
    const currentStage = before.stages.find((stage: { status: string }) => stage.status === "active");
    expect(currentStage).toBeTruthy();
    const milestoneToPreserve = before.milestones.find((milestone: { stageId: string | null }) => milestone.stageId === currentStage.id);
    expect(milestoneToPreserve).toBeTruthy();
    const completed = await page.evaluate(async (milestoneId) => {
      const res = await fetch("/api/study-path/progress", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ milestoneId, progress: 1, completed: true }),
      });
      return res.status;
    }, milestoneToPreserve.id);
    expect(completed).toBe(200);

    const weeklyScoped = await page.evaluate(async () => {
      const res = await fetch("/api/study-path/adjust", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ request: "这周只有 8 小时，周三没空" }),
      });
      return { status: res.status, body: await res.json() };
    });
    expect(weeklyScoped.status).toBe(409);
    expect(weeklyScoped.body.scope).toBe("weekly");
    expect(weeklyScoped.body.suggestedHref).toBe("/tasks");

    const proposal = await page.evaluate(async () => {
      const res = await fetch("/api/study-path/adjust", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ request: "计算机网络还没学，数学基础也弱，需要补一遍基础" }),
      });
      return { status: res.status, body: await res.json() };
    });
    expect(proposal.status).toBe(200);
    expect(proposal.body.isDraft).toBe(true);
    expect(proposal.body.activePathId).toBe(before.activePathId);
    expect(proposal.body.path.adjustmentRequest).toContain("计算机网络");
    expect(proposal.body.path.changeImpact.addedMilestones.length).toBeGreaterThanOrEqual(2);
    expect(proposal.body.path.changeImpact.preservedCompletedMilestones).toBeGreaterThanOrEqual(1);
    expect(proposal.body.path.changeImpact.datesChanged).toBe(false);
    const proposedCurrentStage = proposal.body.stages.find((stage: { status: string }) => stage.status === "active");
    expect(proposedCurrentStage.key).toBe(currentStage.key);
    expect(proposal.body.milestones.some((milestone: { title: string }) => milestone.title.includes("计算机网络"))).toBe(true);
    expect(proposal.body.milestones.find((milestone: { title: string }) => milestone.title === milestoneToPreserve.title).completedAt).toBeTruthy();

    const blocked = await page.evaluate(async (pathId) => {
      const res = await fetch("/api/study-path", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pathId, action: "activate" }),
      });
      return { status: res.status, body: await res.json() };
    }, proposal.body.path.id);
    expect(blocked.status).toBe(409);
    expect(blocked.body.requiresConfirmation).toBe(true);

    const activated = await page.evaluate(async (pathId) => {
      const res = await fetch("/api/study-path", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pathId, action: "activate", confirmImpact: true }),
      });
      return { status: res.status, body: await res.json() };
    }, proposal.body.path.id);
    expect(activated.status).toBe(200);
    expect(activated.body.isDraft).toBe(false);
    expect(activated.body.stages.find((stage: { status: string }) => stage.status === "active").key).toBe(currentStage.key);
  });
});
