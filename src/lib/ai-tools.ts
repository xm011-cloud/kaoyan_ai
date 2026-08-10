import { prisma } from "@/lib/prisma";
import { startOfDay, getWeekStart, getWeekEnd, toDateString } from "@/lib/date-utils";
import type { AiTool } from "@/lib/ai-config";

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

interface ToolEntry {
  definition: AiTool;
  executor: (userId: string, args: Record<string, unknown>) => Promise<ToolActionResult>;
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
      const today = startOfDay(new Date());
      const daysRemaining = Math.max(1, Math.ceil((goal.examDate.getTime() - today.getTime()) / 86400000));
      return {
        writes: false,
        result: JSON.stringify({
          hasGoal: true,
          university: goal.university,
          major: goal.major,
          examDate: toDateString(goal.examDate),
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
        name: "create_task",
        description: "创建一个新的学习任务。当用户要求'帮我添加任务'、'安排一个'、'创建一个任务'、'提醒我'等时使用。",
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
];

// ── 公开 API ──

/** 获取所有工具定义（传给 AI API 的 tools 参数） */
export function getToolDefinitions(): AiTool[] {
  return TOOL_ENTRIES.map((t) => t.definition);
}

/** 根据工具名查找并执行 */
export async function executeTool(
  userId: string,
  name: string,
  args: Record<string, unknown>
): Promise<ToolActionResult> {
  const tool = TOOL_ENTRIES.find((t) => t.definition.function.name === name);
  if (!tool) {
    return {
      writes: false,
      result: JSON.stringify({ error: `未知工具: ${name}` }),
    };
  }
  try {
    return await tool.executor(userId, args);
  } catch (err) {
    return {
      writes: tool.definition.function.name.startsWith("create_") || tool.definition.function.name.startsWith("toggle_") || tool.definition.function.name.startsWith("update_"),
      result: JSON.stringify({
        error: `工具执行失败: ${err instanceof Error ? err.message : String(err)}`,
      }),
    };
  }
}
