# RFC-002: Organizational Scope & Governance Isolation (Non-SaaS)

**Status:** Draft  
**Version:** v1.0  
**Applies To:** Internal / On-Prem / Non-SaaS Deployments  
**Related RFCs:**  
- RFC-001: Mandate AI Control Plane v1  
- RFC-003: Mandate Observability & Audit UI  

**Last Updated:** 2026-01-06

---

## 1. Abstract

This RFC defines how **Mandate** supports **organizational isolation, scope ownership, and governance boundaries** in a **non-SaaS, internal deployment**.

RFC-002 does **not** define SaaS tenancy, billing, or customer isolation.  
Instead, it formalizes **logical boundaries inside a single organization** so that:

- Policies do not collide across domains
- Ownership and accountability are explicit
- Verdicts are explainable in organizational context
- Governance remains defensible as Mandate adoption grows

---

## 2. Motivation

Mandate is designed to be used across:

- Multiple departments (Finance, Logistics, HR, etc.)
- Multiple platforms and projects
- Multiple AI agents with different risk profiles

Without formal organizational isolation:
- Policies may apply unintentionally
- Teams may override each other’s constraints
- Audit explanations become ambiguous
- Responsibility becomes unclear during incidents

This RFC ensures Mandate remains **governable, explainable, and trustworthy** as usage expands.

---

## 3. Non-Goals (Explicit)

This RFC does NOT define:
- SaaS tenancy or customer billing
- Multi-cloud or hosted isolation
- IAM or authentication models
- Infrastructure deployment patterns
- Commercial or contractual boundaries

Those concerns are intentionally out of scope.

---

## 4. Core Concepts

### 4.1 Organization

An **Organization** represents the top-level governance boundary.

Characteristics:
- Exactly one organization in non-SaaS v1
- All decisions, policies, and scopes belong to this organization
- Organization boundaries are logical, not infrastructural

An `organization_id` field exists for forward compatibility, even if constant in v1.

---

### 4.2 Domain

A **Domain** represents a functional or business area within the organization.

Examples:
- finance
- logistics
- hr
- compliance

Domains are the primary unit of **policy isolation**.

---

### 4.3 Scope Hierarchy

Scopes are hierarchical and contextual.

Example hierarchy:

```
Organization
 └── Domain
      └── Service
           └── Agent
```

Scopes become more specific as they move down the hierarchy.

---

## 5. Scope Ownership

Every scope MUST declare ownership metadata:

- owning_team
- owner_contact (or group)
- description

Ownership is used for:
- Audit explanations
- Incident reviews
- Change accountability

Ownership does NOT imply enforcement authority.

---

## 6. Policy Association

Policies MUST be associated with exactly one scope.

Rules:
- Policies cannot exist without a scope
- Policies cannot span multiple domains
- Cross-domain policies are forbidden in v1

This prevents accidental policy bleed.

---

## 7. Policy Precedence Rules

When multiple policies match a DecisionEvent, precedence is resolved as follows:

1. Agent-level policy
2. Service-level policy
3. Domain-level policy
4. Organization-level policy (if any)

Verdict severity still follows RFC-001:

```
BLOCK > PAUSE > ALLOW > OBSERVE
```

Precedence affects **which policies are evaluated**, not verdict dominance.

---

## 8. Decision Attribution

Every DecisionEvent MUST include sufficient context to determine:

- organization_id
- domain
- service (if applicable)
- agent identifier

If attribution is incomplete:
- Evaluation MUST fail safely
- Verdict SHOULD default to OBSERVE
- Audit timeline MUST record missing context

---

## 9. Isolation Guarantees

Mandate MUST guarantee that:

- Policies from one domain cannot affect another domain’s decisions
- UI queries are domain-filterable
- Exports preserve domain and ownership context
- Audit trails remain domain-consistent

---

## 10. Observability Implications

The Observability UI (RFC-003) MUST:

- Display domain and ownership context
- Allow filtering by domain
- Preserve scope hierarchy in explanations
- Avoid cross-domain aggregation without explicit intent

---

## 11. Migration & Evolution

This RFC is designed to evolve safely.

Future extensions MAY:
- Introduce multiple organizations
- Add formal tenancy
- Introduce delegated policy administration

Such changes MUST:
- Preserve historical audit integrity
- Not re-evaluate past verdicts
- Require new RFCs

---

## 12. Success Criteria

RFC-002 is considered successfully implemented when:

- Domains are isolated logically
- Policy ownership is explicit
- Verdict explanations include organizational context
- No cross-domain policy bleed is possible
- Future SaaS evolution remains feasible

---

## 13. Summary

RFC-002 ensures Mandate scales **organizationally before it scales technically**.

By formalizing scope, ownership, and isolation early, Mandate remains:
- Trustworthy
- Auditable
- Politically neutral between teams
- Future-proof

This RFC applies regardless of deployment model.

---

**End of RFC-002**
