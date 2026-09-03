import { Shell } from "@/components/shell"
import { StudyReminder } from "@/components/study-reminder"
import { PwaInstallPrompt } from "@/components/pwa-install"
import { WeeklyPlanReminder } from "@/components/weekly-plan-reminder"
import { AppProviders } from "@/components/app-providers"
import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { derivePrepStage } from "@/lib/prep-stage"
import type { SubjectProgress } from "@/lib/completion"
import { getDaysToGoal } from "@/lib/goal-model"

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  // Compute days left for TopBar
  let daysLeft = 0
  let daysLabel = ""
  try {
    const [goal, formalStage] = await Promise.all([
      prisma.goal.findUnique({ where: { userId: user.id } }),
      prisma.studyPathStage.findFirst({
        where: { studyPath: { userId: user.id, status: "active" }, status: "active" },
        orderBy: { order: "asc" },
      }),
    ])
    if (goal) {
      const computedDays = getDaysToGoal(goal)
      daysLeft = computedDays ?? 0
      if (formalStage) {
        daysLabel = computedDays == null ? formalStage.title : `${formalStage.title} · ${daysLeft} 天`
      } else try {
        const stage = derivePrepStage({
          examDate: goal.examDate,
          hasGoal: true,
          subjects: goal.subjects,
          subjectProgress: (goal.progress as Record<string, SubjectProgress> | null) || null,
          weeklyHours: (goal.studyLoad as { weeklyHours?: number } | undefined)?.weeklyHours ?? null,
        })
        // 冲刺期显示冲刺；其他阶段显示"阶段 · 距考试 N 天"（长线期不再只有刺眼的倒计时）
        daysLabel = computedDays == null
          ? stage.label
          : stage.id === "sprint" ? `冲刺 · ${daysLeft} 天` : `${stage.label} · ${daysLeft} 天`
      } catch {
        daysLabel = computedDays == null ? "目标探索中" : `距考试 ${daysLeft} 天`
      }
    }
  } catch { /* ignore */ }

  return (
    <AppProviders>
      <Shell daysLeft={daysLeft} daysLabel={daysLabel}>
        {children}
      </Shell>
      <StudyReminder />
      <PwaInstallPrompt />
      <WeeklyPlanReminder />
    </AppProviders>
  )
}
