import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { envConfig } from "@/lib/env-config";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  // 运行时统一走 pooler（envConfig 已处理 Neon 直连地址）。保持小池，避免首页
  // 多个并发查询在冷启动时触发大量 TLS 建连；pg 会在连接异常时丢弃坏连接并按需新建。
  const isE2ETest = process.env.E2E_TEST_MODE === "1";
  const pool = new Pool({
    connectionString: envConfig.databaseUrl,
    // 首页会并行读取十余项数据；8 条连接可在 pooler 下分两轮完成，
    // 仍低于 pg 默认的 10 条，避免冷启动时的建连风暴。
    max: isE2ETest ? 3 : 8,
    connectionTimeoutMillis: isE2ETest ? 30_000 : 10_000,
    idleTimeoutMillis: isE2ETest ? 5_000 : 10_000,
    keepAlive: true,
  });
  pool.on("error", (error) => {
    console.error("[prisma] 空闲数据库连接异常，连接池会在下次查询时重建连接", error);
  });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
