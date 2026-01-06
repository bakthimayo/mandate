# Scope Model Schema v1

## 1. Purpose

The **Scope Model** defines **where a policy applies** in the AI Control Plane.

It answers one precise question:

> **Which part of the organization or system does this policy govern?**

Scopes are used to:

* Limit blast radius
* Enable decentralized governance
* Avoid global, brittle specs
* Support real enterprise adoption

---

## 2. Core Principle (Non‑Negotiable)

> **Scopes describe *blast radius*, not org charts.**

They are:

* Technical
* Declarative
* Composable

They are NOT:

* Departments
* Projects
* Workflows
* Ownership trees

---

## 3. Scope as a Selector (Mental Model)

A scope behaves like a **selector**, similar to:

* Kubernetes labels
* IAM resource conditions

Policies apply when a DecisionEvent **matches the scope selector**.

---

## 4. Canonical Scope Dimensions

Scopes are defined across a small, fixed set of **dimensions**.

All dimensions are **optional**. Absence means "match all".

### 4.1 Allowed Scope Dimensions (v1)

| Dimension     | Description              | Example                |
| ------------- | ------------------------ | ---------------------- |
| `domain`      | Business domain          | `logistics`, `finance` |
| `service`     | Executing service        | `invoice-service`      |
| `agent`       | AI agent identifier      | `rfq_agent_v3`         |
| `system`      | External/internal system | `SAP`, `Oracle`        |
| `environment` | Runtime environment      | `prod`, `staging`      |
| `tenant`      | Organization boundary    | `tenant_42`            |

No custom dimensions allowed in v1.

---

## 5. Canonical Scope Schema

```json
{
  "scope_id": "scope-uuid",

  "selector": {
    "domain": "logistics",
    "service": "invoice-service",
    "environment": "prod"
  },

  "description": "Production invoice approvals in logistics domain",

  "owner": {
    "team": "finance-ops",
    "contact": "finance-ops@company.com"
  },

  "created_at": "2026-01-06T00:00:00Z",
  "schema_version": "1.0"
}
```

---

## 6. Scope Matching Semantics

A DecisionEvent **matches a scope** if:

* All fields present in `scope.selector`
* Are equal to corresponding fields in the DecisionEvent

### Example

Scope:

```json
{ "service": "invoice-service", "environment": "prod" }
```

DecisionEvent context:

```json
{ "metadata": { "system": "invoice-service", "env": "prod" } }
```

➡ Match = true

---

## 7. Scope Resolution Order

Policies may exist at different scopes.

When multiple scoped policies match, **all are evaluated**.

Final verdict is resolved using:

```
BLOCK > PAUSE > ALLOW > OBSERVE
```

Scopes do NOT override each other — **verdict precedence does**.

---

## 8. Global Scope

A policy with an **empty selector** applies globally.

```json
{ "selector": {} }
```

Use sparingly.

---

## 9. Why Projects Are Not First‑Class

Projects:

* Are transient
* Overlap systems
* Change ownership

If needed, `project` may appear as:

* a metadata field
* a selector value (later)

But it is intentionally excluded from v1.

---

## 10. Anti‑Patterns (Explicit)

❌ Nested scopes
❌ Hierarchical inheritance
❌ Department‑based selectors
❌ Workflow‑specific scopes
❌ Dynamic scope mutation

These lead to governance deadlocks.

---

## 11. Example Policies Using Scopes

### Narrow, Local Policy

```yaml
intent: approve_invoice
stage: pre_commit
scope:
  service: invoice-service
  environment: prod
conditions:
  - amount > 100000
verdict: PAUSE
```

### Broad Domain Policy

```yaml
intent: export_data
stage: executed
scope:
  domain: logistics
conditions:
  - region == 'EU'
verdict: OBSERVE
```

---

## 12. Summary

The Scope Model:

* Enables decentralized control
* Prevents global policy fragility
* Aligns governance with blast radius
* Keeps the control plane generic

> **Policies don’t belong to teams. They belong to scopes.**

---

*End of document*
