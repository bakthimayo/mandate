# Observe-Only Policy Evaluator v1

## 1. Purpose

The **Observe-Only Policy Evaluator** is the first executable component of the AI Control Plane.

Its responsibility is to:

* Consume `DecisionEvent`s
* Evaluate them against policies
* Emit `VerdictEvent`s in **observe mode only**

It **never blocks, pauses, or interferes** with runtime execution.

This component exists to:

* Build trust
* Surface risks
* Validate policy logic
* Generate audit evidence

---

## 2. Non-Goals (Very Important)

The evaluator does **NOT**:

* Enforce decisions
* Call back agents
* Execute workflows
* Modify DecisionEvents
* Require complete context

If any of the above appear, v1 has failed.

---

## 3. High-Level Flow

```
DecisionEvent
   ↓
Evaluator Ingest
   ↓
Policy Snapshot Load
   ↓
Predicate Evaluation
   ↓
Verdict Resolution
   ↓
VerdictEvent (mode = observe)
```

---

## 4. Input & Output

### Input

* `DecisionEvent` (append-only)

### Output

* `VerdictEvent` with:

  * `mode = observe`
  * `verdict = ALLOW | PAUSE | BLOCK | OBSERVE`

**Note:**

> Even `BLOCK` here is *simulated*.

---

## 5. Policy Snapshot Model (Minimal)

Policies are evaluated from a **compiled snapshot**, not live specs.

### Policy Snapshot Structure

```json
{
  "snapshot_id": "2026-01-06T00:00:00Z",
  "policies": [
    {
      "policy_id": "INV-042",
      "intent": "approve_invoice",
      "stage": "pre_commit",
      "conditions": [
        "context.numeric.amount > 100000",
        "context.categorical.region == 'EU'"
      ],
      "verdict": "PAUSE",
      "explanation": "High-value EU invoice requires manual approval"
    }
  ]
}
```

* Loaded at startup
* Versioned
* Immutable during runtime

---

## 6. Evaluation Semantics

### 6.1 Matching Rules

A policy is eligible if:

* `policy.intent == event.intent`
* `policy.stage == event.stage`

---

### 6.2 Condition Evaluation

* Conditions are evaluated as **boolean predicates**
* Missing context fields evaluate to `false`
* No implicit coercion

Example:

```
context.numeric.amount > 100000   → true
context.numeric.confidence < 0.7 → false (if missing)
```

---

### 6.3 Multiple Policy Matches

If multiple policies match:

Verdict precedence:

```
BLOCK > PAUSE > ALLOW > OBSERVE
```

* Highest-severity verdict wins
* All matched `policy_id`s are recorded

---

## 7. Verdict Resolution

The evaluator produces a **single VerdictEvent** per DecisionEvent.

### VerdictEvent Fields (v1)

* `decision_id`
* `intent`
* `stage`
* `verdict`
* `policy_refs`
* `explanation`
* `mode = observe`

---

## 8. Idempotency & Safety

* Evaluator is idempotent per `(decision_id, stage)`
* Duplicate VerdictEvents are not re-emitted
* Evaluator failure must not block ingestion

---

## 9. Operational Characteristics

### Deployment

* Stateless service
* Horizontal scaling allowed

### Performance

* Low QPS acceptable in v1
* Latency not critical (async)

### Failure Mode

* On failure, system continues without verdicts
* Missing verdicts are acceptable in v1

---

## 10. Example End-to-End (Observe Mode)

### DecisionEvent

```json
{
  "decision_id": "d-123",
  "intent": "approve_invoice",
  "stage": "pre_commit",
  "context": {
    "numeric": { "amount": 125000 },
    "categorical": { "region": "EU" }
  }
}
```

### VerdictEvent (Simulated)

```json
{
  "verdict_id": "v-456",
  "decision_id": "d-123",
  "verdict": "PAUSE",
  "policy_refs": ["INV-042"],
  "explanation": "High-value EU invoice requires manual approval",
  "mode": "observe",
  "issued_at": "2026-01-06T10:21:02Z",
  "schema_version": "1.0"
}
```

---

## 11. Explicit Future Extensions (Not v1)

* Real-time enforcement
* Policy authoring UI
* Git-backed policy pipelines
* Streaming evaluation
* Confidence-based heuristics

---

## 12. Summary

The observe-only evaluator:

* Proves the control plane model
* Surfaces risk without disruption
* Generates audit evidence
* Enables safe iteration

It is the **bridge from theory to practice**.

---

*End of document*
