# DecisionEvent Schema v1

## 1. Purpose

The **DecisionEvent** is the canonical data structure of the AI Control Plane.

It represents **one attempt to perform a real-world impactful action** and is the *only* input evaluated by the control plane.

This schema is intentionally:

* Minimal
* Deterministic
* Framework-agnostic
* Append-only

It is designed for **auditability first**, enforcement later.

---

## 2. Design Principles

1. **Admissibility, not correctness**
2. **Sparse by default** (missing data is allowed)
3. **No agent reasoning or prompts**
4. **Stable fields, extensible metadata**
5. **Single responsibility: decision supervision**

---

## 3. Lifecycle Model

A single decision may emit **multiple DecisionEvents** across stages.

```
DecisionID ──┬─ proposed
             ├─ pre_commit
             ├─ executed
             └─ post_commit
```

All events share the same `decision_id`.

---

## 4. Canonical Schema (JSON)

```json
{
  "decision_id": "uuid",
  "intent": "approve_invoice",
  "stage": "pre_commit",

  "actor": {
    "type": "ai_agent | human | system",
    "id": "invoice_agent_v2"
  },

  "target": {
    "type": "invoice",
    "id": "INV-2026-00123"
  },

  "context": {
    "numeric": {
      "amount": 125000,
      "confidence": 0.81,
      "risk_score": 0.72
    },
    "categorical": {
      "currency": "EUR",
      "country": "DE",
      "region": "EU"
    },
    "flags": {
      "override": false,
      "manual": false
    },
    "metadata": {
      "model": "gpt-4o-mini",
      "system": "invoice-service",
      "tenant": "tenant_42"
    }
  },

  "evidence": {
    "ocr_used": true,
    "risk_check": "performed",
    "tool_calls": ["vendor_lookup"]
  },

  "timestamp": "2026-01-06T10:21:00Z",
  "schema_version": "1.0"
}
```

---

## 5. Field-by-Field Semantics

### decision_id

* Globally unique
* Generated at first declaration
* Reused across all lifecycle stages

---

### intent

* Stable domain verb
* Chosen from platform intent registry
* Must not encode conditions or logic

---

### stage

* One of: `proposed | pre_commit | executed | post_commit`
* Determines admissibility semantics

---

### actor

Identifies **who is accountable** for the decision.

* `type`: ai_agent | human | system
* `id`: stable identifier

---

### target

Identifies **what is being acted upon**.

* Not a full object
* Used for correlation and audit

---

### context

Structured metadata used for policy evaluation.

* All fields optional
* Missing data reduces admissibility
* No nested business objects

---

### evidence

Declarative proof of due diligence.

* Optional
* Never inferred
* Not validated for correctness

---

### timestamp

* Event creation time
* Used for ordering and correlation

---

### schema_version

* Enables backward-compatible evolution

---

## 6. What Is Explicitly Out of Scope

The DecisionEvent must NOT include:

* Agent prompts
* Chain-of-thought
* LLM responses
* Full payloads (PDFs, invoices)
* Business rules
* Workflow state

---

## 7. Storage & Immutability Requirements

* Events are append-only
* No in-place mutation
* Corrections must emit new events
* Deletions are forbidden

---

## 8. Minimal Valid Event

```json
{
  "decision_id": "uuid",
  "intent": "export_data",
  "stage": "executed",
  "actor": { "type": "system", "id": "etl_job" },
  "timestamp": "2026-01-06T10:21:00Z",
  "schema_version": "1.0"
}
```

This is sufficient for observability.

---

## 9. Summary

The DecisionEvent schema is the **spine of the AI Control Plane**.

Everything else—policies, verdicts, UI, analytics—builds on top of this immutable, auditable record of intent.

---

*End of document*
