# 开工测试基线

基线日期：2026-09-02

## 通过结果

| 检查 | 结果 |
| --- | --- |
| `npx tsc --noEmit` | 通过 |
| `npm run lint` | 通过：0 error，82 warnings |
| `npm run build` | 通过：Next.js 16.2.10，86 个页面/路由完成生成 |
| `npx playwright test --workers=1` | 通过：127/127，8.4 分钟 |

ESLint warning 的分类和偿还策略见 [lint-baseline.md](./lint-baseline.md)。

## E2E 并发结论

测试套件共用一个认证账号和同一个 `_test` 数据库。默认 8 worker 的两次全量运行分别得到：

- 124/127，通过用例之外有 3 个失败；
- 120/127，通过用例之外有 7 个失败。

两轮失败项目不一致；对应功能在单 worker 下全部通过，说明主要原因是共享账号、共享测试数据和 Turbopack 冷编译下的并发互扰。为保证本地与 CI 的发布基线一致，`playwright.config.ts` 默认固定为单 worker。

开发时可以显式提高 worker 数量做快速反馈，但该结果不能替代发布基线。

## 已修复的陈旧断言

- 更新日志横幅不再硬编码“开放注册”，而是读取 `CHANGELOG[0].title`。
- 模块联动测试把链接定位限定在“继续学习”卡片内，不再误选隐藏的移动端导航链接。

## 基础设施注意项

- 单 worker 全量运行首次启动时，Neon 曾出现一次 `Connection terminated due to connection timeout`；重试后正常完成。该问题属于外部测试数据库可用性，不是应用用例失败。
- PostgreSQL 驱动会提示未来版本中 `sslmode=require` 等模式的语义变化。项目应用连接已按约定规范化为 `sslmode=verify-full`，测试启动脚本仍需在升级 `pg` 前复核连接串。
