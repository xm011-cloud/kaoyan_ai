import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { requireAdmin } from '@/lib/admin'
import { prisma } from '@/lib/prisma'
import AdminTabs from './_components/admin-tabs'

export const metadata: Metadata = {
  title: '作者后台 · AI 考研助手',
  robots: { index: false, follow: false },
}

// 作者管理后台：登录 + ADMIN_EMAIL 校验（未配置 env 时 fail closed → 无权限）
export default async function AdminPage() {
  const { user, error } = await requireAdmin()
  if (error) {
    if (error.status === 401) redirect('/login')
    // 403：无权限，不泄漏管理 UI
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center px-6 text-center">
        <div className="text-5xl mb-4">🔒</div>
        <h1 className="text-xl font-bold">无权限</h1>
        <p className="text-sm text-muted-foreground mt-2">只有作者本人可以访问管理后台</p>
      </div>
    )
  }

  const [feedbacks, supporters, disputes] = await Promise.all([
    prisma.authorFeedback.findMany({
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { email: true, name: true } } },
    }),
    prisma.supporter.findMany({
      orderBy: [{ approved: 'asc' }, { createdAt: 'desc' }],
      include: { user: { select: { email: true } } },
    }),
    prisma.admissionFeedback.findMany({
      where: { type: 'dispute', status: 'pending' },
      include: {
        admissionInfo: true,
        user: { select: { email: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
  ])

  // 序列化 Date → ISO 字符串（跨 RSC 边界传给 client 组件）
  const feedbackItems = feedbacks.map((f) => ({
    id: f.id,
    rating: f.rating,
    content: f.content,
    anonymous: f.anonymous,
    status: f.status,
    createdAt: f.createdAt.toISOString(),
    user: { email: f.user.email, name: f.user.name },
  }))
  const supporterItems = supporters.map((s) => ({
    id: s.id,
    name: s.name,
    amount: s.amount,
    message: s.message,
    approved: s.approved,
    createdAt: s.createdAt.toISOString(),
    user: s.user ? { email: s.user.email } : null,
  }))
  const disputeItems = disputes.map((d) => ({
    id: d.id,
    reason: d.reason,
    createdAt: d.createdAt.toISOString(),
    userEmail: d.user?.email || '未知',
    admission: {
      id: d.admissionInfo.id,
      university: d.admissionInfo.university,
      major: d.admissionInfo.major,
      year: d.admissionInfo.year,
      category: d.admissionInfo.category,
      data: d.admissionInfo.data as Record<string, unknown>,
      source: d.admissionInfo.source,
      verifyStatus: d.admissionInfo.verifyStatus,
    },
  }))

  const pendingCount = supporterItems.filter((s) => !s.approved).length
  const newFeedbackCount = feedbackItems.filter((f) => f.status === 'new').length
  const disputeCount = disputeItems.length

  return (
    <div className="p-4 lg:p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">作者管理后台</h1>
          <p className="text-sm text-muted-foreground mt-1">{user?.email}</p>
        </div>
        <div className="flex gap-2 text-xs">
          {pendingCount > 0 && (
            <span className="px-2.5 py-1 rounded-full bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300 font-medium">
              待审留言 {pendingCount}
            </span>
          )}
          {newFeedbackCount > 0 && (
            <span className="px-2.5 py-1 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 font-medium">
              新反馈 {newFeedbackCount}
            </span>
          )}
          {disputeCount > 0 && (
            <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 font-medium">
              院校质疑 {disputeCount}
            </span>
          )}
        </div>
      </div>

      <AdminTabs
        initialFeedbacks={feedbackItems}
        initialSupporters={supporterItems}
        initialDisputes={disputeItems}
      />
    </div>
  )
}
