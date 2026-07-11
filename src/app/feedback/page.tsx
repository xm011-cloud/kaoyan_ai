import { Button } from '@/components/ui/button'

export default function FeedbackPage() {
  // 示例数据
  const feedbacks = [
    {
      id: '1',
      week: '2026年7月7日 - 7月13日',
      summary: '本周学习时长 12 小时，完成任务 28/35 个',
      suggestions: [
        '数学进度良好，建议继续保持每天 2 小时的练习',
        '英语单词背诵可以增加到每天 50 个',
        '政治可以开始系统复习，建议每天 1 小时',
      ],
    },
  ]

  return (
    <div className="flex flex-1 flex-col p-6">
      <div className="max-w-2xl mx-auto w-full space-y-6">
        <div>
          <h1 className="text-2xl font-bold">学习反馈</h1>
          <p className="text-gray-500 mt-1">AI 基于你的学习数据生成的建议</p>
        </div>

        <div className="space-y-6">
          {feedbacks.map((feedback) => (
            <div
              key={feedback.id}
              className="bg-white dark:bg-gray-800 p-6 rounded-lg border space-y-4"
            >
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">{feedback.week}</h2>
                <Button variant="outline" size="sm">查看详情</Button>
              </div>

              <p className="text-gray-600 dark:text-gray-400">{feedback.summary}</p>

              <div className="space-y-2">
                <h3 className="font-medium text-sm">AI 建议：</h3>
                <ul className="space-y-2">
                  {feedback.suggestions.map((suggestion, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm">
                      <span className="text-blue-500 mt-0.5">•</span>
                      <span>{suggestion}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}

          {feedbacks.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <div className="text-4xl mb-3">📊</div>
              <p>暂无学习反馈</p>
              <p className="text-sm">完成一周的学习后，AI 将为你生成学习建议</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
