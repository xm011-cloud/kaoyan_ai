import { NextRequest } from "next/server";
import { jsonNoStore } from "@/lib/api-utils";
import { getAuthUser } from "@/lib/api-auth";
import { getUserAiConfig, callAI, extractJson } from "@/lib/ai-config";
import { prisma } from "@/lib/prisma";

interface JudgePlanTask {
  title: string;
  description?: string;
  date: string;
  duration?: number;
  phase?: string;
  subject: string;
}

interface JudgeIssue {
  severity: "high" | "medium" | "low";
  description: string;
  fix: string;
}

interface JudgeResult {
  score: number;           // 0-100
  strengths: string[];
  issues: JudgeIssue[];
  verdict: "good" | "needs_work" | "poor";
  summary: string;
}

/**
 * POST /api/ai/judge-plan
 *
 * 独立审查学习计划质量。接收一个任务列表，返回评分、优劣势、问题和结论。
 *
 * Body: { tasks: JudgePlanTask[], examDate: string, subjects: string[] }
 * Response: JudgeResult
 */
export async function POST(request: NextRequest) {
  const { user, error } = await getAuthUser(request);
  if (error) return error;

  try {
    const body = await request.json().catch(() => null);
    if (!body || !Array.isArray(body.tasks) || body.tasks.length === 0) {
      return jsonNoStore(
        { error: "请提供待评审的任务列表" },
        { status: 400 }
      );
    }

    const { tasks, examDate, subjects = [] } = body as {
      tasks: JudgePlanTask[];
      examDate?: string;
      subjects?: string[];
    };

    const aiConfig = await getUserAiConfig(user!.id);

    if (!aiConfig) {
      // 无 AI Key → 快速本地规则校验
      const localResult = localJudge(tasks, examDate, subjects);
      return jsonNoStore(localResult);
    }

    // ── AI 评审 ──
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const daysRemaining = examDate
      ? Math.max(1, Math.ceil((new Date(examDate).getTime() - today.getTime()) / 86400000))
      : "未知";

    // 为 AI 准备任务摘要（不发送完整列表以节省 token）
    const taskSummary = buildTaskSummary(tasks);
    const subjectSet = [...new Set(tasks.map((t) => t.subject))];

    const prompt = `你是一名严格的考研辅导顾问（评审家），职责是审查学习计划的质量。你只找问题，不生成新计划。

## 计划概况
- 考试日期：${examDate || "未知"}
- 距考试：${daysRemaining} 天
- 科目：${subjectSet.join("、")}
- 任务总数：${tasks.length}
${taskSummary}

## 审查维度
1. **时间分配合理性**：各科目时间占比是否均衡？弱势科目是否获得更多时间？
2. **知识覆盖完整性**：是否覆盖了所有科目？是否有科目被遗漏？
3. **学习节奏科学性**：每天任务量是否合理（3-5 个任务/天，3-6 小时/天）？是否有休息日缓冲？
4. **交叉安排优化**：同一科目是否过度集中某一天？科目间是否有合理交叉？
5. **复盘机制**：是否有定期复盘安排（周末/阶段结束）？
6. **阶段匹配度**：任务类型是否与当前备考阶段匹配（基础期应侧重教材+课后题，冲刺期应侧重模考+真题）？

## 输出格式
只返回一个 JSON 对象，不含其他文字：
{
  "score": 85,
  "strengths": ["各科目时间分配均衡", "每天任务量合理"],
  "issues": [
    {
      "severity": "high",
      "description": "数学科目缺少练习题，只有视频课和教材阅读",
      "fix": "建议在每周三、五增加 60 分钟的练习题训练"
    }
  ],
  "verdict": "good",
  "summary": "整体计划合理，数学练习略有不足"
}

其中 verdict 取值：good(可直接采用)、needs_work(需微调)、poor(需重做)`;

    try {
      const result = await callAI(aiConfig, {
        messages: [
          {
            role: "system",
            content: "你是一个严格的考研计划评审专家。你只返回 JSON，不返回其他内容。你善于发现计划中的结构性问题。",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.3,
        maxTokens: 4096,
      });

      const fullContent = result.text || result.reasoningText || "";
      const judged = extractJson<JudgeResult>(fullContent);

      if (judged && typeof judged.score === "number") {
        return jsonNoStore(judged);
      }

      console.error("Judge AI returned invalid format:", fullContent.substring(0, 200));
      throw new Error("AI 评审返回格式不正确");
    } catch (e) {
      console.error("Judge AI error:", e instanceof Error ? e.message : String(e));
      const localResult = localJudge(tasks, examDate, subjects);
      return jsonNoStore(localResult);
    }
  } catch (err) {
    console.error("Judge plan error:", err);
    return jsonNoStore(
      { error: "计划评审失败，请稍后再试" },
      { status: 500 }
    );
  }
}

// ── 本地规则评审（无 AI Key 时的 fallback）──
function localJudge(
  tasks: JudgePlanTask[],
  examDate?: string,
  _subjects?: string[]
): JudgeResult {
  const issues: JudgeIssue[] = [];
  const strengths: string[] = [];

  // 按日期分组
  const byDate = new Map<string, JudgePlanTask[]>();
  const bySubject = new Map<string, JudgePlanTask[]>();
  for (const t of tasks) {
    const d = t.date;
    if (!byDate.has(d)) byDate.set(d, []);
    byDate.get(d)!.push(t);
    if (!bySubject.has(t.subject)) bySubject.set(t.subject, []);
    bySubject.get(t.subject)!.push(t);
  }

  // 检查每日任务量
  const days = Array.from(byDate.entries());
  for (const [date, dayTasks] of days) {
    if (dayTasks.length < 2) {
      issues.push({
        severity: "medium",
        description: `${date} 只有 ${dayTasks.length} 个任务，可能安排过少`,
        fix: "建议每天至少安排 3 个学习任务",
      });
    }
    if (dayTasks.length > 6) {
      issues.push({
        severity: "high",
        description: `${date} 有 ${dayTasks.length} 个任务，可能过于密集`,
        fix: "建议每天不超过 5 个任务，可将部分任务拆分到相邻日期",
      });
    }
    const dailyMinutes = dayTasks.reduce((s, t) => s + (t.duration || 60), 0);
    if (dailyMinutes > 420) {
      issues.push({
        severity: "medium",
        description: `${date} 学习时长 ${Math.round(dailyMinutes / 60)} 小时，可能过劳`,
        fix: "建议每天总时长控制在 3-6 小时",
      });
    }
  }

  // 检查科目覆盖
  if (bySubject.size <= 1 && tasks.length > 3) {
    issues.push({
      severity: "high",
      description: "只有 1 个科目，可能遗漏了其他考试科目",
      fix: "请确保所有考试科目都包含在计划中",
    });
  }

  // 检查周末复盘
  const hasWeekendReview = tasks.some((t) => {
    const d = new Date(t.date);
    const dow = d.getDay();
    return (dow === 0 || dow === 6) && /复盘|总结|回顾/.test(t.title);
  });
  if (!hasWeekendReview && days.length >= 7) {
    issues.push({
      severity: "low",
      description: "未发现周末复盘安排",
      fix: "建议在周日增加一次本周学习复盘任务",
    });
  }

  // 优点
  if (bySubject.size >= 3) {
    strengths.push("多科目覆盖，学科交叉安排合理");
  }
  if (tasks.length >= 20) {
    strengths.push("任务数量充足，学习节奏稳定");
  }

  let verdict: JudgeResult["verdict"];
  const highIssues = issues.filter((i) => i.severity === "high").length;
  if (highIssues >= 3) verdict = "poor";
  else if (highIssues >= 1 || issues.length >= 3) verdict = "needs_work";
  else verdict = "good";

  const score = Math.max(30, 100 - highIssues * 15 - issues.length * 5);

  return {
    score,
    strengths,
    issues,
    verdict,
    summary: issues.length === 0
      ? "计划看起来不错，可以放心采用"
      : `发现 ${issues.length} 个可改进点（${highIssues} 个重要），建议调整后采用`,
  };
}

// ── 构建 AI 用的任务摘要 ──
function buildTaskSummary(tasks: JudgePlanTask[]): string {
  const byDate = new Map<string, JudgePlanTask[]>();
  for (const t of tasks) {
    const d = t.date;
    if (!byDate.has(d)) byDate.set(d, []);
    byDate.get(d)!.push(t);
  }

  const days = Array.from(byDate.entries())
    .sort(([a], [b]) => a.localeCompare(b));

  let summary = "\n## 按日安排\n";
  for (const [date, dayTasks] of days.slice(0, 7)) {
    const subjects = [...new Set(dayTasks.map((t) => t.subject))];
    const totalMin = dayTasks.reduce((s, t) => s + (t.duration || 60), 0);
    summary += `- ${date}: ${dayTasks.length} 个任务, ${subjects.join("/")}, 共 ${Math.round(totalMin / 60)}小时\n`;
  }
  if (days.length > 7) summary += `... 共 ${days.length} 天\n`;

  return summary;
}
