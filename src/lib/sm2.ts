/**
 * SM-2 间隔重复算法
 *
 * 基于 SuperMemo SM-2 算法，用于错题复习调度。
 * 参考: https://www.supermemo.com/en/archives1990-2015/english/ol/sm2
 */

export interface SM2Input {
  quality: number // 0-5: 自我评分
  repetitions: number // 之前成功复习次数
  easeFactor: number // 简易度因子（默认 2.5）
  interval: number // 上次间隔天数
}

export interface SM2Output {
  repetitions: number
  easeFactor: number
  interval: number // 下次间隔天数
  nextReviewDate: Date
}

/**
 * 质量评分指南:
 * 0 - 完全不会
 * 1 - 答错，但看到答案后能理解
 * 2 - 答错，但感觉答案很熟悉
 * 3 - 答对，但很困难
 * 4 - 答对，稍有犹豫
 * 5 - 完全掌握，轻松答对
 */

export function sm2(input: SM2Input): SM2Output {
  const { quality, repetitions, easeFactor: prevEF, interval: prevInterval } = input

  // Clamp quality
  const q = Math.max(0, Math.min(5, Math.round(quality)))

  let newRepetitions: number
  let newInterval: number
  let newEF: number

  if (q >= 3) {
    // Successful recall
    if (repetitions === 0) {
      newInterval = 1
    } else if (repetitions === 1) {
      newInterval = 6
    } else {
      newInterval = Math.round(prevInterval * prevEF)
    }
    newRepetitions = repetitions + 1
  } else {
    // Failed recall — reset
    newRepetitions = 0
    newInterval = 1
  }

  // Update ease factor
  newEF = prevEF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
  if (newEF < 1.3) newEF = 1.3

  // Calculate next review date
  const nextDate = new Date()
  nextDate.setDate(nextDate.getDate() + newInterval)
  nextDate.setHours(0, 0, 0, 0)

  return {
    repetitions: newRepetitions,
    easeFactor: Math.round(newEF * 100) / 100,
    interval: newInterval,
    nextReviewDate: nextDate,
  }
}

/**
 * 从答对/答错简化为 quality 评分
 */
export function answerToQuality(
  isCorrect: boolean,
  hesitation: 'none' | 'slight' | 'serious' = 'none'
): number {
  if (!isCorrect) return 1 // 答错，看到答案能理解
  if (hesitation === 'serious') return 3
  if (hesitation === 'slight') return 4
  return 5 // 完全掌握
}

/**
 * 计算到期复习的题目数量（用于仪表盘显示）
 */
export function getDueCount(
  questions: { nextReviewDate?: Date | string | null; reviewed?: boolean }[]
): number {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  return questions.filter((q) => {
    if (q.reviewed) return false
    if (!q.nextReviewDate) return true // 未排期的也到期
    return new Date(q.nextReviewDate) <= now
  }).length
}
