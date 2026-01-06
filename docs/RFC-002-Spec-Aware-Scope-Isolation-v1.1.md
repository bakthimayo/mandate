# RFC-002: Organizational Scope, Spec Binding & Governance Isolation (Non-SaaS)

**Status:** Draft  
**Version:** v1.1  
**Applies To:** Internal / On-Prem / Non-SaaS Deployments  
**Depends On:** RFC-001 (Control Plane & Decision Spec v1.1)  
**Last Updated:** 2026-01-06

---

## 1. Abstract

This RFC defines how **organizational scope isolation** works **in the presence of Decision Specs**.

RFC-002 ensures that:
- Decision Specs are resolved within organizational boundaries
- Policies are bound to both **scope** and **spec**
- No policy can affect a decision outside its declared organizational context
- Governance remains auditable and deterministic

This RFC does **not** introduce SaaS tenancy.

---

## 2. Why RFC-002 Exists (Updated)

RFC-001 defines *what* a decision means.  
RFC-002 defines *where* that decision is allowed to apply organizationally.

Without RFC-002:
- Specs could be reused incorrectly across domains
- Policies could bleed across teams
- Ownership of governance decisions becomes unclear

RFC-002 adds **organizational grounding** to specs and policies.

---

## 3. Core Concepts

### 3.1 Organization

Top-level governance boundary.

- Exactly one organization in v1 (non-SaaS)
- `organization_id` is mandatory and explicit
- Forward-compatible with multi-org

---

### 3.2 Domain

Primary unit of isolation.

Examples:
- finance
- logistics
- hr

Domains are **not optional** once RFC-002 is enabled.

---

### 3.3 Scope (Spec-Aware)

A **Scope** defines *where* a spec and its policies apply.

Scope identity:

```
(organization_id, domain, service?, agent?)
```

Scopes are now **binding points for specs and policies**.

---

## 4. Decision Spec Binding (NEW)

### 4.1 Spec Resolution Constraint

A Decision Spec MUST be resolved using:

- organization_id
- domain
- intent
- stage

A spec resolved for one domain MUST NOT be reused in another domain.

---

### 4.2 Spec Ownership

Each spec implicitly belongs to:
- exactly one organization
- exactly one domain

This ownership is enforced at resolution time.

---

## 5. Policy Binding Rules (Updated)

Policies MUST now reference:

```ts
policy.spec_id: string
policy.scope_id: string
```

Rules:
- A policy applies to **one spec only**
- A policy cannot reference multiple specs
- A policy cannot exist without a scope
- A policy cannot cross domains

This prevents logical policy bleed.

---

## 6. Scope Ownership

Every scope MUST declare:

- owning_team
- owner_contact (or group)
- description

Ownership is used for:
- audit explanation
- escalation routing
- incident review

Ownership does NOT grant override powers.

---

## 7. Evaluation Flow (Spec + Scope)

At evaluation time:

1. Resolve spec (RFC-001)
2. Resolve scope (RFC-002)
3. Select policies where:
   - policy.spec_id == spec.spec_id
   - policy.scope matches decision attribution
4. Evaluate policies
5. Resolve verdict severity (RFC-001)

Any mismatch → evaluation failure.

---

## 8. Isolation Guarantees

Mandate MUST guarantee:

- Specs do not cross domains
- Policies do not cross specs
- Policies do not cross domains
- Decisions are evaluated only within their scope

Violation of any rule is a **hard error**.

---

## 9. Decision Attribution (Strict)

Every DecisionEvent MUST include:

- organization_id
- domain
- intent
- stage

Missing attribution:
- evaluation MUST fail safely
- verdict defaults to OBSERVE
- audit entry MUST record failure

---

## 10. Observability Implications

The UI MUST show:

- spec_id + version
- domain
- scope ownership
- matched policies

Cross-domain aggregation is forbidden by default.

---

## 11. Non-Goals

This RFC does NOT define:
- SaaS tenancy
- IAM / auth
- Cross-org governance
- Spec authoring workflows

---

## 12. Invariants

1. Specs are domain-bound
2. Policies are spec-bound
3. Policies are scope-bound
4. Decisions are spec + scope evaluated
5. Cross-domain effects are impossible

---

## 13. Summary

RFC-002 grounds Decision Specs inside organizational reality.

It ensures that:
- governance is local
- ownership is explicit
- isolation is deterministic
- future SaaS evolution remains possible

---

**End of RFC-002 v1.1**
