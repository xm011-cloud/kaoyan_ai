"use client";

interface CompareSchool {
  university: string;
  major: string;
  year: number;
  scores: Record<string, number>;
  enrollmentQuota?: number;
  subjects?: string[];
}

interface Analysis {
  matchRate?: number;
  gap?: Record<string, number>;
  strengths?: string[];
  weaknesses?: string[];
  suggestions?: string[];
  summary?: string;
}

interface AdmissionCompareProps {
  schools: CompareSchool[];
  analysis: Analysis | null;
  loading: boolean;
  onRemove: (index: number) => void;
  onAnalyze: () => void;
}

export function AdmissionCompare({
  schools,
  analysis,
  loading,
  onRemove,
  onAnalyze,
}: AdmissionCompareProps) {
  if (schools.length === 0) {
    return (
      <div className="text-center py-10 text-gray-500">
        <div className="text-4xl mb-3">📊</div>
        <p>还没有选择对比的院校</p>
        <p className="text-sm">在搜索 Tab 中搜索并保存院校数据</p>
      </div>
    );
  }

  // Collect all subject keys
  const allSubjects = new Set<string>();
  for (const s of schools) {
    Object.keys(s.scores).forEach((k) => allSubjects.add(k));
  }

  return (
    <div className="space-y-4">
      {/* Comparison table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-border/50">
              <th className="text-left py-2 px-3 font-medium">院校</th>
              <th className="text-left py-2 px-3 font-medium">专业</th>
              <th className="text-left py-2 px-3 font-medium">年份</th>
              {[...allSubjects].map((subj) => (
                <th
                  key={subj}
                  className="text-center py-2 px-3 font-medium"
                >
                  {subj}
                </th>
              ))}
              <th className="text-center py-2 px-3 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {schools.map((s, i) => (
              <tr
                key={i}
                className="border-b border-border/50 hover:bg-muted/50"
              >
                <td className="py-2 px-3 font-medium">{s.university}</td>
                <td className="py-2 px-3 text-gray-600 dark:text-gray-400">
                  {s.major}
                </td>
                <td className="py-2 px-3">{s.year}</td>
                {[...allSubjects].map((subj) => (
                  <td key={subj} className="text-center py-2 px-3">
                    {s.scores[subj] !== undefined
                      ? `${s.scores[subj]}分`
                      : "-"}
                  </td>
                ))}
                <td className="text-center py-2 px-3">
                  <button
                    onClick={() => onRemove(i)}
                    className="text-red-500 hover:text-red-700 text-xs"
                  >
                    移除
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Analyze button */}
      <button
        onClick={onAnalyze}
        disabled={loading || schools.length < 1}
        className="w-full py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors text-sm font-medium"
      >
        {loading ? "分析中..." : "🤖 AI 分析匹配度"}
      </button>

      {/* Analysis result */}
      {analysis && analysis.summary && (
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800 p-5 space-y-4">
          {/* Match rate */}
          {analysis.matchRate !== undefined && (
            <div className="flex items-center gap-3">
              <div className="text-3xl font-bold text-blue-600">
                {analysis.matchRate}%
              </div>
              <div className="text-sm text-gray-500">综合匹配度</div>
            </div>
          )}

          {/* Summary */}
          <p className="text-sm">{analysis.summary}</p>

          {/* Gap */}
          {analysis.gap && Object.keys(analysis.gap).length > 0 && (
            <div>
              <h4 className="text-sm font-medium mb-2">分数差距</h4>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(analysis.gap).map(([subj, diff]) => (
                  <div
                    key={subj}
                    className={`text-xs px-2.5 py-1.5 rounded ${
                      diff >= 0
                        ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                        : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                    }`}
                  >
                    {subj}: {diff >= 0 ? "+" : ""}
                    {diff} 分
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Strengths & Weaknesses */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {analysis.strengths && analysis.strengths.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-1 text-green-600">
                  ✅ 优势
                </h4>
                <ul className="text-xs space-y-1">
                  {analysis.strengths.map((s, i) => (
                    <li key={i} className="text-gray-600 dark:text-gray-400">
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {analysis.weaknesses && analysis.weaknesses.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-1 text-red-600">
                  ⚠️ 薄弱环节
                </h4>
                <ul className="text-xs space-y-1">
                  {analysis.weaknesses.map((w, i) => (
                    <li key={i} className="text-gray-600 dark:text-gray-400">
                      {w}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Suggestions */}
          {analysis.suggestions && analysis.suggestions.length > 0 && (
            <div>
              <h4 className="text-sm font-medium mb-1">💡 建议</h4>
              <ul className="text-xs space-y-1">
                {analysis.suggestions.map((s, i) => (
                  <li
                    key={i}
                    className="text-gray-600 dark:text-gray-400 flex gap-1"
                  >
                    <span>{i + 1}.</span>
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
