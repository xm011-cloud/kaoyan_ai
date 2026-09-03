import { prisma } from "@/lib/prisma";
import { startOfDay, getWeekStart, getWeekEnd, toDateString } from "@/lib/date-utils";
import { randomUUID } from "node:crypto";
import type { AiTool } from "@/lib/ai-config";
import { appendSkillNote, skillFinish } from "@/lib/skills";
import { searchWeb } from "@/lib/search";
import { getDaysToGoal, getGoalLabel } from "@/lib/goal-model";

// ── 工具执行结果 ──

export interface ToolActionResult {
  /** 给 AI 看的 JSON 结果（注入到 tool role message） */
  result: string;
  /** 是否写操作（写操作会在前端渲染操作卡片） */
  writes: boolean;
  /** 前端操作卡片（仅写操作有值） */
  actionCard?: {
    type: "task_created" | "task_completed" | "checkin_created" | "reminder_updated";
    title: string;
    detail: string;
  };
}

// ── 工具定义 + 执行器 ──

/** 工具执行上下文（由调用方注入，如当前对话 ID / 技能 ID） */
export interface ToolContext {
  chatId?: string | null;
  skillId?: string | null;
}

interface ToolEntry {
  definition: AiTool;
  executor: (userId: string, args: Record<string, unknown>, ctx?: ToolContext) => Promise<ToolActionResult>;
}

