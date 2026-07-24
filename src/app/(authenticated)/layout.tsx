import { Sidebar } from "@/components/sidebar"
import { StudyReminder } from "@/components/study-reminder"
import { PwaInstallPrompt } from "@/components/pwa-install"
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
      <div className="min-h-screen lg:flex">
        <Sidebar />
        <main className="flex-1 lg:ml-56 pb-14 lg:pb-0 overflow-y-auto">
          {children}
        </main>
        <StudyReminder />
        <PwaInstallPrompt />
      </div>
    </AppProviders>
  )
}
