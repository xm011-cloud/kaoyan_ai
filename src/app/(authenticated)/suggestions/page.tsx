import type { Metadata } from 'next'
import SuggestionsClient from './_components/suggestions-client'

export const metadata: Metadata = {
  title: '意见反馈 · AI 考研助手',
  description: '给作者评分、提意见，帮助我把 AI 考研助手做得更好',
}

// 需登录：proxy 已保护（未登录 → /login），(authenticated)/layout 二次保护
export default function SuggestionsPage() {
  return <SuggestionsClient />
}
