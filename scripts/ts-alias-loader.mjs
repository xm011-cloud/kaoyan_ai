// Node ESM resolve hook：把 `@/lib/x` 解析到 `src/lib/x.ts`（Node 24 类型剥离可直接跑 TS）。
// 用法: node --experimental-loader ./scripts/ts-alias-loader.mjs scripts/seed-admission.mjs
import { fileURLToPath } from "node:url";

const SRC = fileURLToPath(new URL("../src/", import.meta.url));

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    return nextResolve(new URL(`file://${SRC}${specifier.slice(2)}.ts`).href, context);
  }
  return nextResolve(specifier, context);
}
