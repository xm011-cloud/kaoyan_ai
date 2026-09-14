import pg from "pg";

/**
 * E2E 的结构性断言偶尔需要直接读写测试库。应用本身已在测试时走 Neon
 * pooler；这里必须与之保持一致，不能再对直连端点开启额外的短连接。
 */
export function testDatabaseUrl(): string {
  const source =
    process.env.MEMFIRE_DATABASE_URL || process.env.DATABASE_URL || "";
  if (!source) return source;

  const parsed = new URL(source);
  parsed.pathname = `${parsed.pathname}_test`;

  const hostParts = parsed.hostname.split(".");
  if (
    parsed.hostname.endsWith(".neon.tech") &&
    hostParts.length > 0 &&
    !hostParts[0].endsWith("-pooler")
  ) {
    hostParts[0] = `${hostParts[0]}-pooler`;
    parsed.hostname = hostParts.join(".");
  }

  return parsed.toString();
}

type TestDbPool = {
  query<T extends pg.QueryResultRow = pg.QueryResultRow>(
    queryText: string,
    values?: unknown[],
  ): Promise<pg.QueryResult<T>>;
  end(): Promise<void>;
};

const RETRY_DELAYS = [0, 1_500, 4_000];

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTransientConnectionError(error: unknown) {
  const candidate = error as { code?: unknown; message?: unknown };
  const code = typeof candidate?.code === "string" ? candidate.code : "";
  if (["ECONNRESET", "ECONNREFUSED", "ETIMEDOUT", "EPIPE", "57P01", "57P02", "57P03"].includes(code)) {
    return true;
  }
  return /connection terminated|connection timeout|network|socket hang up|connect ETIMEDOUT/i.test(
    String(candidate?.message || ""),
  );
}

function canSafelyRetry(queryText: string) {
  return /^\s*(SELECT|UPDATE|DELETE)\b/i.test(queryText);
}

function buildPool() {
  return new pg.Pool({
    connectionString: testDatabaseUrl(),
    max: 1,
    connectionTimeoutMillis: 30_000,
    idleTimeoutMillis: 5_000,
    keepAlive: true,
  });
}

export function createTestDbPool() {
  let pool = buildPool();

  return {
    async query<T extends pg.QueryResultRow = pg.QueryResultRow>(queryText: string, values?: unknown[]) {
      let lastError: unknown;
      for (let attempt = 0; attempt < RETRY_DELAYS.length; attempt += 1) {
        if (attempt > 0) await wait(RETRY_DELAYS[attempt]);
        try {
          return await pool.query<T>(queryText, values as unknown[]);
        } catch (error) {
          lastError = error;
          if (!isTransientConnectionError(error) || !canSafelyRetry(queryText)) throw error;
          await pool.end().catch(() => undefined);
          pool = buildPool();
        }
      }
      throw lastError;
    },
    async end() {
      await pool.end();
    },
  } satisfies TestDbPool;
}
