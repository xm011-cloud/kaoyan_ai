# 学习计划领域契约

> V1 地基（2026-09-02）。迁移期间旧字段可以继续读取，但不得发展新的平行口径。

## 核心原则

1. 目标不完整也能开始；未知信息显式标记，AI 不得静默补全。
2. 用户陈述、AI 推断与系统观测是不同证据，保留来源、可信度和有效时间。
3. `StudyPath` 是唯一长期路线主体，不新增与它竞争的 `StudyPlan`。
4. 已确认路线决定正式阶段；`derivePrepStage()` 只用于无路线时的初始建议与偏差提醒。
5. `WeeklyPlan` 是长期路线的执行切片，`Task` 是最小行动。
6. AI 只生成草稿或变更提案；确认前不覆盖激活计划、不创建正式任务。
7. 已完成、进行中和手动记录不因重新生成而自动删除。

## 统一术语

| 概念 | 责任 | 唯一真相源 |
|---|---|---|
| Goal | 用户想去哪里，允许不确定 | Goal |
| StudyProfile | 当前情况、约束、偏好和带证据事实 | 结构化档案 |
| StudyPath | 经确认的长期路线及版本 | StudyPath |
| StudyPathStage | 正式阶段、目标和退出标准 | 路线阶段 |
| Milestone | 阶段内可验证成果 | StudyPathMilestone |
| WeeklyPlan | 一周内对阶段目标的执行方案 | WeeklyPlan |
| Task | 可直接开始或完成的最小行动 | Task |

## 生命周期

- Goal：`exploring → tentative → confirmed → paused`，允许从暂停恢复或将确认目标降回暂定。
- StudyPath：`draft → active → paused/completed/superseded`。同一目标最多一个 active 版本。
- StudyPathStage：`pending → active → completed/skipped`。同一路线最多一个 active 阶段。
- WeeklyPlan：`draft → active → completed/archived`。同一自然周最多一个 active 版本。
- Task：`planned → in_progress → completed/deferred/cancelled`；迁移期兼容 `completed: Boolean`。

## 目标不确定性

Goal 的院校、专业、考试日期允许为空，不能用占位字符串伪装已知值。不完整目标进入“目标探索与基础启动”，先完成考试范围调研、水平扫描、容量校准和低后悔成本的公共基础学习。条件分支可以进入路线草稿，只有确认分支能产生长期刚性里程碑。

## 档案与长期记忆

档案事实至少包含 `key`、`value`、`source`、`confidence`、`status`、`observedAt`，可选 `reviewAt` 和 `supersededBy`。

- 来源：`user_statement`、`self_assessment`、`assessment`、`behavior`、`ai_inference`。
- 状态：`proposed`、`confirmed`、`superseded`、`expired`、`rejected`。
- AI 推断永远不能伪装成用户确认。
- 动态事实必须复核；“网络未学”在完成对应阶段后由新事实替代。
- “长期保存”不等于“允许外发”：含成绩、薄弱项等档案默认只在服务端本地规则中使用；发送给外部 AI 必须另有明确授权。
- 用户可以撤回当前事实；撤回后标记 rejected 并停止参与规划，历史版本保留用于审计和数据导出。

## 阶段判定优先级

1. active StudyPath 的 active Stage；
2. 依据路线顺序、日期与退出标准选出的候选阶段；
3. 无 active 路线时使用 `derivePrepStage()` 建议；
4. 旧 Task.phase 只用于历史展示。

任务页不得再维护独立的固定比例阶段时间轴。

## 变更安全规则

- 今日调整只影响未开始的当天任务。
- 本周调整只影响 active 周计划内未开始任务。
- 路线调整创建新草稿版本，展示影响后确认。
- 目标或档案变化先产生影响分析，再修改正式路线。
- 所有确认接口必须幂等。

## 工作台边界

工作台只展示统一计划投影，不计算另一套计划：目标卡展示确定程度，阶段卡展示目标与退出标准，本周卡展示依据与容量，今日卡提供直接行动。插件动作必须来自平台白名单。
