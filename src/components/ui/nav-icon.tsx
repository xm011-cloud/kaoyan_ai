import type { LucideIcon } from 'lucide-react'
import {
  BookOpen, BrainCircuit, CalendarCheck, ChartNoAxesCombined, CheckSquare,
  CircleUserRound, Clock3, FileText, FolderOpen, GraduationCap, House,
  LibraryBig, Map, MessageSquareText, NotebookPen, Settings2, Sparkles,
  Target, Trophy, UploadCloud,
  Wrench,
} from 'lucide-react'

const ICONS: Record<string, LucideIcon> = {
  '/dashboard': House,
  '/checkin': CalendarCheck,
  '/pomodoro': Clock3,
  '/leaderboard': Trophy,
  '/tasks': CheckSquare,
  '/practice': NotebookPen,
  '/wrong-questions': BookOpen,
  '/goal': Target,
  '/chat': MessageSquareText,
  '/feedback': ChartNoAxesCombined,
  '/study-path': Map,
  '/skills': Sparkles,
  '/courses': GraduationCap,
  '/materials': FolderOpen,
  '/knowledge-graph': BrainCircuit,
  '/admission': LibraryBig,
  '/settings': Settings2,
  '/profile': CircleUserRound,
  '/changelog': FileText,
  '/suggestions': UploadCloud,
  '/tools': Wrench,
}

export function NavIcon({ href, className }: { href: string; className?: string }) {
  const Icon = ICONS[href] ?? FileText
  return <Icon aria-hidden="true" className={className} strokeWidth={1.8} />
}
