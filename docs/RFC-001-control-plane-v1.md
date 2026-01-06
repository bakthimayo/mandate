# RFC-001: Mandate Control Plane & Decision Spec (v1.1)

**Status:** Draft  
**Version:** v1.1  
**Last Updated:** 2026-01-06  

---

## 1. Abstract

Mandate is an **AI Control Plane** designed to govern, observe, and audit decisions made by AI agents and automated systems.

This RFC defines **two foundational layers** that together form the control plane:

1. **Decision Specs** – immutable decision contracts
2. **Control Plane Semantics** – deterministic evaluation, verdicts, and audit

Mandate does **not** execute actions, orchestrate workflows, or enforce outcomes.

---

## 2. Core Principle

> **All governance decisions must be explainable using only the decision spec, supplied signals, and matched policies.**

Anything else is invalid.

---

## 3. What Is a Decision Spec

A **Decision Spec** defines the **contract** for a governed decision.

It declares:
- what intent is being evaluated
- what signals are allowed as inputs
- what verdicts are legal outputs
- what enforcement semantics apply

A spec:
- contains **no decision logic**
- is **immutable once active**
- is **referenced forever** by decisions

---

## 4. Spec Storage Model (DB-First)

Specs are stored directly in the database as structured records.

There is no authoring or YAML workflow in v1.

### 4.1 Spec Identity

A spec is uniquely identified by:

```
(spec_id, version)
```

### 4.2 Immutability Rules

Once a spec version is marked `active`:
- it MUST NOT be modified
- it MUST NOT be deleted

Specs may only be:
- deprecated
- superseded by a new version

---

## 5. Spec Table (Canonical)

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

  status             TEXT NOT NULL, -- draft | active | deprecated
  replaced_by        TEXT NULL,

  created_at         TIMESTAMP NOT NULL DEFAULT now(),

  PRIMARY KEY (spec_id, version)
);
```

---

## 6. Signal Model (Explicit)

### 6.1 Definition

A **signal** is a declared, typed input that policies are allowed to reference.

Policies may ONLY evaluate signals declared in the spec.

### 6.2 Signal Schema (JSONB)

```json
[
  {
    "name": "environment",
    "type": "enum",
    "values": ["dev", "staging", "production"],
    "required": true,
    "source": "scope"
  },
  {
    "name": "risk_level",
    "type": "enum",
    "values": ["low", "medium", "high", "critical"],
    "required": true,
    "source": "context"
  },
  {
    "name": "reversible",
    "type": "boolean",
    "required": false,
    "source": "context"
  }
]
```

---

## 7. Enforcement Semantics

Enforcement rules define what verdicts *mean* operationally.

### Example

```json
{
  "pause_requires": ["human_approval"],
  "resolution_timeout_minutes": 60
}
```

Rules:
- PAUSE always implies escalation
- Enforcement semantics are defined by the spec, not policies

---

## 8. Allowed Verdicts

The spec explicitly defines which verdicts may be emitted.

Example:

```json
["OBSERVE", "PAUSE", "BLOCK"]
```

Policies emitting any other verdict are invalid.

---

## 9. DecisionEvent

A DecisionEvent declares intent to perform an action.

Properties:
- immutable
- append-only
- non-executable

Each DecisionEvent MUST resolve to a spec.

---

## 10. VerdictEvent

A VerdictEvent is Mandate’s authoritative response.

| Verdict | Meaning |
|------|--------|
| ALLOW | Explicitly permitted |
| PAUSE | Requires human resolution |
| BLOCK | Must not proceed |
| OBSERVE | Logged only |

---

## 11. Spec Resolution at Runtime

When a decision is ingested:

1. Resolve active spec by:
   - organization_id
   - intent
   - stage
2. Validate required signals
3. Lock spec_id and version
4. Evaluate policies
5. Emit verdict

The spec reference is persisted with the decision.

---

## 12. Decision Immutability Dependency

Every decision MUST store:

```json
{
  "spec_id": "...",
  "spec_version": "..."
}
```

A decision without its spec is invalid.

---

## 13. Policy Relationship (Non-Overlapping)

- Specs define **what can be decided**
- Policies define **how decisions are made**

Policies:
- cannot invent signals
- cannot emit illegal verdicts
- cannot change enforcement semantics

---

## 14. Audit & Replay Guarantee

A historical decision can always be replayed using:
- the referenced spec version
- stored signal values
- policy snapshot

Deleting a spec would invalidate audit history and is forbidden.

---

## 15. Non-Goals

This RFC explicitly excludes:
- spec authoring workflows
- YAML or Git pipelines
- enforcement engines
- workflow orchestration

---

## 16. Invariants

1. Specs are immutable once active  
2. Specs are never deleted  
3. Policies depend on specs  
4. Decisions depend on specs  
5. Enforcement semantics live in specs  

---

## 17. Summary

RFC-001 defines the **contractual foundation** of Mandate.

Without it:
- policies are unsafe
- audits are meaningless
- control collapses

With it:
- decisions are defensible
- governance is deterministic
- the system remains boring and correct

---

**End of RFC-001 v1.1**