const TOOL_ENTRIES: ToolEntry[] = [
  // ═══════════════════════════════════════════
  // 读操作
  // ═══════════════════════════════════════════

  {
    definition: {
      type: "function",
      function: {
        name: "get_today_tasks",
        description: "获取用户今天的所有学习任务，包括已完成和未完成的任务。当用户询问'今天有什么任务'、'今天学了什么'、'待办事项'等问题时使用。",
        parameters: { type: "object", properties: {}, required: [] },
      },
    },
    executor: async (userId) => {
      const today = startOfDay(new Date());
      const endOfToday = new Date(today.getTime() + 86400000 - 1);
      const tasks = await prisma.task.findMany({
        where: { userId, date: { gte: today, lte: endOfToday } },
        orderBy: { date: "asc" },
        select: { id: true, title: true, description: true, completed: true, duration: true, subject: true, phase: true },
      });
      return {
        writes: false,
        result: JSON.stringify({
          date: toDateString(today),
          total: tasks.length,
          completed: tasks.filter((t) => t.completed).length,
          tasks: tasks.map((t) => ({
            id: t.id,
            title: t.title,
            description: t.description,
            completed: t.completed,
            duration: t.duration,
            subject: t.subject,
            phase: t.phase,
          })),
        }),
      };
    },
  },

  {
    definition: {
      type: "function",
      function: {
        name: "get_checkin_status",
        description: "获取用户今日打卡状态和最近7天打卡记录。当用户询问'今天打卡了吗'、'打卡状态'、'最近学习情况'时使用。",
        parameters: { type: "object", properties: {}, required: [] },
      },
    },
    executor: async (userId) => {
      const today = startOfDay(new Date());
      const sevenDaysAgo = new Date(today.getTime() - 6 * 86400000);
      const endOfToday = new Date(today.getTime() + 86400000 - 1);

      const [todayCheckin, weekCheckIns] = await Promise.all([
        prisma.checkIn.findFirst({ where: { userId, date: today } }),
        prisma.checkIn.findMany({
          where: { userId, date: { gte: sevenDaysAgo, lte: endOfToday } },
          orderBy: { date: "asc" },
        }),
      ]);

      const totalMinutes = weekCheckIns.reduce((s, c) => s + c.duration, 0);
      return {
        writes: false,
        result: JSON.stringify({
          date: toDateString(today),
          checkedInToday: !!todayCheckin,
          todayStatus: todayCheckin?.status ?? null,
          todayDuration: todayCheckin?.duration ?? 0,
          todayNote: todayCheckin?.note ?? null,
          weekCheckInDays: weekCheckIns.length,
          weekTotalMinutes: totalMinutes,
          weekTotalHours: (totalMinutes / 60).toFixed(1),
        }),
      };
    },
  },

  {
    definition: {
      type: "function",
      function: {
        name: "get_goal",
        description: "获取用户的考研目标信息（目标院校、专业、考试日期、科目、目标分数、各科进度）。当用户询问'我的目标'、'考研目标'、'还差多少分'、'距离考试'等问题时使用。",
        parameters: { type: "object", properties: {}, required: [] },
      },
    },
    executor: async (userId) => {
      const goal = await prisma.goal.findUnique({ where: { userId } });
      if (!goal) {
        return { writes: false, result: JSON.stringify({ hasGoal: false }) };
      }
      const daysRemaining = getDaysToGoal(goal);
      return {
        writes: false,
        result: JSON.stringify({
          hasGoal: true,
          status: goal.status,
          direction: goal.direction,
          label: getGoalLabel(goal),
          university: goal.university,
          major: goal.major,
          examDate: goal.examDate ? toDateString(goal.examDate) : null,
          daysRemaining,
          subjects: goal.subjects,
          targetScores: goal.targetScores,
          progress: goal.progress,
        }),
      };
    },
  },

  {
    definition: {
      type: "function",
      function: {
        name: "get_due_reviews",
        description: "获取用户今日需要复习的错题列表（基于 SM-2 间隔重复算法）。当用户询问'今天要复习什么'、'错题复习'、'待复习'时使用。",
        parameters: {
          type: "object",
          properties: {
            subject: { type: "string", description: "按科目筛选（可选）" },
            limit: { type: "number", description: "最多返回条数，默认 10（可选）" },
          },
          required: [],
        },
      },
    },
    executor: async (userId, args) => {
      const now = new Date();
      now.setHours(23, 59, 59, 999);
      const where: Record<string, unknown> = {
        userId,
        reviewed: false,
        nextReviewDate: { lte: now },
      };
      if (args.subject) where.subject = args.subject;

      const questions = await prisma.wrongQuestion.findMany({
        where,
        orderBy: { nextReviewDate: "asc" },
        take: (args.limit as number) || 10,
        select: { id: true, subject: true, question: true, tags: true, easeFactor: true, interval: true },
      });
      return {
        writes: false,
        result: JSON.stringify({
          dueToday: questions.length,
          questions: questions.map((q) => ({
            id: q.id,
            subject: q.subject,
            question: q.question.slice(0, 200),
            tags: q.tags,
          })),
        }),
      };
    },
  },

  {
    definition: {
      type: "function",
      function: {
        name: "get_weekly_stats",
        description: "获取用户本周学习统计数据（打卡天数、总时长、任务完成率、番茄钟使用情况等）。当用户询问'本周总结'、'这周学了多久'、'学习统计'时使用。",
        parameters: { type: "object", properties: {}, required: [] },
      },
    },
    executor: async (userId) => {
      const today = startOfDay(new Date());
      const weekStart = getWeekStart(today);
      const weekEnd = getWeekEnd(today);

      const [checkIns, tasks, pomoSessions] = await Promise.all([
        prisma.checkIn.findMany({ where: { userId, date: { gte: weekStart, lte: weekEnd } } }),
        prisma.task.findMany({ where: { userId, date: { gte: weekStart, lte: weekEnd } } }),
        prisma.pomodoroSession.findMany({
          where: { userId, createdAt: { gte: weekStart, lte: weekEnd } },
        }),
      ]);

      const totalMinutes = checkIns.reduce((s, c) => s + c.duration, 0);
      const taskCompleted = tasks.filter((t) => t.completed).length;
      const focusCompleted = pomoSessions.filter(
        (p) => p.status === "completed" && p.type === "focus"
      ).length;

      return {
        writes: false,
        result: JSON.stringify({
          week: `${toDateString(weekStart)} ~ ${toDateString(weekEnd)}`,
          checkInDays: checkIns.length,
          totalMinutes,
          totalHours: (totalMinutes / 60).toFixed(1),
          taskTotal: tasks.length,
          taskCompleted,
          taskCompletionRate: tasks.length > 0 ? Math.round((taskCompleted / tasks.length) * 100) : 0,
          pomodoroFocusCompleted: focusCompleted,
        }),
      };
    },
  },

  // ═══════════════════════════════════════════
  // 写操作
  // ═══════════════════════════════════════════

  {
    definition: {
      type: "function",
      function: {
        name: "search_web",
        description:
          "联网搜索网页。当用户询问院校复试分数线、招生人数、考试科目、报录比、考研政策、参考书目等需要最新网络信息的问题时使用。返回标题/URL/摘要列表（按相关性排序），请基于返回结果回答并标注来源，不要编造。",
        parameters: {
          type: "object",
          properties: {
            query: { type: "string", description: "搜索关键词，建议包含院校名和专业，如'北京大学 计算机 考研 复试分数线'" },
            maxResults: { type: "number", description: "返回结果数，默认 6" },
          },
          required: ["query"],
        },
      },
    },
    executor: async (_userId, args) => {
      const query = String(args.query || "").trim();
      if (!query) {
        return { writes: false, result: JSON.stringify({ error: "缺少搜索关键词" }) };
      }
      const max = typeof args.maxResults === "number" ? Math.min(Math.max(1, args.maxResults), 8) : 6;
      const results = await searchWeb(query, max);
      return {
        writes: false,
        result: JSON.stringify({
          query,
          total: results.length,
          results: results.map((r) => ({ title: r.title, url: r.url, snippet: r.snippet })),
        }),
      };
    },
  },

  {
    definition: {
      type: "function",
      function: {
        name: "create_task",
        description: "创建一个新的学习任务。当用户要求'帮我添加任务'、'安排一个'、'创建一个任务'、'提醒我'等时使用。注意：一次只创建一个任务；如果用户一次要求安排 3 个及以上任务，请改用 propose_tasks 生成提案让用户确认。",
        parameters: {
          type: "object",
          properties: {
            title: { type: "string", description: "任务标题，要具体可执行，如'完成高数第三章课后习题'" },
            date: { type: "string", description: "任务日期，YYYY-MM-DD 格式。默认今天" },
            duration: { type: "number", description: "预计学习时长（分钟），建议 30-180" },
            subject: { type: "string", description: "所属科目，如'数学一'、'英语二'、'政治'" },
            description: { type: "string", description: "任务详细描述（可选）" },
          },
          required: ["title"],
        },
      },
    },
    executor: async (userId, args) => {
      const dateStr = (args.date as string) || toDateString(new Date());
      const title = args.title as string;
      const task = await prisma.task.create({
        data: {
          userId,
          title,
          description: (args.description as string) || null,
          date: new Date(dateStr),
          duration: (args.duration as number) || null,
          subject: (args.subject as string) || null,
          source: "ai",
        },
      });
      return {
        writes: true,
        actionCard: {
          type: "task_created",
          title: `已创建任务：${title}`,
          detail: [dateStr, args.duration ? `${args.duration}分钟` : "", args.subject ? (args.subject as string) : ""]
            .filter(Boolean)
            .join(" · "),
        },
        result: JSON.stringify({ success: true, task: { id: task.id, title: task.title, date: dateStr } }),
      };
    },
  },

  {
    // 提案工具：批量任务草稿，不落 Task。挂到对话 pendingProposal，用户确认后才落库。
    definition: {
      type: "function",
      function: {
        name: "propose_tasks",
        description: "为 3 个及以上任务生成一份提案，供用户逐项确认。当用户一次要求安排多个任务、或想批量调整任务时使用。提案不会直接创建任务，需用户在对话界面确认后才会加入任务清单。单个任务用 create_task。",
        parameters: {
          type: "object",
          properties: {
            items: {
              type: "array",
              description: "要安排的任务清单（最多 20 条）",
              items: {
                type: "object",
                properties: {
                  title: { type: "string", description: "任务标题，要具体可执行，如'完成高数第三章课后习题'" },
                  date: { type: "string", description: "任务日期 YYYY-MM-DD，默认今天" },
                  duration: { type: "number", description: "预计学习时长（分钟），30-180" },
                  subject: { type: "string", description: "所属科目" },
                  description: { type: "string", description: "详细描述（可选）" },
                },
                required: ["title"],
              },
            },
            note: { type: "string", description: "给用户的简短说明（可选）" },
          },
          required: ["items"],
        },
      },
    },
    executor: async (userId, args, ctx) => {
      const rawItems = Array.isArray(args.items) ? (args.items as Record<string, unknown>[]) : [];
      if (rawItems.length === 0) {
        return { writes: false, result: JSON.stringify({ success: false, error: "提案不能为空" }) };
      }
      const items = rawItems
        .slice(0, 20)
        .map((it) => ({
          title: String(it.title || "").trim(),
          date: (it.date as string) || toDateString(new Date()),
          duration: Number(it.duration) || 60,
          subject: (it.subject as string) || null,
          description: (it.description as string) || null,
        }))
        .filter((it) => it.title.length > 0);

      if (items.length === 0) {
        return { writes: false, result: JSON.stringify({ success: false, error: "提案没有有效任务" }) };
      }

      const proposalId = `prop_${randomUUID()}`;
      const note = (args.note as string) || null;

      // 草稿不落 Task；挂到对话的 pendingProposal（供确认/撤销）。无 chatId 时由路由先建对话再回写。
      if (ctx?.chatId) {
        try {
          await prisma.chat.update({
            where: { id: ctx.chatId },
            data: {
              pendingProposal: {
                proposalId,
                items,
                note,
                createdAt: new Date().toISOString(),
              },
            },
          });
        } catch {
          // 对话不存在 → 忽略（路由层会兜底创建）
        }
      }

      return {
        writes: false,
        result: JSON.stringify({
          success: true,
          proposalId,
          items,
          note,
          total: items.length,
          // 提示 AI：需要用户确认，别直接说"已创建"
          action: "wait_for_confirmation",
        }),
      };
    },
  },

  {
    definition: {
      type: "function",
      function: {
        name: "toggle_task_completion",
        description: "切换任务的完成状态。如果任务是未完成的则标记为已完成，如果已完成则标记为未完成。当用户要求'完成任务'、'标记为完成'、'做完了'时使用。",
        parameters: {
          type: "object",
          properties: {
            taskId: { type: "string", description: "任务的 ID" },
          },
          required: ["taskId"],
        },
      },
    },
    executor: async (userId, args) => {
      const taskId = args.taskId as string;
      const task = await prisma.task.findFirst({ where: { id: taskId, userId } });
      if (!task) {
        return {
          writes: true,
          result: JSON.stringify({ success: false, error: `任务 ${taskId} 不存在或不属于你` }),
        };
      }
      const updated = await prisma.task.update({
        where: { id: taskId },
        data: { completed: !task.completed },
      });
      const statusText = updated.completed ? "已完成" : "已取消完成";
      return {
        writes: true,
        actionCard: {
          type: "task_completed",
          title: `${statusText}：${updated.title}`,
          detail: updated.completed ? "任务已标记为完成 ✅" : "任务已恢复为未完成",
        },
        result: JSON.stringify({
          success: true,
          task: { id: updated.id, title: updated.title, completed: updated.completed },
        }),
      };
    },
  },

  {
    definition: {
      type: "function",
      function: {
        name: "create_checkin",
        description: "创建或更新今日学习打卡记录。当用户说'帮我打卡'、'打卡'、'记录今天的学习'时使用。",
        parameters: {
          type: "object",
          properties: {
            duration: { type: "number", description: "学习时长（分钟）" },
            status: { type: "string", enum: ["good", "normal", "tired"], description: "学习状态：good=状态好, normal=一般, tired=疲惫" },
            note: { type: "string", description: "备注（可选）" },
          },
          required: ["duration", "status"],
        },
      },
    },
    executor: async (userId, args) => {
      const today = startOfDay(new Date());
      const duration = args.duration as number;
      const status = (args.status as string) || "normal";
      const note = (args.note as string) || null;
      const checkIn = await prisma.checkIn.upsert({
        where: { userId_date: { userId, date: today } },
        create: { userId, date: today, duration, status, note },
        update: { duration, status, note },
      });
      const statusLabels: Record<string, string> = { good: "状态好 😊", normal: "一般 🙂", tired: "疲惫 😴" };
      return {
        writes: true,
        actionCard: {
          type: "checkin_created",
          title: `已打卡：${duration}分钟`,
          detail: `${statusLabels[status] || status}${note ? ` · ${note}` : ""}`,
        },
        result: JSON.stringify({ success: true, date: toDateString(today), duration: checkIn.duration, status: checkIn.status }),
      };
    },
  },

  {
    definition: {
      type: "function",
      function: {
        name: "update_reminder",
        description: "更新学习提醒设置。当用户要求'设置提醒'、'每天早上提醒我'、'改提醒时间'、'关闭提醒'时使用。",
        parameters: {
          type: "object",
          properties: {
            enabled: { type: "boolean", description: "是否开启提醒" },
            time: { type: "string", description: "提醒时间，HH:MM 格式，如'09:00'（可选）" },
            days: {
              type: "array",
              items: { type: "string" },
              description: "提醒日期，如 ['1','2','3','4','5'] 表示周一至周五。1=周一, 7=周日（可选）",
            },
          },
          required: ["enabled"],
        },
      },
    },
    executor: async (userId, args) => {
      await prisma.user.update({
        where: { id: userId },
        data: {
          reminderEnabled: args.enabled as boolean,
          ...(args.time !== undefined && { reminderTime: args.time as string }),
          ...(args.days !== undefined && { reminderDays: args.days as string[] }),
        },
      });
      const dayNames = ["一", "二", "三", "四", "五", "六", "日"];
      const daysLabel = args.days
        ? (args.days as string[]).map((d) => dayNames[parseInt(d) - 1] || d).join("、")
        : "";
      return {
        writes: true,
        actionCard: {
          type: "reminder_updated",
          title: args.enabled ? "学习提醒已开启 🔔" : "学习提醒已关闭 🔕",
          detail: args.enabled
            ? [args.time ? `每天 ${args.time}` : "", daysLabel ? `周${daysLabel}` : ""].filter(Boolean).join(" · ")
            : "",
        },
        result: JSON.stringify({ success: true, reminderEnabled: args.enabled }),
      };
    },
  },

  {
    // 技能运行内部工具：追加档案 + 收尾。仅技能运行（chat.skillId 非空）注入。
    definition: {
      type: "function",
      function: {
        name: "skill_control",
        description:
          "（技能运行内部工具）控制技能运行。action=note_append：把内容追加到技能档案，供跨会话累积（如复盘日记、抽查记录）；action=finish：完成本次技能运行并记一次使用。",
        parameters: {
          type: "object",
          properties: {
            action: {
              type: "string",
              enum: ["note_append", "finish"],
              description: "操作类型",
            },
            content: { type: "string", description: "note_append 时追加的档案内容（简洁）" },
            label: { type: "string", description: "note_append 时的记录标签（可选，如『每日复盘』）" },
            summary: { type: "string", description: "finish 时的收尾总结（可选）" },
          },
          required: ["action"],
        },
      },
    },
    executor: async (userId, args, ctx) => {
      if (!ctx?.skillId) {
        return { writes: false, result: JSON.stringify({ error: "此工具仅技能运行时可使用" }) };
      }
      const action = args.action as string;
      if (action === "note_append") {
        const content = typeof args.content === "string" ? args.content.slice(0, 2000) : "";
        if (!content) {
          return { writes: false, result: JSON.stringify({ success: false, error: "档案内容不能为空" }) };
        }
        const res = await appendSkillNote(
          userId,
          ctx.skillId,
          content,
          typeof args.label === "string" && args.label ? args.label : undefined
        );
        return { writes: false, result: JSON.stringify(res) };
      }
      if (action === "finish") {
        const res = await skillFinish(userId, ctx.skillId);
        return {
          writes: false,
          result: JSON.stringify({
            ...res,
            action: "finished",
            summary: typeof args.summary === "string" ? args.summary : undefined,
          }),
        };
      }
      return { writes: false, result: JSON.stringify({ success: false, error: `未知 action: ${action}` }) };
    },
  },
];

