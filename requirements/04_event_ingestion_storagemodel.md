# Event Ingestion & Storage Model v1

## 1. Purpose

This document defines **how DecisionEvent and VerdictEvent are ingested, stored, and queried** in the AI Control Plane.

The goal is to support:

* Auditability
* Correlation
* Replay
* Low operational complexity (v1)

This is an **observe-first, enforce-later** design.

---

## 2. Design Principles

1. **Append-only** – events are never mutated or deleted
2. **Event-first** – no dependency on workflows or specs
3. **Correlation-driven** – DecisionID is the primary join key
4. **Query-friendly** – auditors and ops must get answers fast
5. **Simple tech choices** – boring > clever

---

## 3. High-Level Architecture

```
Agent / System
   ↓
Event Ingestion API
   ↓
Validation & Normalization
   ↓
Event Store (Append-only)
   ↓
Evaluator (Observe-only)
   ↓
VerdictEvent Store
```

---

## 4. Ingestion API

### 4.1 Endpoints

```
POST /events/decision
POST /events/verdict   (internal)
```

* DecisionEvents can be ingested by agents, proxies, gateways
* VerdictEvents are emitted only by the control plane

---

### 4.2 Ingestion Rules

On ingest:

* Validate schema version
* Validate required fields
* Enforce size limits
* Reject malformed events

**No business validation occurs here.**

---

## 5. Storage Model (Relational – Recommended v1)

A relational database (Postgres) is sufficient and preferred for v1.

### 5.1 decision_events table

```sql
CREATE TABLE decision_events (
  id UUID PRIMARY KEY,
  decision_id UUID NOT NULL,
  intent TEXT NOT NULL,
  stage TEXT NOT NULL,

  actor_type TEXT,
  actor_id TEXT,

  target_type TEXT,
  target_id TEXT,

  context JSONB,
  evidence JSONB,

  occurred_at TIMESTAMPTZ NOT NULL,
  schema_version TEXT NOT NULL,

  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_decision_events_decision_id
  ON decision_events(decision_id);

CREATE INDEX idx_decision_events_intent_stage
  ON decision_events(intent, stage);

CREATE INDEX idx_decision_events_occurred_at
  ON decision_events(occurred_at);
```

---

### 5.2 verdict_events table

```sql
CREATE TABLE verdict_events (
  id UUID PRIMARY KEY,
  decision_id UUID NOT NULL,

  intent TEXT,
  stage TEXT,

  verdict TEXT NOT NULL,
  policy_refs TEXT[],
  requirements JSONB,
  explanation TEXT,

  mode TEXT NOT NULL,

  issued_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ,
  schema_version TEXT NOT NULL,

  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_verdict_events_decision_id
  ON verdict_events(decision_id);

CREATE INDEX idx_verdict_events_verdict
  ON verdict_events(verdict);
```

---

## 6. Correlation Model

Correlation is performed via:

* `decision_id` (primary)
* `intent`
* `target_id`
* Time window (`occurred_at`)

This enables:

* Full decision timelines
* Cross-system tracing
* Incident reconstruction

---

## 7. Event Ordering & Idempotency

* Ordering is determined by `occurred_at`
* Ingestion is idempotent on `(id)`
* Duplicate events are ignored

---

## 8. Event Retention & Compliance

* Events are retained indefinitely by default
* Redaction is handled via:

  * tokenization
  * reference-only storage
* Hard deletes are forbidden

---

## 9. Replay & Simulation

The event store supports:

* Replaying historical DecisionEvents
* Re-evaluating them against new policies
* Producing simulated VerdictEvents (`mode = observe`)

This is critical for trust-building and audits.

---

## 10. Future Extensions (Not v1)

Explicitly out of scope for v1:

* Streaming pipelines (Kafka)
* OLAP stores (ClickHouse)
* Real-time enforcement
* Cross-tenant analytics

These can be added once volume and trust justify them.

---

## 11. Summary

This ingestion and storage model:

* Treats decisions as immutable facts
* Separates declaration from judgment
* Enables auditability without enforcement
* Avoids premature complexity

It is the **operational backbone** of the AI Control Plane.

---

*End of document*
