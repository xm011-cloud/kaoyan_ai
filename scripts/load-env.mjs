// 主线程环境预载：在入口模块 import 之前设好 DATABASE_URL 等（--import 在主线程跑）。
// 必须在 @prisma import 链前执行，否则会读到 .env 的占位 host。
// 用法: node --import ./scripts/load-env.mjs --experimental-loader ./scripts/ts-alias-loader.mjs scripts/seed-admission.mjs
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
dotenv.config({ path: fileURLToPath(new URL("../.env.local", import.meta.url)), override: true });
