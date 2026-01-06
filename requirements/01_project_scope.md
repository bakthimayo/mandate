# MANDATE 
Mandate is an AI Control Plane for enterprises running autonomous agents

## 1. Purpose of This Document

This document defines the **foundational primitives** of the AI Control Plane:

* **Intent**
* **Stage**
* **Context**
* **Verdict**

It also explains **what problem the control plane solves**, **what it explicitly does NOT solve**, and **how these primitives enable a generic, Kubernetes-like control plane for AI-driven systems**.

This document is intended to:

* Align architects, engineers, and domain owners
* Serve as the basis for system design and implementation
* Avoid policy DSL debates prematurely

---

## 2. Problem Statement

Modern AI systems introduce **autonomous decision-making** into enterprise workflows. While core systems (ERP, IAM, databases) remain deterministic, AI agents:

* Influence decisions before deterministic rules apply
* Operate probabilistically
* Change behavior over time
* Bypass traditional audit and control mechanisms

Existing governance approaches (GRC, policy documents, static rules) are **insufficient** because they:

* Assume predictable behavior
* Operate post-facto
* Cannot interrupt AI-driven actions in real time

### Goal

The AI Control Plane provides a **deterministic supervisory layer** that:

* Observes AI decisions at execution boundaries
* Evaluates admissibility using policies
* Issues enforceable verdicts
* Produces auditable decision evidence

---

## 3. What the AI Control Plane Is (and Is Not)

### IS

* A generic decision admission system
* Framework-agnostic
* Deterministic and explainable
* Focused on **admissibility**, not correctness
* Integrated at **irreversible action boundaries**

### IS NOT

* An agent framework
* A workflow engine
* A rule engine replacement
* A model evaluator
* A business logic system

---

## 4. Core Concept: Decision Event

All interaction with the control plane happens through a **Decision Event**.

A Decision Event represents:

> "An attempt to perform an action that has real-world impact."

The control plane never inspects agent internals or reasoning. It only evaluates Decision Events.

---

## 5. Primitive Definitions

### 5.1 Intent

**Definition**
Intent is a **stable, domain-level verb** describing the action being attempted.

Intent answers the question:

> *What kind of action is this system attempting to perform?*

**Characteristics**

* Verb-based (not workflow-based)
* Stable over time
* Limited in number (typically 10–50 per domain)
* Platform-owned

**Examples**

* `approve_invoice`
* `release_payment`
* `export_data`
* `send_external_ai_request`
* `override_validation`

**Non-examples (Anti-patterns)**

* `approve_high_value_invoice`
* `approve_invoice_for_vendor_x`
* `approve_invoice_under_eu_rules`

Intent must never encode business rules or conditions.

---

### 5.2 Stage

**Definition**
Stage describes **when** the intent is being evaluated relative to execution.

Stage answers the question:

> *At what point in the lifecycle is this decision being declared?*

**Standard Stages**

* `proposed` – action is being considered
* `pre_commit` – irreversible action is about to occur
* `executed` – action has already occurred
* `post_commit` – outcome is known

**Why Stage Matters**

* Enables observe-only mode
* Allows different policies at different lifecycle points
* Supports safe, incremental adoption

---

### 5.3 Context

**Definition**
Context is a **sparse, structured metadata envelope** that describes relevant attributes of the decision.

Context answers the question:

> *What facts make this decision meaningful or risky?*

**Design Principles**

* Optional fields
* Typed values
* Mechanically extractable where possible
* No requirement for completeness

**Canonical Context Structure (Conceptual)**

```
context:
  numeric:
    amount?
    confidence?
    risk_score?
  categorical:
    currency?
    country?
    region?
    vendor_type?
  flags:
    override?
    manual?
    retry?
  metadata:
    actor
    system
    model
    timestamp
```

Missing context does not fail evaluation; it reduces admissibility.

---

### 5.4 Verdict

**Definition**
Verdict is the **deterministic outcome** returned by the control plane after evaluating policies.

Verdict answers the question:

> *May this decision proceed, and under what conditions?*

**Finite Verdict Set**

* `ALLOW` – proceed normally
* `PAUSE` – wait for approval or evidence
* `BLOCK` – deny execution
* `OBSERVE` – record only (no enforcement)

**Why Verdicts Are Finite**

* Predictable agent behavior
* Simple enforcement points
* Safe failure modes

---

### 5.5 Supporting Primitives (Required for Completeness)

These primitives are **not first-class decision drivers**, but are required for accountability, correlation, and auditability.

#### Actor

**Who is attempting the action**.

Examples:

* `ai_agent:invoice_bot_v2`
* `human:user_123`
* `system:batch_job_7`

Actor represents accountability, not authorization.

---

#### Target (Resource)

**What entity is being acted upon**.

Examples:

* `invoice_456`
* `payment_789`
* `external_system:SAP`

Targets enable correlation, replay, and scoped governance.

---

#### Evidence

**Declared proof that due steps were taken before the decision**.

Examples:

* `ocr_used: true`
* `risk_check: performed`
* `tool_calls: ["vendor_lookup"]`

Evidence is optional, declarative, and never inferred by the control plane.

---

#### Decision ID

**Globally unique identifier for a decision lifecycle**.

* Immutable
* Reused across all stages
* Required for tracing and replay

---

#### Policy References

**Identifiers explaining why a verdict was issued**.

Returned by the control plane, not supplied by the agent.

Example:

```json
"policy_refs": ["INV-042", "DATA-EU-01"]
```

---

## 6. Separation of Responsibilities

### Agent

* Reasons and plans
* Chooses actions to attempt
* Declares intent
* Adapts when blocked or paused

### Control Plane

* Evaluates admissibility
* Applies organizational constraints
* Issues verdicts
* Produces audit evidence

Agents decide **what to attempt**.
Control plane decides **what may become real**.

---

## 7. Boundary Definition

Control plane integration happens at **irreversible action boundaries**, such as:

* Posting financial records
* Releasing payments
* Exporting data
* Calling external AI APIs
* Updating authoritative systems

Boundaries are determined by **impact**, not by business preference.

---

## 8. Adoption Model

The control plane supports phased adoption:

1. **Observe-only** – no blocking, full visibility
2. **Notify / Explain** – human awareness
3. **Pause / Approve** – soft governance
4. **Block** – hard enforcement (selective)

This avoids trust cliffs and enables incremental rollout.

---

## 9. Why This Model Scales

* Framework-agnostic
* Minimal developer burden
* Domain logic remains in core systems
* Policies evolve independently
* Supports legacy and greenfield systems

---

## 10. Summary

The AI Control Plane is a **generic admission system for AI-driven decisions**.

It relies on four stable primitives:

* **Intent** – what action is being attempted
* **Stage** – when it is being evaluated
* **Context** – why it matters
* **Verdict** – whether it may proceed

This separation allows enterprises to introduce AI safely **without rewriting systems, trusting agents blindly, or encoding brittle business logic**.

---

*End of document*