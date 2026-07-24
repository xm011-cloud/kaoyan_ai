// 统一的认证/存储服务配置
// MemFire Cloud 优先，未配则回退到 Supabase
// MemFire Cloud 和 Supabase 使用相同的 SDK（@supabase/ssr + @supabase/supabase-js）
// 只需换不同的 URL 和 Key

/**
 * 标准化数据库连接字符串中的 sslmode。
 * pg-connection-string v2 将 prefer/require/verify-ca 视为 verify-full，
 * pg v9 起将改为标准 libpq 语义（弱安全）。这里显式设为 verify-full 避免警告。
 */
function normalizeDatabaseUrl(url: string): string {
  if (!url) return url;
  return url.replace(
    /([?&])sslmode=(prefer|require|verify-ca)(&|$)/gi,
    "$1sslmode=verify-full$3"
  );
}

function getDatabaseUrl(): string {
  const raw = process.env.MEMFIRE_DATABASE_URL || process.env.DATABASE_URL || "";
  return normalizeDatabaseUrl(raw);
}

export const envConfig = {
  // 认证服务（客户端）
  projectUrl:
    process.env.NEXT_PUBLIC_MEMFIRE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    "",
  anonKey:
    process.env.NEXT_PUBLIC_MEMFIRE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    "",
  // 服务端（service_role key，仅服务端使用）
  serviceRoleKey:
    process.env.MEMFIRE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    "",
  // 数据库连接
  databaseUrl: getDatabaseUrl(),
  // 启用的服务标识
  provider: process.env.NEXT_PUBLIC_MEMFIRE_URL ? "memfire" as const : "supabase" as const,
} as const;
