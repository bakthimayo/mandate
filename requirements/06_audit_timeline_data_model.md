# Audit Timeline Data Model v1

## 1. Purpose

The **Audit Timeline** provides a **human-readable, defensible reconstruction** of what happened for a given decision, entity, or period of time.

It answers four auditor-grade questions:

1. What happened?
2. Who (or what) initiated it?
3. What was the admissibility judgment?
4. What was the eventual outcome?

This model is **read-optimized** and derived from immutable events.

---

## 2. Core Design Principle

> **The timeline is a projection, not a source of truth.**

* Source of truth: `DecisionEvent`, `VerdictEvent`
* Timeline: materialized or computed view for audit & ops

No new facts are introduced in the timeline.

---

## 3. Timeline Scope Levels

The timeline must support multiple scopes:

| Scope    | Example                    |
| -------- | -------------------------- |
| Decision | Single invoice approval    |
| Target   | All actions on one invoice |
| Actor    | All actions by an AI agent |
| Intent   | All invoice approvals      |
| Time     | All decisions last month   |

---

## 4. Canonical Timeline Entry

Each timeline is composed of **ordered Timeline Entries**.

```json
{
  "timeline_id": "tl-uuid",
  "decision_id": "d-uuid",

  "entry_type": "DECISION | VERDICT | OUTCOME",

  "intent": "approve_invoice",
  "stage": "pre_commit",

  "actor": {
    "type": "ai_agent",
    "id": "invoice_bot_v2"
  },

  "target": {
    "type": "invoice",
    "id": "INV-2026-00123"
  },

  "summary": "AI agent attempted to approve invoice",

  "details": {
    "amount": 125000,
    "currency": "EUR",
    "verdict": "PAUSE",
    "policy_refs": ["INV-042"]
  },

  "severity": "INFO | WARNING | CRITICAL",

  "occurred_at": "2026-01-06T10:21:00Z"
}
```

---

## 5. Entry Types

### 5.1 DECISION

Derived from `DecisionEvent`.

Represents:

* Declaration of intent
* Attempted action

Severity is usually `INFO`.

---

### 5.2 VERDICT

Derived from `VerdictEvent`.

Represents:

* Admissibility judgment
* Policy evaluation result

Severity mapping:

* `ALLOW` → INFO
* `OBSERVE` → INFO
* `PAUSE` → WARNING
* `BLOCK` → CRITICAL

---

### 5.3 OUTCOME

Represents the **actual system outcome**, if known.

Examples:

* Invoice posted
* Payment released
* Action aborted

Outcomes may come from:

* Post-commit DecisionEvents
* System callbacks
* Manual annotations

---

## 6. Timeline Construction Logic

### Ordering

Entries are ordered by:

1. `occurred_at`
2. Entry precedence: DECISION → VERDICT → OUTCOME

---

### Grouping

Entries are grouped by:

* `decision_id` (primary)
* optionally by `target.id`

---

## 7. Storage Model (Read Model)

### audit_timeline_entries table

```sql
CREATE TABLE audit_timeline_entries (
  id UUID PRIMARY KEY,
  decision_id UUID,

  entry_type TEXT NOT NULL,

  intent TEXT,
  stage TEXT,

  actor_type TEXT,
  actor_id TEXT,

  target_type TEXT,
  target_id TEXT,

  summary TEXT,
  details JSONB,

  severity TEXT,

  occurred_at TIMESTAMPTZ NOT NULL,

  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_timeline_decision
  ON audit_timeline_entries(decision_id);

CREATE INDEX idx_timeline_target
  ON audit_timeline_entries(target_type, target_id);

CREATE INDEX idx_timeline_time
  ON audit_timeline_entries(occurred_at);
```

This table can be:

* materialized periodically, or
* populated asynchronously via consumers

---

## 8. Materialization Strategy (v1)

Recommended v1 approach:

* Async worker consumes DecisionEvent & VerdictEvent
* Emits timeline entries
* No synchronous coupling

Rebuildable at any time from source events.

---

## 9. Example Timeline (Invoice Approval)

```
10:21:00  DECISION  approve_invoice  AI agent attempted approval
10:21:02  VERDICT   PAUSE            High-value EU invoice (INV-042)
10:25:40  OUTCOME   ESCALATED         Sent to finance team
```

This is auditor-ready.

---

## 10. What Is Explicitly Out of Scope

* Root cause analysis
* Agent reasoning display
* Policy editing
* Enforcement actions

Those belong to other layers.

---

## 11. Summary

The Audit Timeline:

* Translates raw events into human truth
* Preserves immutability
* Enables trust and accountability
* Avoids speculative interpretation

It is the **primary interface between the control plane and humans**.

---

*End of document*
