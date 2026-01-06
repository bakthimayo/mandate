# Mandate – Codegen-Safe Build Plan v1.2
Aligned to RFC-001 (Control Plane + Decision Spec v1.1)

**Status:** Approved for implementation  
**Supersedes:** Build Plan v1.1

---

## 0. Absolute Rules (Unchanged)

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
All governance artifacts are immutable and insert-only.

---

## 1. New Foundational Addition: Decision Specs

Decision Specs are now a **first-class control plane primitive**.

They define:
- intent
- allowed signals
- allowed verdicts
- enforcement semantics

All decisions MUST resolve to a spec.

---

## 2. Architecture (Frozen)

- Node.js + Fastify
- TypeScript
- PostgreSQL
- JSON Policy Snapshots
- No auth (MVP)

---

## 3. Monorepo Structure (Updated)

```
packages/
  shared/        # Types: Spec, Signal, Decision, Verdict
  server/        # APIs, ingestion, spec resolution
  evaluator/     # Pure evaluator (no DB)
  sdk/           # Client SDK
  examples/
migrations/
docs/
scripts/
```

---

## 4. Shared Package (Updated)

Shared package now defines:

- DecisionSpec
- SignalDefinition
- EnforcementSemantics
- DecisionEvent
- VerdictEvent

Rules:
- Vocabulary only
- No logic
- No imports

---

## 5. Database Layer (Updated)

### New Table: mandate_specs

```sql
CREATE TABLE mandate_specs (
  spec_id           TEXT NOT NULL,
  version           TEXT NOT NULL,
  organization_id   UUID NOT NULL,

  domain             TEXT NOT NULL,
  intent             TEXT NOT NULL,
  stage              TEXT NOT NULL,

  allowed_verdicts   TEXT[] NOT NULL,
  signals            JSONB NOT NULL,
  enforcement        JSONB NOT NULL,

  status             TEXT NOT NULL,
  replaced_by        TEXT NULL,

  created_at         TIMESTAMP NOT NULL DEFAULT now(),

  PRIMARY KEY (spec_id, version)
);
```

### Existing Tables (Unchanged)
- decision_events
- verdict_events
- audit_timeline_entries
- policy_snapshots
- scopes

---

## 6. Ingestion API (Expanded Responsibilities)

Ingestion MUST now:

1. Resolve active spec by:
   - organization_id
   - intent
   - stage
2. Validate:
   - required signals present
   - signal types match spec
3. Persist decision with:
   - spec_id
   - spec_version
4. Invoke evaluator
5. Persist verdict

Ingestion MUST NOT:
- infer signals
- mutate specs
- bypass validation

---

## 7. Evaluator (Still Pure)

Evaluator input is now:

```ts
evaluateDecision(
  decision: DecisionEvent,
  spec: DecisionSpec,
  policySnapshot: PolicySnapshot
)
```

Evaluator rules:
- Uses only signals declared in spec
- Rejects policies referencing unknown signals
- Emits only allowed verdicts

---

## 8. Policy Constraints (Tightened)

Policies:
- MUST reference spec_id
- MAY ONLY reference declared signals
- MAY ONLY emit allowed verdicts

Invalid policy → evaluation failure

---

## 9. Policy Snapshots (Unchanged)

- Loaded at startup
- Immutable
- Versioned
- Referenced by verdicts

---

## 10. Audit Timeline (Clarified)

Timeline entries MUST include:
- spec_id
- spec_version
- verdict
- authority source (system | human)

Timeline remains the primary compliance artifact.

---

## 11. SDK Responsibilities (Clarified)

SDK MAY:
- Submit DecisionEvents
- Fetch Verdicts
- Report outcomes

SDK MUST NOT:
- Evaluate specs
- Cache specs
- Interpret verdict meaning

---

## 12. Implementation Order (Revised)

1. Shared types (Spec + Signal)
2. DB migration for mandate_specs
3. Spec resolution logic
4. Signal validation
5. Evaluator updates
6. Policy validation
7. APIs
8. SDK
9. Examples (Pause / Block)

---

## 13. Codegen Rules (Reaffirmed)

- Generate one package at a time
- No inferred features
- Prefer boring clarity
- Reject speculative logic

---

## 14. Drift Checklist (Updated)

- Specs immutable?
- Spec referenced by every decision?
- Policies constrained by spec?
- Evaluator pure?
- SDK thin?

If yes → system is correct.

---

## 15. Summary

This build plan operationalizes RFC-001 v1.1.

Specs are now contracts.
Policies are constrained.
Decisions are defensible.

If it feels boring, it is correct.

---

**End of Build Plan v1.2**
