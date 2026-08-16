"use client";

import { useState } from "react";
import {
  PRESET_SUBJECTS,
  CUSTOM_SUBJECT_PREFIX,
  isPresetSubject,
  isCustomSubject,
  formatCustomSubjectLabel,
  normalizeSubject,
} from "@/lib/subject-standards";
import {
  MAJOR_SUBJECT_MAP,
  normalizeMajor,
  mergeRecommendedSubjects,
} from "@/lib/major-subject-map";

interface SubjectSelectorProps {
  selected: string[];
  onChange: (subjects: string[]) => void;
  /** 当前填写的目标专业（用于专业→科目推荐） */
  majorValue?: string;
  /** 科目是否被用户手动调整过（是则不再自动覆盖） */
  edited?: boolean;
  /** 用户手动增删科目时回调（置 subjectsEdited） */
  onManualEdit?: () => void;
}

export function SubjectSelector({ selected, onChange, majorValue, edited, onManualEdit }: SubjectSelectorProps) {
  const [customUni, setCustomUni] = useState("");
  const [customSubject, setCustomSubject] = useState("");

  // 专业 → 科目推荐
  const recKey = majorValue ? normalizeMajor(majorValue) : null;
  const rec = recKey ? MAJOR_SUBJECT_MAP[recKey] : null;

  const presetSelected = selected.filter(isPresetSubject);
  const customSelected = selected.filter(isCustomSubject);
  const legacySelected = selected.filter(s => !isPresetSubject(s) && !isCustomSubject(s));

  const togglePreset = (value: string) => {
    if (presetSelected.includes(value)) {
      onChange(selected.filter((s) => s !== value));
    } else {
      onChange([...selected, value]);
    }
    onManualEdit?.();
  };

  const addCustom = () => {
    const uni = customUni.trim();
    const subj = customSubject.trim();
    if (!uni || !subj) return;
    const key = `${CUSTOM_SUBJECT_PREFIX}${uni}-${subj}`;
    const normalized = normalizeSubject(key);
    if (selected.includes(normalized)) return; // 已存在
    onChange([...selected, normalized]);
    setCustomUni("");
    setCustomSubject("");
    onManualEdit?.();
  };

  const removeSubject = (subject: string) => {
    onChange(selected.filter((s) => s !== subject));
    onManualEdit?.();
  };

  /** 应用专业推荐（只增不删，不视为手动调整） */
  const applyRecommended = () => {
    if (!rec) return;
    onChange(mergeRecommendedSubjects(selected, rec.subjects));
  };

  const byCategory = new Map<string, typeof PRESET_SUBJECTS>();
  for (const s of PRESET_SUBJECTS) {
    const arr = byCategory.get(s.category) || [];
    arr.push(s);
    byCategory.set(s.category, arr);
  }

  return (
    <div className="space-y-4">
      {/* 专业 → 科目推荐条 */}
      {rec && recKey && (
        <div className="bg-brand/5 border border-brand/20 rounded-xl p-3 space-y-2">
          <div className="flex items-start gap-2">
            <span className="text-lg leading-none mt-0.5">🏷️</span>
            <div className="text-sm flex-1 min-w-0">
              <p className="font-medium">检测到专业：{recKey}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                推荐科目：{rec.subjects.join(" · ")}
              </p>
              {rec.note && (
                <p className="text-xs text-amber-600 dark:text-amber-500 mt-1">⚠️ {rec.note}</p>
              )}
              {edited && (
                <p className="text-xs text-muted-foreground mt-1">
                  你已手动调整过科目，换专业不会自动覆盖。
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={applyRecommended}
              disabled={!rec}
              className="min-h-9 px-3 text-xs shrink-0 rounded-lg bg-muted hover:bg-muted/80 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              + 应用推荐
            </button>
          </div>
        </div>
      )}

      {/* Preset checkboxes */}
      {Array.from(byCategory.entries()).map(([category, subjects]) => (
        <div key={category}>
          <label className="block text-sm font-medium mb-2 text-gray-500">
            {category}
          </label>
          <div className="flex flex-wrap gap-2">
            {subjects.map((s) => {
              const checked = presetSelected.includes(s.value);
              return (
                <label
                  key={s.value}
                  className={`inline-flex min-h-11 min-w-[44px] items-center justify-center gap-1.5 px-3 py-1.5 rounded-full text-sm border cursor-pointer transition-colors ${
                    checked
                      ? "bg-blue-50 border-blue-300 text-blue-700 dark:bg-blue-900/30 dark:border-blue-600 dark:text-blue-300"
                      : "bg-card border-border/50 text-muted-foreground hover:border-brand/40"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => togglePreset(s.value)}
                    className="sr-only"
                  />
                  {checked && <span className="text-xs">✓</span>}
                  {s.label}
                </label>
              );
            })}
          </div>
        </div>
      ))}

      {/* Custom subject input */}
      <div>
        <label className="block text-sm font-medium mb-2 text-gray-500">
          自主命题科目
        </label>
        <div className="flex flex-wrap gap-2 items-end">
          <input
            type="text"
            value={customUni}
            onChange={(e) => setCustomUni(e.target.value)}
            placeholder="院校名称"
            className="h-11 px-3 text-sm rounded-xl border border-border/50 bg-muted/50 focus:outline-none focus:ring-2 focus:ring-brand/20 w-32"
          />
          <input
            type="text"
            value={customSubject}
            onChange={(e) => setCustomSubject(e.target.value)}
            placeholder="科目名称"
            className="h-11 px-3 text-sm rounded-xl border border-border/50 bg-muted/50 focus:outline-none focus:ring-2 focus:ring-brand/20 flex-1 min-w-[120px]"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addCustom();
              }
            }}
          />
          <button
            type="button"
            onClick={addCustom}
            disabled={!customUni.trim() || !customSubject.trim()}
            className="min-h-11 px-4 text-sm bg-muted rounded-lg hover:bg-muted/80 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            添加
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-1">
          输入院校名称和科目名称，如"北京大学 数据结构与算法"
        </p>
      </div>

      {/* Selected subjects tags */}
      {(presetSelected.length > 0 || customSelected.length > 0 || legacySelected.length > 0) && (
        <div>
          <label className="block text-sm font-medium mb-2 text-gray-500">
            已选科目 ({selected.length})
          </label>
          <div className="flex flex-wrap gap-2">
            {presetSelected.map((s) => (
              <span
                key={s}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-sm bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 rounded-full"
              >
                {s}
                <button
                  type="button"
                  onClick={() => removeSubject(s)}
                  className="flex items-center justify-center p-2 -m-2 text-blue-400 hover:text-blue-600 dark:hover:text-blue-200"
                  title="移除"
                  aria-label={`移除 ${s}`}
                >
                  ×
                </button>
              </span>
            ))}
            {customSelected.map((s) => (
              <span
                key={s}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-sm bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 rounded-full"
              >
                🏫 {formatCustomSubjectLabel(s)}
                <button
                  type="button"
                  onClick={() => removeSubject(s)}
                  className="flex items-center justify-center p-2 -m-2 text-purple-400 hover:text-purple-600 dark:hover:text-purple-200"
                  title="移除"
                  aria-label={`移除 ${formatCustomSubjectLabel(s)}`}
                >
                  ×
                </button>
              </span>
            ))}
            {legacySelected.map((s) => (
              <span
                key={s}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-sm bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 rounded-full"
                title={`旧格式科目，建议删除后重新选择标准化科目`}
              >
                ⚠️ {s}
                <button
                  type="button"
                  onClick={() => removeSubject(s)}
                  className="flex items-center justify-center p-2 -m-2 text-amber-400 hover:text-amber-600 dark:hover:text-amber-200"
                  title="移除旧格式科目"
                  aria-label={`移除 ${s}`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
          {legacySelected.length > 0 && (
            <p className="text-xs text-amber-500 mt-1">
              ⚠️ 黄色标记为旧格式科目，无法匹配统考或自主命题。建议删除后在上方重新选择标准科目。
            </p>
          )}
        </div>
      )}
    </div>
  );
}
