import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// React 19 / Next 16 启用的 Compiler 规则发现了大量存量模式。
// 仅对当前已有债务的文件降为 warning；新文件仍沿用上游 error 级别。
const legacyReactCompilerFiles = [
  "src/app/(authenticated)/admission/page.tsx",
  "src/app/(authenticated)/chat/page.tsx",
  "src/app/(authenticated)/feedback/page.tsx",
  "src/app/(authenticated)/goal/page.tsx",
  "src/app/(authenticated)/knowledge-graph/knowledge-graph-client.tsx",
  "src/app/(authenticated)/layout.tsx",
  "src/app/(authenticated)/leaderboard/page.tsx",
  "src/app/(authenticated)/materials/page.tsx",
  "src/app/(authenticated)/pomodoro/page.tsx",
  "src/app/(authenticated)/practice/page.tsx",
  "src/app/(authenticated)/profile/page.tsx",
  "src/app/(authenticated)/settings/page.tsx",
  "src/app/(authenticated)/skills/page.tsx",
  "src/app/(authenticated)/study-path/page.tsx",
  "src/app/(authenticated)/tasks/page.tsx",
  "src/app/(authenticated)/user/[[]id[]]/page.tsx",
  "src/app/(authenticated)/wrong-questions/_components/exam-questions-tab.tsx",
  "src/app/login/page.tsx",
  "src/components/ai-floating.tsx",
  "src/components/changelog-banner.tsx",
  "src/components/header.tsx",
  "src/components/offline-banner.tsx",
  "src/components/pomodoro-history.tsx",
  "src/components/pwa-install.tsx",
  "src/components/weekly-plan-reminder.tsx",
];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: legacyReactCompilerFiles,
    rules: {
      "react-hooks/immutability": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/set-state-in-effect": "warn",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // 独立的 Apple HIG 参考资源，不属于 C6 应用源码。
    "Apple-Hig-Designer-main/**",
  ]),
]);

export default eslintConfig;
