"use client";

import { Button } from "@/components/ui/button";

interface SessionCreatorProps {
  subjects: string[];
  createType: "daily" | "mock";
  createSubject: string;
  createDuration: number;
  creating: boolean;
  onTypeChange: (type: "daily" | "mock") => void;
  onSubjectChange: (subject: string) => void;
  onDurationChange: (duration: number) => void;
  onCreate: () => void;
}

export function SessionCreator({
  subjects,
  createType,
  createSubject,
  createDuration,
  creating,
  onTypeChange,
  onSubjectChange,
  onDurationChange,
  onCreate,
}: SessionCreatorProps) {
  return (
    <>
      {/* Type cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div
          className={`p-5 rounded-xl border-2 cursor-pointer transition-all ${
            createType === "daily"
              ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
              : "border-gray-200 dark:border-gray-700 hover:border-blue-300"
          }`}
          onClick={() => onTypeChange("daily")}
        >
          <div className="text-3xl mb-2">📝</div>
          <h3 className="font-bold text-lg">每日一练</h3>
          <p className="text-sm text-gray-500 mt-1">
            每天 5 道题，巩固知识点，保持学习节奏
          </p>
        </div>

        <div
          className={`p-5 rounded-xl border-2 cursor-pointer transition-all ${
            createType === "mock"
              ? "border-purple-500 bg-purple-50 dark:bg-purple-900/20"
              : "border-gray-200 dark:border-gray-700 hover:border-purple-300"
          }`}
          onClick={() => onTypeChange("mock")}
        >
          <div className="text-3xl mb-2">⏱️</div>
          <h3 className="font-bold text-lg">模拟考试</h3>
          <p className="text-sm text-gray-500 mt-1">
            完整模拟考试，计时作答，检验真实水平
          </p>
        </div>
      </div>

      {/* Config row */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border p-5 space-y-4">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[150px]">
            <label className="block text-sm font-medium mb-1">科目</label>
            <select
              value={createSubject}
              onChange={(e) => onSubjectChange(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm dark:bg-gray-900 dark:border-gray-700"
            >
              {subjects.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
              {subjects.length === 0 && (
                <option value="">请先设置考研目标</option>
              )}
            </select>
          </div>

          {createType === "mock" && (
            <div className="w-32">
              <label className="block text-sm font-medium mb-1">考试时长（分钟）</label>
              <input
                type="number"
                value={createDuration}
                onChange={(e) => onDurationChange(parseInt(e.target.value) || 180)}
                min={30}
                max={360}
                className="w-full border rounded-lg px-3 py-2 text-sm dark:bg-gray-900 dark:border-gray-700"
              />
            </div>
          )}

          <Button
            onClick={onCreate}
            disabled={creating || !createSubject}
            className={createType === "mock" ? "bg-purple-600 hover:bg-purple-700" : ""}
          >
            {creating
              ? "生成题目中..."
              : createType === "daily"
              ? "开始练习 ✏️"
              : "开始考试 ⏱️"}
          </Button>
        </div>
      </div>
    </>
  );
}
