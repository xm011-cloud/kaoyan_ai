import { Shell } from "@/components/shell"
import { StudyReminder } from "@/components/study-reminder"
import { PwaInstallPrompt } from "@/components/pwa-install"
import { AppProviders } from "@/components/app-providers"
import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"

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
  try {
    const goal = await prisma.goal.findUnique({ where: { userId: user.id } })
    if (goal) {
      daysLeft = Math.max(0, Math.ceil((new Date(goal.examDate).getTime() - Date.now()) / 86400000)) || 0
    }
  } catch { /* ignore */ }

  return (
    <AppProviders>
      <Shell daysLeft={daysLeft}>
        {children}
      </Shell>
      <StudyReminder />
      <PwaInstallPrompt />
    </AppProviders>
  )
}
