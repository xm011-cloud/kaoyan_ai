// 批量补全院校情报数据：对目标院校×专业 跑「搜索+AI提取+入库」(全局共享)。
// 用法:
//   node --import ./scripts/load-env.mjs --experimental-loader ./scripts/ts-alias-loader.mjs scripts/seed-admission.mjs  # 默认清单(前8个任务)
//   node ... --university 浙大 --major 计算机科学与技术  # 指定单校
//   node ... --major "计算机科学与技术 软件工程" --delay 3000 --limit 5
// 需 env: OPENAI_API_KEY(+BASE_URL/MODEL) 与 TAVILY_API_KEY(见 .env.local)
import dotenv from "dotenv";
dotenv.config({ path: ".env.local", override: true });

import { searchAndSaveAdmission } from "@/lib/admission-seed";

// ── 默认清单：985/211 计算机强校 + 国家线门类 ──
const DEFAULT_SCHOOLS = [
  "浙江大学", "清华大学", "北京大学", "上海交通大学", "复旦大学",
  "南京大学", "中国科学技术大学", "哈尔滨工业大学", "西安交通大学", "华中科技大学",
  "武汉大学", "东南大学", "电子科技大学", "北京邮电大学", "西安电子科技大学",
  "北京航空航天大学", "北京理工大学", "天津大学", "中山大学", "华南理工大学",
];
const DEFAULT_MAJORS = ["计算机科学与技术", "软件工程"];
const NATIONAL_LINES = ["工学", "理学", "经济学", "管理学", "法学"]; // 国家线按学科门类

function parseArgs() {
  const args = process.argv.slice(2);
  const get = (k) => {
    const i = args.indexOf(k);
    return i >= 0 ? args[i + 1] : undefined;
  };
  return {
    university: get("--university"),
    major: get("--major"),
    delay: Number(get("--delay") || 2500),
    limit: Number(get("--limit") || 0),
    national: get("--national") !== "0",
  };
}

const ai = {
  baseURL: process.env.OPENAI_BASE_URL || "https://api.xiaomimimo.com/v1",
  apiKey: process.env.OPENAI_API_KEY || "",
  model: process.env.AI_MODEL || "mimo-v2.5-pro",
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  if (!ai.apiKey) {
    console.error("❌ 缺 OPENAI_API_KEY（.env.local）");
    process.exit(1);
  }
  const o = parseArgs();
  const log = (m) => console.log(m);

  // 任务列表
  const tasks = [];
  if (o.university) {
    const majors = o.major ? o.major.split(/\s+/) : DEFAULT_MAJORS;
    for (const m of majors) tasks.push({ university: o.university, major: m });
  } else {
    for (const u of DEFAULT_SCHOOLS) for (const m of DEFAULT_MAJORS) tasks.push({ university: u, major: m });
  }
  if (o.national) {
    for (const g of NATIONAL_LINES) tasks.push({ university: "国家线", major: g });
  }
  const limited = o.limit ? tasks.slice(0, o.limit) : tasks;
  console.log(`📋 共 ${limited.length} 个任务（先跑 ${Math.min(limited.length, 8)} 个验证，其余可续跑）`);
  log(`ai: ${ai.baseURL} / ${ai.model}`);

  let savedTotal = 0;
  let okCount = 0;
  const runNow = limited.slice(0, o.limit || 8); // 默认先跑前 8 个，避免一次烧完 Tavily 配额
  for (const t of runNow) {
    log(`🔍 ${t.university} ${t.major} …`);
    const res = await searchAndSaveAdmission({ ...t, ai, log });
    savedTotal += res.saved;
    if (res.saved > 0) okCount++;
    if (res.error) log(`  ⚠️ 原因: ${res.error}`);
    await sleep(o.delay);
  }
  console.log(`\n✅ 完成: 本次新增 ${savedTotal} 条（成功任务 ${okCount}/${runNow.length}）`);
  console.log(`  跑剩余: node --import ./scripts/load-env.mjs --experimental-loader ./scripts/ts-alias-loader.mjs scripts/seed-admission.mjs --university 指定校 --major "计算机科学与技术 软件工程"`);
}

main().catch((e) => {
  console.error("脚本失败:", e);
  process.exit(1);
});
