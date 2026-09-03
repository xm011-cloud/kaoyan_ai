# ESLint 历史基线

基线日期：2026-09-01

## 当前结果

- `npm run lint -- --quiet`：通过，0 error。
- `npm run lint`：0 error，82 warnings。
- `Apple-Hig-Designer-main/**` 是独立参考资源，不属于 C6 应用源码，已从项目 Lint 范围排除。

Warning 分布：

| 规则 | 数量 |
| --- | ---: |
| `react-hooks/set-state-in-effect` | 30 |
| `@typescript-eslint/no-unused-vars` | 26 |
| `react-hooks/exhaustive-deps` | 12 |
| `react-hooks/refs` | 5 |
| `@next/next/no-img-element` | 3 |
| 无规则 ID 的 ESLint 提示 | 2 |
| `react-hooks/preserve-manual-memoization` | 2 |
| `react-hooks/immutability` | 1 |
| `react-hooks/purity` | 1 |

## 基线策略

React 19 / Next.js 16 的 Compiler 规则将一批既有 Hook 模式升级为 error。为避免在没有逐页回归测试的情况下重写二十多个页面，`eslint.config.mjs` 只对当前已命中的文件把以下规则降为 warning：

- `react-hooks/set-state-in-effect`
- `react-hooks/refs`
- `react-hooks/purity`
- `react-hooks/immutability`
- `react-hooks/preserve-manual-memoization`

未列入基线的新文件仍使用 Next.js 上游 error 级别。不要为了让 Lint 通过而扩大遗留文件列表；新增命中必须修复，或在任务中记录明确理由。

## 偿还顺序

1. 优先处理 `refs`、`immutability`、`purity`，这些规则更可能暴露真实的渲染一致性问题。
2. 按页面逐步改造 `set-state-in-effect`，每次配套运行对应 Playwright 流程。
3. 清理未使用变量和 Hook 依赖，降低噪音。
4. 对用户内容图片保留必要的原生 `img`；普通静态图片迁移到 `next/image`。

## 门禁规则

- ESLint error 数量必须保持为 0。
- Warning 总数不得高于本基线；减少 warning 后同步更新本文件。
- 发布候选必须运行完整 `npm run lint`，不能只运行 `--quiet`。
