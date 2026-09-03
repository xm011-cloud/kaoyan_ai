---
name: c6-bug-fix
description: Diagnose, implement, and verify bug fixes in the C6 study platform. Use when the user asks to fix a defect, regression, inconsistent state, broken workflow, or reproducible product issue. Do not use for feature development or diagnosis-only requests.
---

# C6 Bug Fix

Fix the root cause with the smallest safe change and leave evidence that the affected workflow works.

## Establish the failure

1. Read the root `AGENTS.md` and inspect the working tree. Preserve unrelated changes.
2. Restate the observable symptom and expected behavior from available evidence. Do not silently broaden the request into a redesign.
3. Reproduce the problem through the narrowest useful path: an existing Playwright case, a focused API request, or the responsible state transition. If reproduction depends on unavailable credentials or infrastructure, continue with static evidence and state the limitation.
4. Trace the complete data path before editing: UI or store, API route, shared domain logic, database, and offline replay where relevant. Prefer an existing shared source of truth over adding a second implementation.

## Protect C6 invariants

- Read the relevant guide under `node_modules/next/dist/docs/` before changing Next.js framework APIs or conventions.
- Private API routes must authenticate with `getAuthUser(request)`, return private data with `jsonNoStore()`, and preserve per-user query isolation.
- Keep Prisma on the driver-adapter path through `src/lib/prisma.ts`; do not introduce traditional direct-client initialization.
- Reuse `src/lib/prep-stage.ts` and `src/lib/completion.ts` for stage or completion behavior instead of recreating their rules in a component or route.
- Treat offline writes as replayable operations: preserve deduplication, idempotent semantics, and cross-account isolation.
- If static assets or offline behavior change, bump the cache version in `public/sw.js` as required by `AGENTS.md`.
- Do not add dependencies, change the schema, or alter public behavior unless the root cause requires it. Call out those consequences before proceeding when they materially expand scope.

## Implement and verify

1. Add or adjust a regression test when the failure has a stable observable boundary. Register a new authenticated Playwright spec in `playwright.config.ts` when the project convention requires it.
2. Make the minimal cohesive fix. Avoid opportunistic refactors and formatting churn.
3. Run checks in increasing scope:
   - `npx tsc --noEmit`
   - ESLint on the changed source and test files
   - the closest Playwright spec or focused `-g` case
   - broader tests only when the change has cross-cutting risk
4. Compare failures with the pre-existing baseline. A known repository failure is not a pass, but do not attribute it to the patch without evidence.
5. Reinspect the diff and working tree to confirm only intended files changed.

## Report

Lead with whether the bug is fixed. Include the root cause, changed behavior, tests actually run and their results, and any residual uncertainty. Never claim the whole suite is green when only focused checks ran.
