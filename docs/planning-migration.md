# 学习计划数据迁移方案

> 本文定义迁移顺序，不授权修改生产数据库。

## 当前实施状态（2026-09-03）

- Goal 已支持探索/暂定/确认/暂停及可空目标字段。
- StudyPath 已版本化，新增正式 StudyPathStage 和阶段变更提案。
- WeeklyPlan 已成为独立版本实体，Task 通过 weeklyPlanId 关联活动版本。
- StudyProfileFact 已支持来源、可信度、状态和历史替代关系；分析预览不落库，确认后才写入。
- 周计划和路线都采用“草稿 → 影响分析 → 确认生效”。
- 旧 Task.phase 与无 weeklyPlanId 任务仍兼容读取。
- 历史 weekStartDate 仍可能存在本地周一和旧周日两种口径，暂不删除兼容窗口。

## 迁移顺序

### M1：只增不删

- Goal 核心目标字段改为可空；增加 type、status、direction、examYear、certainty、confirmedAt。
- StudyPath 改为可版本化；增加 goalId、version、status、confirmedAt、supersedesId、adjustmentRequest、changeImpact。
- 新增 StudyPathStage 与 WeeklyPlan。
- Milestone 已增加 stageId；successCriteria/status 延后，继续复用 progress/completedAt。
- Task 已增加 weeklyPlanId；milestoneId/status/actionType/actionPayload/sortOrder 延后。
- 新增 StudyProfileFact；Goal.progress/studyLoad 继续作为科目进度与容量的兼容入口。

### M2：兼容读取

- 旧完整 Goal 读作 confirmed 候选，首次编辑时确认。
- 旧路径按 milestone.phase 生成只读阶段投影。
- 无 WeeklyPlan 的历史 Task 继续按日期展示。
- completed 布尔值映射到新任务状态；旧 phase 只作标签。

### M3：新写路径

- 新路线和周计划先写 draft。
- 确认后事务性切换 active；使用幂等键或唯一约束。
- 替换路线不级联删除历史计划和任务。

### M4：保守回填

只回填可靠数据：同一规范周、同来源的一批旧 AI Task 可形成 archived 周计划；无法可靠归属的任务保持外键为空。不根据标题猜 actionType 或 milestoneId。

已提供 `scripts/backfill-planning.mjs`：

```bash
npm run planning:backfill        # 默认 dry-run，只输出审计数量
npm run planning:backfill:apply  # 必须显式确认，事务性执行
```

回填行为：

- 为没有正式 Stage 的旧 StudyPath 按 milestone.phase 建立阶段并关联 stageId。
- 只将 `source=ai`、具有 weekStartDate、尚未关联 weeklyPlanId 的旧任务归档为 archived WeeklyPlan。
- 旧周日起始会规范到下一天周一；其他日期按所在周周一处理。
- 已完成进度、手动任务、ai_confirmed 任务和无法可靠归属的数据不修改。
- 脚本只插入新实体并填充空外键，失败时整体回滚。

### M5：延后清理

新旧读取稳定、导出完整、E2E 覆盖后，另开任务废弃旧 phase 判断和周起始兼容窗口。

## 日期、发布与回滚

- 业务周使用用户时区的 `YYYY-MM-DD` 周一作为周键。
- 新代码不得直接用 `toISOString()` 推导用户本地日期。
- 先备份，再在独立测试库执行 `prisma db push`、dry-run、apply 和回滚演练；生产库禁止直接试跑。
- 用功能开关逐步开放；回滚时关闭新写入口，旧页面继续读取基础字段。
- 禁止无备份、审计和回滚验证时对生产库执行 `prisma db push`。

StudyPath、WeeklyPlan 和 StudyProfileFact 全版本已纳入用户数据导出；级联注销、私有 API 鉴权和 E2E 已覆盖。漏斗事件仍待补。
