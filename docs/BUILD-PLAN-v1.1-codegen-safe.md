# Mandate – Codegen-Safe Build Plan v1.1
Aligned to RFC-001 (AI Control Plane v1)

**Status:** Approved for implementation

---

## 0. Absolute Rules

### R0.1 Control Plane Boundary
Mandate never:
- Executes actions
- Orchestrates workflows
- Mutates domain state
- Enforces outcomes

### R0.2 Evaluator Purity
Evaluator must be:
- Pure
- Deterministic
- Stateless
- Single-event

Evaluator must not:
- Access DB
- Call external services
- Use time or randomness

### R0.3 Policy Is Not Code
Policies are assertions, not programs.

### R0.4 Append-Only
All data is immutable and insert-only.

---

## 1. Architecture (Frozen)

- Node.js + Fastify
- TypeScript
- PostgreSQL
- JSON Policy Snapshots
- No auth (MVP)

---

## 2. Monorepo Structure

```
packages/
  shared/
  server/
  sdk/
  examples/
migrations/
docs/
scripts/
```

---

## 3. Shared Package

Defines all types and schemas.

Rules:
- No logic
- No imports
- Vocabulary only

---

## 4. Database Layer

Tables:
- decision_events
- verdict_events
- audit_timeline_entries
- scopes
- policy_snapshots

Timeline requires:
- source
- authority_level

---

## 5. Evaluator (Core)

Isolated module.

Public API:

```ts
evaluateDecision(decision, snapshot)
```

No async. No DB. No side effects.

---

## 6. Policy Constraints

Allowed operators:
==, !=, >, <, >=, <=, in

Forbidden:
- Nested logic
- Custom operators
- Cross-event logic

---

## 7. Policy Snapshots

- Loaded at startup
- Immutable
- Versioned
- Referenced by verdicts

---

## 8. Ingestion API

Responsibilities:
- Validate schema
- Persist events
- Invoke evaluator
- Persist verdicts

No business logic.

---

## 9. Audit Timeline

Primary compliance artifact.
Append-only.
Authority-aware.

---

## 10. SDK

Lowest authority.

SDK must not:
- Evaluate policies
- Cache verdicts
- Enforce behavior

---

## 11. Implementation Order

1. Shared types
2. DB migrations
3. Evaluator
4. APIs
5. SDK
6. Examples

---

## 12. Codegen Rules

- Generate one package at a time
- No inferred features
- Prefer clarity
- Reject speculative logic

---

## 13. Drift Checklist

- No evaluator impurity
- No SDK logic creep
- No mutable writes
- RFC still holds

---

## 14. Summary

If the system feels boring, it is correct.

---

**End of Build Plan v1.1**