// ── 公开 API ──

/** 获取所有工具定义（传给 AI API 的 tools 参数）；技能内部工具 skill_control 不暴露给普通对话 */
export function getToolDefinitions(): AiTool[] {
  return TOOL_ENTRIES.filter((t) => t.definition.function.name !== "skill_control").map(
    (t) => t.definition
  );
}

/** 技能运行的 tools（基础工具 + skill_control） */
export function getSkillRunTools(): AiTool[] {
  return TOOL_ENTRIES.map((t) => t.definition);
}

/** 判断是否为技能收尾调用（skill_control / action=finish） */
export function isSkillFinishCall(name: string, args: Record<string, unknown>): boolean {
  return name === "skill_control" && args.action === "finish";
}

/** 根据工具名查找并执行 */
export async function executeTool(
  userId: string,
  name: string,
  args: Record<string, unknown>,
  ctx?: ToolContext
): Promise<ToolActionResult> {
  const tool = TOOL_ENTRIES.find((t) => t.definition.function.name === name);
  if (!tool) {
    return {
      writes: false,
      result: JSON.stringify({ error: `未知工具: ${name}` }),
    };
  }
  try {
    return await tool.executor(userId, args, ctx);
  } catch (err) {
    return {
      writes: tool.definition.function.name.startsWith("create_") || tool.definition.function.name.startsWith("toggle_") || tool.definition.function.name.startsWith("update_"),
      result: JSON.stringify({
        error: `工具执行失败: ${err instanceof Error ? err.message : String(err)}`,
      }),
    };
  }
}
