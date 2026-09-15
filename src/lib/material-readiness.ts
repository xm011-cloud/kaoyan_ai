/**
 * 判断上传资料能否被当前解析/RAG 管线可靠使用。
 * 这是能力边界，不是对原文件内容质量的判断：扫描 PDF、图片和 Word 仍可由用户查看，
 * 只是当前版本没有可检索文本，AI 不能把它们伪装成依据。
 */
export type MaterialReadiness = "ready" | "unavailable";

const UNAVAILABLE_PREFIXES = [
  "[PDF 未检测到文本内容",
  "[PDF 解析失败",
  "[Word 文件",
  "[图片文件",
];

export function getMaterialReadiness(content: string | null | undefined): MaterialReadiness {
  const value = content?.trim() ?? "";
  // 短资料未必适合作为充分依据，但只要确实有可读取文字，就不应误报为“无法检索”。
  if (value.length < 10) return "unavailable";
  if (UNAVAILABLE_PREFIXES.some((prefix) => value.startsWith(prefix))) return "unavailable";
  // extractText 对未支持的 MIME 也使用 "[xxx 文件]" 占位，不能进入检索或引用。
  if (/^\[[^\]]+文件\]$/.test(value)) return "unavailable";
  return "ready";
}

export function isMaterialSearchable(content: string | null | undefined): boolean {
  return getMaterialReadiness(content) === "ready";
}
