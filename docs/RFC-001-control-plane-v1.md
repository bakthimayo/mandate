# RFC-001: Mandate AI Control Plane v1

**Status:** Draft  
**Version:** v1.0  
**Last Updated:** 2026-01-06  

---

## 1. Abstract

Mandate is an **AI Control Plane** designed to govern, observe, and audit decisions made by AI agents and automated systems.

Mandate does **not** execute actions, orchestrate workflows, or enforce outcomes.  
It provides a centralized, deterministic, and immutable layer for:

- Declaring decision intent
- Evaluating governance constraints
- Emitting authoritative verdicts
- Producing a defensible audit trail

This RFC defines the **non-negotiable boundaries** of the system.

---

## 2. Problem Statement

AI agents increasingly participate in irreversible actions such as:

- Invoice approvals
- Payment releases
- Data exports
- ERP updates

Existing systems lack:
- Centralized governance
- Durable decision reasoning
- Independent auditability
- Clear separation between decision and execution

Enterprises require a **control plane**, not more automation.

---

## 3. Goals

Mandate aims to:

1. Capture decision intent before action
2. Evaluate explicit governance constraints
3. Emit authoritative verdicts
4. Maintain an immutable audit trail
5. Operate observe-only by default
6. Remain execution-agnostic
7. Be explainable to auditors and humans

---

## 4. Non-Goals (Hard DON’Ts)

Mandate does NOT:

- Execute business actions
- Orchestrate workflows
- Retry or compensate failures
- Mutate domain state
- Infer intent automatically
- Replace RPA or workflow engines
- Act as a general-purpose rule engine
- Learn or modify policies automatically

Any violation invalidates the control plane model.

---

## 5. Core Concepts

### 5.1 DecisionEvent

A DecisionEvent declares intent to perform an action.

Properties:
- Immutable
- Append-only
- Contextual, not executable

It answers:
> “What was about to happen (or just happened), and under what context?”

---

### 5.2 VerdictEvent

A VerdictEvent is Mandate’s authoritative response.

| Verdict | Meaning |
|-------|--------|
| ALLOW | Explicitly permitted |
| PAUSE | Requires human intervention |
| BLOCK | Must not proceed |
| OBSERVE | Logged for audit only |

Verdicts express governance intent only.

---

### 5.3 Decision Lifecycle

Decisions may progress through:

- proposed
- pre_commit
- executed

All stages share a `decision_id`.

---

## 6. Control Plane Architecture

Mandate operates as a **pure governance layer**.

```
Agent → DecisionEvent → Mandate → VerdictEvent → Agent
```

Execution always remains external.

---

## 7. Observe-Only First Principle

Mandate defaults to observe-only mode to:

- Enable safe adoption
- Build baselines
- Avoid disruption
- Validate governance rules

Enforcement is always external.

---

## 8. Scope Model

Scopes define **where policies apply**.

### 8.1 Scope Dimensions
- domain
- service
- agent
- system
- environment
- tenant

### 8.2 Matching Rules
- All selector fields must match
- Missing fields act as wildcards
- Empty selector applies globally

Scope matching is deterministic and stateless.

---

## 9. Policy Model

Policies express governance constraints.

### 9.1 Constraints

Policies MUST:
- Be single-event
- Be deterministic
- Be stateless
- Be explainable

Policies MUST NOT:
- Access historical data
- Perform joins
- Call external services
- Contain loops or functions

Policies are assertions, not programs.

---

## 10. Verdict Resolution

When multiple policies match:

```
BLOCK > PAUSE > ALLOW > OBSERVE
```

All matched policies are recorded.

---

## 11. Policy Snapshots & Immutability

- Policies are grouped into immutable snapshots
- Verdicts reference snapshot_id
- Snapshots are never edited
- Historical verdicts are never re-evaluated

---

## 12. Audit Timeline

Mandate maintains an append-only audit timeline.

Each entry records:
- decision_id
- intent and stage
- actor and target
- summary and details
- severity
- source (system | agent | human)
- authority level

The timeline is the primary compliance artifact.

---

## 13. SDK Responsibilities

SDK MAY:
- Declare DecisionEvents
- Retrieve Verdicts
- Report outcomes

SDK MUST NOT:
- Evaluate policies
- Interpret verdict meaning
- Enforce behavior

---

## 14. Security & Trust Model (v1)

- Trusted clients
- Immutable writes
- Idempotent ingestion

Future versions may add auth and tenancy.

---

## 15. Success Criteria

Mandate v1 is complete when:

- Decisions can be evaluated deterministically
- Verdicts are explainable
- Audit timelines reconstruct full history
- System operates safely in observe-only mode

---

## 16. Explicitly Out of Scope

- Enforcement engines
- Workflow orchestration
- Human task systems
- ML-driven policy creation

---

## 17. Summary

Mandate is a **boring, authoritative AI control plane**.

Its value comes from:
- Constraints
- Determinism
- Auditability
- Trust

---

**End of RFC-001**
