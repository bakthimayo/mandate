# VerdictEvent Schema v1

## 1. Purpose

The **VerdictEvent** represents the **admissibility decision** made by the AI Control Plane in response to a DecisionEvent.

It answers a single question:

> **May this decision proceed, and under what conditions?**

VerdictEvent is **logically separate** from DecisionEvent to ensure:

* Clear separation of declaration vs judgment
* Deterministic, auditable governance
* Safe evolution from observe-only to enforcement

---

## 2. Design Principles

1. **Deterministic** – no AI involved
2. **Finite outcomes** – predictable agent behavior
3. **Traceable** – always linked to a DecisionEvent
4. **Non-invasive** – may exist without enforcement
5. **Explainable** – reasons are explicit

---

## 3. Relationship to DecisionEvent

Each VerdictEvent:

* References exactly **one** DecisionEvent
* May be issued at multiple stages
* Never mutates the DecisionEvent

```
DecisionEvent ──▶ VerdictEvent
```

VerdictEvents may be emitted even in **observe-only mode**.

---

## 4. Canonical Schema (JSON)

```json
{
  "verdict_id": "uuid",
  "decision_id": "uuid",

  "intent": "approve_invoice",
  "stage": "pre_commit",

  "verdict": "ALLOW | PAUSE | BLOCK | OBSERVE",

  "policy_refs": ["INV-042", "DATA-EU-01"],

  "requirements": {
    "human_approval": true,
    "additional_evidence": ["risk_assessment"]
  },

  "explanation": "High-value EU invoice requires manual approval",

  "mode": "observe | enforce",

  "issued_at": "2026-01-06T10:21:02Z",
  "expires_at": "2026-01-06T11:00:00Z",

  "schema_version": "1.0"
}
```

---

## 5. Field-by-Field Semantics

### verdict_id

* Globally unique identifier
* Immutable

---

### decision_id

* Foreign key to DecisionEvent
* Required for correlation

---

### intent & stage

* Copied from DecisionEvent
* Included for denormalized querying

---

### verdict

One of the finite admissibility outcomes:

* **ALLOW** – execution may proceed
* **PAUSE** – wait for required conditions
* **BLOCK** – execution must not proceed
* **OBSERVE** – record only, no enforcement

---

### policy_refs

* Identifiers of policies evaluated
* Empty list allowed (default / baseline behavior)

---

### requirements

Optional conditions that must be satisfied to proceed.

Examples:

* Human approval
* Additional evidence
* Time-based waiting

---

### explanation

Human-readable reason for the verdict.

* Used for audit and UI
* Not used for execution logic

---

### mode

Indicates whether the verdict was:

* `observe` – simulated (no enforcement)
* `enforce` – actively enforced

This supports phased adoption.

---

### issued_at

* Time verdict was produced

---

### expires_at

* Optional
* Used for time-bound approvals or retries

---

### schema_version

* Enables backward-compatible evolution

---

## 6. Enforcement Semantics

* VerdictEvent **does not execute actions**
* Enforcement happens at execution boundaries
* Absence of a VerdictEvent defaults to `OBSERVE`

---

## 7. What Is Explicitly Out of Scope

VerdictEvent must NOT include:

* Business logic
* Policy definitions
* Agent instructions
* Retry logic
* Workflow state

---

## 8. Minimal Valid VerdictEvent

```json
{
  "verdict_id": "uuid",
  "decision_id": "uuid",
  "verdict": "OBSERVE",
  "mode": "observe",
  "issued_at": "2026-01-06T10:21:02Z",
  "schema_version": "1.0"
}
```

---

## 9. Summary

VerdictEvent completes the **decision supervision loop**.

* DecisionEvent declares intent
* VerdictEvent judges admissibility

This separation allows the AI Control Plane to be:

* Safe by default
* Incrementally adoptable
* Auditable under scrutiny
* Independent of agent frameworks

---

*End of document*
