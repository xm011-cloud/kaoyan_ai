// Node ESM resolve hook：把 `@/lib/x` 解析到 `src/lib/x.ts`（Node 24 类型剥离可直接跑 TS）。
// 注意: hook 跑在独立线程, 不能在此设 process.env —— 环境预载用 scripts/load-env.mjs(--import 主线程)。
// 用法: node --import ./scripts/load-env.mjs --experimental-loader ./scripts/ts-alias-loader.mjs scripts/seed-admission.mjs
import { fileURLToPath } from "node:url";

const SRC = fileURLToPath(new URL("../src/", import.meta.url));

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    return nextResolve(new URL(`file://${SRC}${specifier.slice(2)}.ts`).href, context);
  }
  return nextResolve(specifier, context);
}
