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

## Key Concepts
- **Decision Events:** Core input representing an action attempt
- **Verdicts:** ALLOW | PAUSE | BLOCK | OBSERVE
- **Primitives:** Intent, Stage, Context, Verdict
