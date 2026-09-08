'use client'

import { createContext, useContext, useState } from 'react'

export type StudyPageContext =
  | {
      kind: 'course_lesson'
      courseId: string
      lessonId: string
      title: string
      detail: string
      noteCount: number
    }
  | {
      kind: 'weekly_plan'
      weekStart: string
      title: string
      detail: string
    }
  | {
      kind: 'wrong_question'
      wrongQuestionId: string
      title: string
      detail: string
    }
  | {
      kind: 'practice_question'
      sessionId: string
      questionId: string
      title: string
      detail: string
    }
  | {
      kind: 'material'
      materialId: string
      title: string
      detail: string
    }
  | null

interface StudyContextValue {
  context: StudyPageContext
  setContext: (context: StudyPageContext) => void
}

const StudyContext = createContext<StudyContextValue | null>(null)

/** 页面只注册小型、可验证的对象标识；AI 服务端会再次按当前用户校验并读取真实数据。 */
export function StudyContextProvider({ children }: { children: React.ReactNode }) {
  const [context, setContext] = useState<StudyPageContext>(null)
  return <StudyContext.Provider value={{ context, setContext }}>{children}</StudyContext.Provider>
}

export function useStudyContext() {
  const value = useContext(StudyContext)
  if (!value) throw new Error('useStudyContext 必须在 StudyContextProvider 内使用')
  return value
}
