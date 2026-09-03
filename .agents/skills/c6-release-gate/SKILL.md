---
name: c6-release-gate
description: Evaluate whether the current C6 branch or working tree is ready to release and produce an evidence-backed go, conditional-go, or no-go decision. Use for deployment readiness, release checks, preflight validation, or ship decisions. This skill does not deploy, push, migrate production data, or fix failures unless the user separately asks.
---

# C6 Release Gate

Perform a read-only release assessment. Do not deploy, push, publish, run a production database migration, or rewrite files as part of the gate.

## Define the candidate

1. Read the root `AGENTS.md` and inspect the branch, status, diff, and recent commits relevant to the candidate.
2. Distinguish committed release changes from unrelated local edits. Never include a user's unrelated dirty files in the release claim.
3. Identify change-sensitive surfaces before choosing checks: Prisma schema, authentication, AI configuration and tools, uploads, service worker or static assets, environment variables, and Playwright configuration.

## Run the gates

Use the repository commands and record actual outcomes:

1. **Source gate**
   - `npx tsc --noEmit`
   - `npm run lint`
   - `npm run build`
2. **Behavior gate**
   - Run the focused Playwright specs for changed workflows first.
   - Run `npx playwright test` for a full release candidate when credentials and test infrastructure are available.
   - Confirm a newly added authenticated spec is listed in the authenticated project's `testMatch` configuration when required.
3. **Data gate**
   - Inspect `prisma/schema.prisma` and generated-client implications when the schema changed.
   - State the required migration or `prisma db push` step without applying it to production.
   - Treat destructive or compatibility-breaking data changes as blockers until an explicit migration and rollback plan exists.
4. **PWA gate**
   - When static resources, offline logic, or the service worker changed, verify that `public/sw.js` has a cache-version bump and that update behavior remains intact.
5. **Configuration and operations gate**
   - Check that new required environment variables are documented in the appropriate example or deployment notes without exposing secret values.
   - Verify user-facing or architectural changes are reflected in the relevant canonical project document when the repository convention calls for it.
6. **Security gate**
   - For changes to auth, admin access, uploads, user API keys, raw SQL, service-role use, tool calling, or offline identity boundaries, run the installed Codex Security diff-review workflow or mark the missing review as a release blocker.

## Decide

- **GO**: every required gate passed and no unresolved blocker remains.
- **CONDITIONAL GO**: only explicitly named operational or manual checks remain, with an owner and exact action. Do not use this label to soften a failed required check.
- **NO-GO**: a required check failed, was skipped without an accepted reason, or revealed an unresolved correctness, data, privacy, or security risk.

Pre-existing failures remain visible. Separate baseline failures from candidate regressions, but never turn a failed required command into a pass without an explicit release exception.

## Report

Start with the decision. Then list blockers, a compact evidence table containing each check and result, change-specific manual checks, and the exact next action required for release. State which checks were not run and why.
