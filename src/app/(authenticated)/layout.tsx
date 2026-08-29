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
    const goal = await prisma.goal.findUnique({ where: { userId: user.id } })
    if (goal) {
      daysLeft = Math.max(0, Math.ceil((new Date(goal.examDate).getTime() - Date.now()) / 86400000)) || 0
      try {
        const stage = derivePrepStage({
          examDate: goal.examDate,
          hasGoal: true,
          subjects: goal.subjects,
          subjectProgress: (goal.progress as Record<string, SubjectProgress> | null) || null,
          weeklyHours: (goal.studyLoad as { weeklyHours?: number } | undefined)?.weeklyHours ?? null,
        })
        // 冲刺期显示冲刺；其他阶段显示"阶段 · 距考试 N 天"（长线期不再只有刺眼的倒计时）
        daysLabel = stage.id === "sprint" ? `冲刺 · ${daysLeft} 天` : `${stage.label} · ${daysLeft} 天`
      } catch {
        daysLabel = `距考试 ${daysLeft} 天`
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
