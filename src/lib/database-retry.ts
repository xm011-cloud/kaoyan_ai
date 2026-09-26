/**
 * 只用于可安全重复的数据库读取。
 *
 * Neon/PgBouncer 在冷连接或空闲连接被回收后，偶发会在首次查询时终止连接。
 * 写操作不能在这里重试（避免重复落库）；读取在短暂退避后重试一次即可让连接池
 * 丢弃坏连接并建立新连接。
 */
const READ_RETRY_DELAYS = [250, 750];

export function isTransientDatabaseError(error: unknown) {
  const candidate = error as { code?: unknown; message?: unknown; cause?: { code?: unknown; message?: unknown } } | null;
  const codes = [candidate?.code, candidate?.cause?.code].filter((value): value is string => typeof value === "string");
  if (codes.some((code) => ["ECONNRESET", "ECONNREFUSED", "ETIMEDOUT", "EPIPE", "57P01", "57P02", "57P03"].includes(code))) {
    return true;
  }

  const message = [candidate?.message, candidate?.cause?.message]
    .filter((value): value is string => typeof value === "string")
    .join(" ");
  return /connection terminated|connection timeout|connection reset|socket hang up|network error/i.test(message);
}

export async function withDatabaseReadRetry<T>(read: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= READ_RETRY_DELAYS.length; attempt += 1) {
    try {
      return await read();
    } catch (error) {
      lastError = error;
      if (!isTransientDatabaseError(error) || attempt === READ_RETRY_DELAYS.length) throw error;
      await new Promise((resolve) => setTimeout(resolve, READ_RETRY_DELAYS[attempt]));
    }
  }
  throw lastError;
}
