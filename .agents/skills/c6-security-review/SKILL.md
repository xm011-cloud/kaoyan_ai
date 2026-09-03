---
name: c6-security-review
description: Scope and conduct security reviews for the C6 repository, especially authentication, authorization, private APIs, AI keys and endpoints, uploads, admin access, raw SQL, tool calling, and offline state. Use when the user asks for a security audit, security review, vulnerability assessment, or hardening analysis. Do not use for ordinary code review without security intent.
---

# C6 Security Review

Use the installed Codex Security workflows for scanning and validation, while applying the C6-specific trust boundaries below.

## Choose the review mode

- For a whole-repository or scoped-folder audit, use the standard Codex Security repository scan.
- For a working-tree, branch, commit, patch, or pull-request review, use the Codex Security diff scan.
- For a supplied finding, use the dedicated triage or validation workflow.
- Only enter the security-fix workflow when the user explicitly asks to modify the repository. A review request by itself is read-only.
- Use the deep multi-pass scan only when the user explicitly asks for a deep or exhaustive audit.

Read the root `AGENTS.md` before reviewing. Honor an existing `SECURITY.md` if one is added later; do not create or redefine security policy unless requested.

## Apply C6 trust boundaries

Prioritize evidence around these project-specific invariants:

- Every private API authenticates through `getAuthUser(request)` and scopes reads and writes to the authenticated user.
- `service_role` credentials and clients remain server-only. Admin authorization fails closed and does not rely on client claims alone.
- Private responses use `jsonNoStore()` and do not leak user data through shared caches, logs, error bodies, or cross-account client state.
- User-supplied AI keys are never logged, returned to the browser unnecessarily, embedded in prompts, or exposed in telemetry. Review configurable AI base URLs as an SSRF boundary.
- Tool-calling executors recheck authorization and validate arguments; model output alone must never authorize a write or select another user's resource.
- Uploads enforce size and type limits, safe storage paths, ownership checks, and non-public access where content is private.
- Raw SQL and vector queries are parameterized and preserve tenant isolation. Do not assume ORM use makes authorization automatic.
- Offline queues clear or partition state on account changes and only replay operations designed to be idempotent and safely deduplicated.
- Public search, support, authentication, password-reset, export, and delete endpoints have appropriate abuse controls and do not disclose account existence or private metadata.

Inspect environment-variable names and data flow without printing secret values. Never include credentials, tokens, connection strings, or personal data in tool output or the report.

## Evidence and severity

Trace each candidate from attacker-controlled source to security-sensitive sink. Confirm the reachable path, violated trust boundary, attacker prerequisites, and impact before reporting it. Reject speculative issues that lack a concrete code path.

For each validated finding provide:

1. severity and concise title;
2. affected file and tight line range;
3. attack path and required preconditions;
4. concrete confidentiality, integrity, or availability impact;
5. the smallest sound remediation and a verification approach.

Order findings by severity. If no reportable findings are confirmed, say so and list the surfaces reviewed and material coverage gaps; do not claim the system is secure.

## Fixes

When fixes are explicitly requested, use the dedicated Codex Security fix workflow, preserve unrelated working-tree changes, and verify both the original attack path and the closest functional regression tests.
