import type { Metadata } from 'next'
import SupportClient from './_components/support-client'

export const metadata: Metadata = {
  title: '支持作者 · AI 考研助手',
  description: '请作者喝一杯咖啡，支持独立开发者的持续创作',
}

// 公开页：感谢墙 + 收款码 + 留言（审核后展示）
export default function SupportPage() {
  return <SupportClient />
}
