import type { Metadata } from 'next'
import SuggestionsClient from './_components/suggestions-client'

export const metadata: Metadata = {
  title: '问题与建议 · AI 考研助手',
  description: '报告产品问题、理解障碍或建议，并查看处理进度',
}

// 需登录：proxy 已保护（未登录 → /login），(authenticated)/layout 二次保护
export default function SuggestionsPage() {
  return <SuggestionsClient />
}
