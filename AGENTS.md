# AGENTS.md - Mandate AI Control Plane

## Project Status
Documentation/planning phase. No code implemented yet.

## Planned Stack
- **Runtime:** Node.js + Fastify
- **Language:** TypeScript (strict mode)
- **Database:** PostgreSQL (append-only, immutable data)
- **Structure:** Monorepo (`packages/shared`, `server`, `sdk`, `examples`)

## Core Constraints (MUST follow - from .cursor/rules.json)
1. **Control Plane Only:** Never use execute/run/perform/orchestrate/retry/compensate or workflow/pipeline/job/task queue patterns
2. **Evaluator Purity:** In `packages/server/src/evaluator/` - no Date, Math.random, setTimeout, fetch, axios, DB access
3. **Shared = Types Only:** `packages/shared/` must have no functions, classes, or control flow (if/for/while)
4. **SDK = Thin Client:** `packages/sdk/` should not contain if/switch/evaluate/policy/verdict logic
5. **Append-Only DB:** Never use UPDATE or DELETE SQL statements
6. **Policies ≠ Code:** No function/script/expression/eval in policy JSON files

## Implementation Order
1. Shared types → 2. DB migrations → 3. Evaluator → 4. APIs → 5. SDK → 6. Examples

## RFC-002: Organizational Scope & Governance Isolation

**This is NOT a SaaS system.**

Rules:
- Organization and domain are logical governance boundaries only
- Do not introduce tenants, customers, accounts, or billing concepts
- Do not introduce authentication or IAM logic
- Do not add infrastructure-level isolation
- Isolation is enforced via schemas, scope matching, and queries

⚠️ If a requirement resembles SaaS tenancy, STOP and ask for clarification.

## RFC-003: Observability & Audit UI (Read-Only)

⚠️ **When generating code for Mandate's Observability & Audit UI, you MUST strictly follow:**

Hard UI Constraints:
- The UI is strictly read-only
- The UI must not mutate state or trigger actions
- The UI must not override, approve, reject, retry, or resume decisions
- The UI must not recompute governance logic
- The UI must only render persisted data from APIs
- The UI must treat organization_id and domain as hard isolation boundaries

**STOP and ask for clarification** if a feature resembles:
- Control, enforcement, workflow, or remediation
- State mutation or action triggering
- Decision override or approval logic

## Key Concepts
- **Decision Events:** Core input representing an action attempt
- **Verdicts:** ALLOW | PAUSE | BLOCK | OBSERVE
- **Primitives:** Intent, Stage, Context, Verdict
