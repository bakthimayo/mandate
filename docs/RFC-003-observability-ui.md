# RFC-003: Mandate Observability & Audit UI (Read-Only)

**Status:** Draft  
**Version:** v1.0  
**Related RFCs:**  
- RFC-001: Mandate AI Control Plane v1  
- BUILD-PLAN v1.1 (Codegen-safe)  

**Last Updated:** 2026-01-06

---

## 1. Abstract

This RFC defines the **Mandate Observability & Audit UI**, a **strictly read-only interface** for viewing, explaining, and exporting decisions governed by the Mandate AI Control Plane.

The UI exists to provide **visibility, auditability, and trust**.  
It does **not** provide control, enforcement, or remediation capabilities.

This RFC establishes **hard UI boundaries** to prevent Mandate from drifting into an execution, workflow, or enforcement system.

---

## 2. Motivation

Mandate produces high-value governance artifacts:

- DecisionEvents  
- VerdictEvents  
- Audit timeline entries  
- Policy snapshot references  

Without a UI:
- Enterprises cannot operationalize audit data
- Auditors cannot independently verify behavior
- Governance teams cannot observe patterns
- JSON APIs become the de facto (and incorrect) interface

A misdesigned UI can easily violate the control plane model by introducing overrides or workflows.  
This RFC ensures the UI strengthens governance **without altering reality**.

---

## 3. Design Principles (Non-Negotiable)

### P1. Read-Only Always
The UI must not mutate state, trigger actions, or influence execution.

### P2. Evidence Over Control
The UI surfaces *what happened and why*, never *what should happen next*.

### P3. Explanation First
Every verdict must be explainable without replaying the evaluator.

### P4. Zero Enforcement Capability
If a UI action can change system behavior, it violates this RFC.

---

## 4. Explicit Non-Goals (Hard DON’Ts)

The UI MUST NOT:
- Approve or reject decisions
- Override verdicts
- Resume paused actions
- Edit or create policies
- Trigger re-evaluation
- Call agent APIs
- Perform enforcement
- Provide “Fix”, “Retry”, or “Continue” actions
- Act as a workflow inbox

---

## 5. Target Users

Designed for:
- Compliance officers
- Risk & governance teams
- Security reviewers
- Platform architects
- Auditors
- Senior engineering leadership

Not designed for:
- Operators executing tasks
- End users
- AI agents

---

## 6. UI Scope (v1)

The UI consists of **three core views only**:
1. Decision List View
2. Decision Timeline View
3. Verdict Explanation Panel

---

## 7. View 1: Decision List View

**Purpose:** Discover and filter decisions.

**Required Columns:**
- Timestamp
- Decision ID
- Intent
- Stage
- Verdict
- Agent / Service
- Target
- Policy Snapshot ID

**Required Filters:**
- Time range
- Verdict
- Intent
- Agent / Service
- Tenant

---

## 8. View 2: Decision Timeline View (Primary)

**Purpose:** Reconstruct the full lifecycle of a decision.

Displays:
- DecisionEvents
- VerdictEvents
- Audit entries

Each entry shows:
- Timestamp
- Source (control_plane | agent | human)
- Authority level
- Summary
- Expandable JSON details

---

## 9. View 3: Verdict Explanation Panel

Answers:
> “Why did the system issue this verdict?”

Shows:
- Resolved verdict
- Policy snapshot ID
- Matched scopes
- Matched policies
- Explanation text
- Verdict precedence

---

## 10. Data Export

Allowed formats:
- JSON
- CSV

Constraints:
- Read-only
- No semantic transformation
- Snapshot references preserved

---

## 11. UI Architecture

**Backend:**  
- Read-only APIs only  
- No mutation endpoints  

**Frontend:**  
- Stateless  
- No client-side governance logic  

**Auth (v1):**  
- Optional  
- Read-only roles only  

---

## 12. Security & Trust Model

- UI is a consumer of evidence
- Authority remains with control plane
- UI compromise must not allow mutation

---

## 13. Relationship to Control Plane

```
Decision → Verdict → Timeline → UI
```

The UI is strictly downstream.

---

## 14. Out of Scope

- Human approval workflows
- Case management
- Task assignment
- Policy authoring
- Re-evaluation
- Simulation tools

---

## 15. Success Criteria

- Decisions are discoverable
- Lifecycles are fully visible
- Verdicts are explainable
- UI cannot mutate state

---

## 16. Drift Detection

Reject any feature where:
- UI changes system behavior
- UI overrides verdicts
- UI influences execution

---

## 17. Summary

The Mandate Observability UI builds trust through transparency, not control.

If the UI feels boring, it is correct.

---

**End of RFC-003**
