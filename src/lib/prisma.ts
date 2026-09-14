import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { envConfig } from "@/lib/env-config";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  // E2E 使用 Neon pooler，首页/路线页会并发发出多组查询。
  // 保持小池以避免短时建连风暴，同时保留足够并发，避免单连接排队超过请求超时；
  // 生产环境保持既有的默认池大小与行为不变。
  const isE2ETest = process.env.E2E_TEST_MODE === "1";
  const pool = new Pool({
    connectionString: envConfig.databaseUrl,
    ...(isE2ETest
      ? {
          max: 3,
          connectionTimeoutMillis: 30_000,
          idleTimeoutMillis: 5_000,
          keepAlive: true,
        }
      : {}),
  });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
