# BUILD-PLAN-RFC-002: Organizational Scope & Governance Isolation (Non-SaaS)

**Status:** Approved  
**Version:** v1.0  
**Applies To:** Internal / On-Prem Deployments  
**Aligned RFCs:** RFC-001, RFC-002, RFC-003  
**Last Updated:** 2026-01-06

---

## 1. Purpose

This build plan defines how to implement **RFC-002** in Mandate.

RFC-002 introduces **organizational scope isolation** for a **non-SaaS** system.  
It ensures that policies, decisions, and verdicts do not collide across internal domains while preserving auditability and future extensibility.

This plan is **codegen-safe** and designed for use with Cursor or other AI tools.

---

## 2. Hard Constraints (Non-Negotiable)

1. This is **not** SaaS
   - No tenants
   - No customers
   - No billing or plans

2. Isolation is **logical**, not infrastructural
   - One deployment
   - One database
   - Multiple domains

3. No retroactive impact
   - Historical verdicts are immutable
   - No re-evaluation of past decisions

---

## 3. Shared Package Changes (Types Only)

### 3.1 DecisionEvent

Add mandatory attribution fields:

```ts
organization_id: string
domain: string
service?: string
agent_id: string
```

Rules:
- No defaults
- Missing fields cause validation failure
- organization_id may be constant in v1

---

### 3.2 Scope

```ts
organization_id: string
domain: string
service?: string
agent?: string

owning_team: string
owner_contact?: string
description?: string
```

Rules:
- Scope uniquely identified by (organization_id, domain, service, agent)
- Scope ownership is mandatory

---

### 3.3 Policy

```ts
scope_id: string // REQUIRED
```

Rules:
- Policies cannot exist without a scope
- Cross-scope or cross-domain policies are forbidden

---

## 4. Database Schema Extensions

### 4.1 Scopes Table

Add columns:

```sql
organization_id TEXT NOT NULL
domain TEXT NOT NULL
service TEXT NULL
agent TEXT NULL
owning_team TEXT NOT NULL
owner_contact TEXT NULL
```

Constraints:
- Unique index on (organization_id, domain, service, agent)
- Insert-only (no UPDATE)

---

### 4.2 Decision & Verdict Tables

Ensure columns exist for:

- organization_id
- domain

These fields must be queryable and indexed.

---

## 5. Evaluator Changes (Minimal & Strict)

### 5.1 Scope Matching Invariant

A DecisionEvent may match a scope **only if**:

```text
decision.organization_id == scope.organization_id
decision.domain == scope.domain
```

Service and agent matching remain progressive and optional.

No fallback or wildcard behavior is allowed for organization or domain.

---

### 5.2 Policy Validation at Startup

On server startup:

- Every policy must reference a valid scope
- The scope must belong to exactly one organization and domain
- Failure prevents startup

This is a **hard failure**, not a warning.

---

## 6. Policy Precedence (RFC-002 Layer)

Policy applicability is resolved by **scope specificity**:

1. Agent-level scope
2. Service-level scope
3. Domain-level scope
4. Organization-level scope (optional)

After applicable policies are selected, verdict severity is resolved using RFC-001:

```text
BLOCK > PAUSE > ALLOW > OBSERVE
```

---

## 7. API Guardrails

### 7.1 Read APIs

All list/query APIs MUST:

- Accept organization_id
- Default to a single org in v1
- Never return cross-domain data unintentionally

---

## 8. Observability UI Alignment

The UI must:

- Display organization_id and domain
- Allow filtering by domain
- Show scope ownership in verdict explanations

The UI must NOT:
- Allow domain switching that hides context
- Aggregate data across domains by default

---

## 9. Migration Strategy

If introducing RFC-002 into an existing system:

1. Backfill:
   - organization_id = "default"
   - domain = "unknown"
2. Record migration as a system audit entry
3. Do not silently assume missing values

---

## 10. Implementation Order

1. Update shared types
2. Add DB migrations
3. Add evaluator invariants
4. Add policy startup validation
5. Update APIs
6. Update UI types & filters

---

## 11. Validation Checklist

RFC-002 implementation is complete when:

- [ ] Policies cannot cross domains
- [ ] Scope ownership is visible
- [ ] Evaluator rejects missing attribution
- [ ] UI preserves organizational context
- [ ] Historical verdicts remain untouched

---

## 12. Summary

RFC-002 ensures Mandate scales **organizationally before it scales technically**.

This build plan enforces:
- Clear ownership
- Deterministic isolation
- Audit-safe evolution
- Future extensibility without redesign

---

**End of BUILD-PLAN-RFC-002**
