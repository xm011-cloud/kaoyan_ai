# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

完整项目指南见 [AGENTS.md](./AGENTS.md)（本文件是其入口，`@` 引用即自动载入）。

入口速览：

- **启动/测试/构建**：`npm run dev` · `npx tsc --noEmit` · `npm run lint` · `npx playwright test` · `npm run build`（详见 AGENTS.md「项目启动」）
- **这不是你熟悉的 Next.js**：版本有破坏性变更，写码前先读 `node_modules/next/dist/docs/` 对应指南
- **数据层**：Prisma driver adapter（`@prisma/adapter-pg`）；API 取用户用 `src/lib/api-auth.ts` 的 `getAuthUser`
- **阶段/完成度**（跨页面核心逻辑）：`src/lib/prep-stage.ts` + `src/lib/completion.ts`
- **方向决策**：写新功能前先看 `docs/architecture-decisions.md`（ADR，D1-D6 + 分阶段路线）
