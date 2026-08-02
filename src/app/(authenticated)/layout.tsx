import { Sidebar } from "@/components/sidebar"
import { StudyReminder } from "@/components/study-reminder"
import { PwaInstallPrompt } from "@/components/pwa-install"
import { ActivityBar } from "@/components/activity-bar"
import { AppProviders } from "@/components/app-providers"
import { createClient } from "@/lib/supabase/server"
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

  return (
    <AppProviders>
      <div className="min-h-screen flex flex-col lg:flex-row">
        <Sidebar />
        {/* Main area: content + activity bar */}
        <div className="flex-1 flex flex-col min-h-0 lg:ml-56">
          <main className="flex-1 overflow-y-auto pb-14 lg:pb-0">
            {children}
          </main>
          <ActivityBar />
        </div>
        <StudyReminder />
        <PwaInstallPrompt />
      </div>
    </AppProviders>
  )
}
