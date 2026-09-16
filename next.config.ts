import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Proxy 在生产构建中需要在编译期识别 E2E 的隔离认证路径。该值只由
  // playwright 的测试服务器命令设置；生产构建始终为空字符串。
  env: {
    E2E_TEST_MODE: process.env.E2E_TEST_MODE ?? "",
  },
  serverExternalPackages: [
    "@prisma/client",
    "@prisma/adapter-pg",
    "pg",
    "pg-native",
    "pg-connection-string",
  ],
  async headers() {
    return [
      {
        // Service Worker 必须用正确的 JS MIME 类型且不能被缓存（否则 SW 更新延迟）
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
        ],
      },
    ];
  },
};

export default nextConfig;
