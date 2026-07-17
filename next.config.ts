import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "@prisma/client",
    "@prisma/adapter-pg",
    "pg",
    "pg-native",
    "pg-connection-string",
    "react-markdown",
    "remark-gfm",
    "remark-parse",
  ],
};

export default nextConfig;
