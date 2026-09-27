/**
 * 外部学习入口只接受 http(s) 链接。粘贴 B 站短链等省略协议的常见写法时，
 * 自动补全 https，避免用户以为链接已保存却无法在学习现场打开。
 */
export function normalizeExternalUrl(value: unknown, limit = 2000): string | null {
  const raw = typeof value === "string" ? value.trim().slice(0, limit) : "";
  if (!raw) return null;

  // 仅为看起来像域名的输入补协议；课程标题或 BV 号不会被误当成 URL。
  const candidate = /^[a-z][a-z\d+.-]*:/i.test(raw)
    ? raw
    : /^[^\s/.]+(?:\.[^\s/]+)+(?:\/|$)/.test(raw)
      ? `https://${raw}`
      : raw;

  try {
    const parsed = new URL(candidate);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}
