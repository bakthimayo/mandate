# BUILD-PLAN-RFC-002: Spec-Aware Organizational Scope & Governance Isolation

**Status:** Approved  
**Version:** v1.1  
**Aligned RFCs:** RFC-001 v1.1, RFC-002 v1.1  
**Deployment Model:** Non-SaaS / Internal  
**Last Updated:** 2026-01-06

---

## 1. Purpose

This build plan operationalizes **RFC-002 v1.1**.

It ensures:
- Specs are resolved within organizational scope
- Policies are bound to specs and scopes
- No cross-domain or cross-spec leakage is possible

---

## 2. Hard Constraints

1. Single deployment, single DB
2. Logical isolation only
3. No re-evaluation of historical decisions
4. Specs are immutable
5. Policies are spec-bound

---

## 3. Shared Types (Updated)

### 3.1 Scope

```ts
scope_id: string
organization_id: string
domain: string
service?: string
agent?: string

owning_team: string
owner_contact?: string
description?: string
```

---

### 3.2 Policy (Updated)

```ts
policy_id: string
spec_id: string        // REQUIRED
scope_id: string       // REQUIRED
conditions: Condition[]
effect: Verdict
```

Rules:
- Missing spec_id → invalid policy
- Missing scope_id → invalid policy

---

## 4. Database Changes

### 4.1 Scopes Table

```sql
CREATE TABLE scopes (
  scope_id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  domain TEXT NOT NULL,
  service TEXT NULL,
  agent TEXT NULL,
  owning_team TEXT NOT NULL,
  owner_contact TEXT NULL,
  description TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);
```

Unique constraint:
```
(organization_id, domain, service, agent)
```

---

### 4.2 Policies Table (Extension)

Ensure columns exist:
- spec_id
- scope_id

Foreign-key-like validation enforced in code (v1).

---

## 5. Startup Validation (Mandatory)

On server startup:

1. Load all specs
2. Load all scopes
3. Load all policies
4. Validate:
   - policy.spec_id exists
   - policy.scope_id exists
   - spec.domain == scope.domain
   - spec.organization_id == scope.organization_id

Any failure → startup aborts.

---

## 6. Evaluation-Time Rules

For every decision:

1. Resolve spec (RFC-001)
2. Resolve scope
3. Select policies:
   - matching spec_id
   - matching scope hierarchy
4. Evaluate policies
5. Resolve verdict

No fallback behavior allowed.

---

## 7. Audit Timeline Requirements

Each verdict entry MUST include:
- spec_id
- spec_version
- scope_id
- domain
- owning_team

This ensures explainability.

---

## 8. API Guardrails

All read APIs MUST:
- require organization_id
- support domain filtering
- never return cross-domain data by default

---

## 9. Implementation Order

1. Update shared types
2. Add scope + policy schema changes
3. Add startup validation
4. Update evaluator policy selection
5. Update audit timeline fields
6. Update UI filters

---

## 10. Validation Checklist

- [ ] Policy without spec_id rejected
- [ ] Policy without scope_id rejected
- [ ] Spec-domain mismatch rejected
- [ ] Cross-domain policy impossible
- [ ] Historical verdicts unchanged

---

## 11. Summary

This build plan makes RFC-002 **spec-aware and audit-safe**.

Specs define *what* may be decided.  
Scopes define *where*.  
Policies define *how* — but only within those bounds.

---

**End of BUILD-PLAN-RFC-002 v1.1**
