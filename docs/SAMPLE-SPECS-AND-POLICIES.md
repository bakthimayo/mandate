# Sample Decision Specs and Policies for Example Agents

**Status:** Ready for Testing  
**RFC Alignment:** RFC-002 v1.1 (Spec-Aware Scope Isolation)  
**Last Updated:** 2026-01-07

## Overview

This document describes the sample Decision Specs and Policies created in migration `006_sample_specs_and_policies.sql` for testing the three example agents:

1. **pre-commit-agent** - Prevents action before execution
2. **pause-escalation-agent** - Allows pausing critical operations for human review
3. **observe-agent** - Logs actions after they occur for audit trails

## RFC-002 Compliance

All sample specs and policies strictly follow RFC-002 (Spec-Aware Scope Isolation):

- ✅ **Every policy has spec_id** - Bound to exactly one DecisionSpec
- ✅ **Every policy has scope_id** - Bound to exactly one Scope  
- ✅ **Scope domain matches spec domain** - All in `config-management` domain
- ✅ **Organization consistency** - All use org_id `550e8400-e29b-41d4-a716-446655440000`
- ✅ **Spec versioning** - All specs have version `1`, status `active`

---

## Decision Specs

### 1. Pre-Commit Agent Specs

#### Spec: `file.write` @ `pre_commit` stage

**ID:** `spec-pre-commit-file-write-v1`

**Purpose:** Govern file write operations before commit.

**Allowed Verdicts:** `ALLOW`, `BLOCK`, `PAUSE`, `OBSERVE`

**Signals Declared:**
- `content_length` (number, context) - Size of file to write
- `content_type` (string, context) - MIME type or format
- `target` (string, scope) - File path
- `service` (string, scope) - Writing service name

**Enforcement:**
- `pause_requires`: `["compliance-review"]`
- `resolution_timeout_minutes`: `60`

---

### 2. Pause-Escalation Agent Spec

#### Spec: `database.drop_table` @ `pre_commit` stage

**ID:** `spec-pre-commit-database-drop-table-v1`

**Purpose:** Govern destructive database operations.

**Allowed Verdicts:** `ALLOW`, `BLOCK`, `PAUSE`, `OBSERVE`

**Signals Declared:**
- `risk_level` (enum: "low" | "medium" | "high" | "critical", context)
- `reversible` (boolean, context) - Can operation be undone?
- `backup_first` (boolean, context) - Was backup taken?
- `target` (string, scope) - Table to drop

**Enforcement:**
- `pause_requires`: `["dba-approval", "compliance-review"]`
- `resolution_timeout_minutes`: `120`

---

### 3. Observe-Only Agent Specs

#### Spec: `user.login` @ `executed` stage

**ID:** `spec-executed-user-login-v1`

**Purpose:** Log user authentication events after execution.

**Allowed Verdicts:** `OBSERVE` (read-only)

**Signals Declared:**
- `user_id` (string, context)
- `ip_address` (string, context)
- `auth_method` (enum: "password" | "oauth" | "mfa", context)

#### Spec: `data.export` @ `executed` stage

**ID:** `spec-executed-data-export-v1`

**Purpose:** Audit data export operations.

**Allowed Verdicts:** `OBSERVE` (read-only)

**Signals Declared:**
- `format` (enum: "csv" | "json" | "parquet", context)
- `record_count` (number, context)
- `includes_pii` (boolean, context) - Contains personally identifiable info

#### Spec: `config.update` @ `executed` stage

**ID:** `spec-executed-config-update-v1`

**Purpose:** Track all configuration changes.

**Allowed Verdicts:** `OBSERVE` (read-only)

**Signals Declared:**
- `key` (string, context) - Config key changed
- `old_value` (string, context)
- `new_value` (string, context)

---

## Scopes

Three scopes define where policies apply:

### Scope 1: Pre-Commit Agent

**ID:** `550e8400-e29b-41d4-a716-446655440100`

**Matching Criteria:**
- `domain`: `config-management`
- `service`: `config-writer`
- `agent`: `pre-commit-agent`
- `environment`: `production`

**Ownership:** `config-team` (config-team@example.com)

**Purpose:** Policies for file write operations by pre-commit-agent.

---

### Scope 2: Pause-Escalation Agent

**ID:** `550e8400-e29b-41d4-a716-446655440101`

**Matching Criteria:**
- `domain`: `config-management`
- `service`: `db-admin-tool`
- `agent`: `pause-escalation-agent`
- `environment`: `production`

**Ownership:** `dba-team` (dba-team@example.com)

**Purpose:** Policies for database operations by pause-escalation-agent.

---

### Scope 3: Observe-Only Agent

**ID:** `550e8400-e29b-41d4-a716-446655440102`

**Matching Criteria:**
- `domain`: `config-management`
- `service`: `audit-logger`
- `agent`: `observe-agent`

**Ownership:** `audit-team` (audit-team@example.com)

**Purpose:** Policies for audit logging operations.

---

## Policies

All policies are grouped into immutable **policy snapshots**. Three snapshots are created:

### Snapshot 1: File Write Policies

**Snapshot ID:** `550e8400-e29b-41d4-a716-446655440200`

#### Policy: `policy-allow-small-files-v1`

**Verdict:** `ALLOW`

**Conditions:**
- `content_length < 1048576` (less than 1MB)
- `content_type in ["yaml", "json", "toml"]`

**Matched By:** Spec `spec-pre-commit-file-write-v1`, Scope `pre-commit-agent`

**Purpose:** Allow small, safe configuration files through without review.

#### Policy: `policy-pause-large-files-v1`

**Verdict:** `PAUSE`

**Conditions:**
- `content_length >= 1048576` (1MB or larger)

**Matched By:** Spec `spec-pre-commit-file-write-v1`, Scope `pre-commit-agent`

**Purpose:** Require human review for large files.

---

### Snapshot 2: Database Operation Policies

**Snapshot ID:** `550e8400-e29b-41d4-a716-446655440201`

#### Policy: `policy-block-unbackedup-drops-v1`

**Verdict:** `BLOCK`

**Conditions:**
- `backup_first == false`

**Matched By:** Spec `spec-pre-commit-database-drop-table-v1`, Scope `pause-escalation-agent`

**Purpose:** Prevent destructive operations without backup.

#### Policy: `policy-pause-critical-db-ops-v1`

**Verdict:** `PAUSE`

**Conditions:**
- `risk_level == "critical"`

**Matched By:** Spec `spec-pre-commit-database-drop-table-v1`, Scope `pause-escalation-agent`

**Purpose:** Escalate critical operations for DBA approval.

#### Policy: `policy-allow-low-risk-drops-v1`

**Verdict:** `ALLOW`

**Conditions:**
- `risk_level == "low"`
- `reversible == true`

**Matched By:** Spec `spec-pre-commit-database-drop-table-v1`, Scope `pause-escalation-agent`

**Purpose:** Allow low-risk, reversible operations to proceed automatically.

---

### Snapshot 3: Audit Observation Policies

**Snapshot ID:** `550e8400-e29b-41d4-a716-446655440202`

#### Policy: `policy-observe-user-login-v1`

**Verdict:** `OBSERVE`

**Conditions:**
- `auth_method in ["password", "oauth", "mfa"]`

**Matched By:** Spec `spec-executed-user-login-v1`, Scope `observe-agent`

#### Policy: `policy-observe-data-exports-v1`

**Verdict:** `OBSERVE`

**Conditions:**
- `format in ["csv", "json", "parquet"]`

**Matched By:** Spec `spec-executed-data-export-v1`, Scope `observe-agent`

#### Policy: `policy-observe-config-updates-v1`

**Verdict:** `OBSERVE`

**Conditions:** (always matches)

**Matched By:** Spec `spec-executed-config-update-v1`, Scope `observe-agent`

---

## Testing Workflow

### Apply the Migration

```bash
pnpm db:migrate
```

This applies `006_sample_specs_and_policies.sql`, creating all specs, scopes, and policies.

### Verify Database Setup

```sql
SELECT COUNT(*) FROM mandate.mandate_specs;
-- Expected: 5 specs

SELECT COUNT(*) FROM mandate.scopes WHERE organization_id = '550e8400-e29b-41d4-a716-446655440000'::UUID;
-- Expected: 3 scopes for example agents

SELECT COUNT(*) FROM mandate.policy_snapshots WHERE organization_id = '550e8400-e29b-41d4-a716-446655440000'::UUID;
-- Expected: 3 policy snapshots
```

### Run Pre-Commit Agent

```bash
pnpm run examples:pre-commit-agent
```

**Expected Flow:**
1. Agent requests decision for `file.write @ pre_commit`
2. Spec is resolved: `spec-pre-commit-file-write-v1`
3. Scope is matched: `pre-commit-agent` scope
4. Policies are evaluated:
   - If `content_length < 1MB` → **ALLOW** → file written ✅
   - If `content_length >= 1MB` → **PAUSE** → awaiting approval ⏸️

### Run Pause-Escalation Agent

```bash
pnpm run examples:pause-escalation-agent
```

**Expected Flow:**
1. Agent requests decision for `database.drop_table @ pre_commit`
2. Spec is resolved: `spec-pre-commit-database-drop-table-v1`
3. Scope is matched: `pause-escalation-agent` scope
4. Policies are evaluated:
   - If `backup_first == false` → **BLOCK** → operation rejected ❌
   - If `risk_level == "critical"` → **PAUSE** → awaiting DBA approval ⏸️
   - If `risk_level == "low" && reversible == true` → **ALLOW** → proceed ✅

### Run Observe-Only Agent

```bash
pnpm run examples:observe-agent
```

**Expected Flow:**
1. Agent reports `user.login @ executed`
2. Spec is resolved: `spec-executed-user-login-v1`
3. Verdict is **OBSERVE** → logged to audit timeline
4. Agent reports `data.export @ executed`
5. Spec is resolved: `spec-executed-data-export-v1`
6. Verdict is **OBSERVE** → logged to audit timeline
7. Agent reports `config.update @ executed`
8. Spec is resolved: `spec-executed-config-update-v1`
9. Verdict is **OBSERVE** → logged to audit timeline

---

## Verifying Verdict Matches Policy

After running agents, verify the verdicts match the policies:

### Query Decision Events

```sql
SELECT 
  d.decision_id,
  d.intent,
  d.stage,
  d.organization_id,
  d.spec_id,
  d.context
FROM mandate.decision_events d
WHERE d.organization_id = '550e8400-e29b-41d4-a716-446655440000'::UUID
ORDER BY d.created_at DESC;
```

### Query Verdict Events

```sql
SELECT 
  v.verdict_id,
  v.decision_id,
  v.verdict,
  v.spec_id,
  v.scope_id,
  v.matched_policy_ids,
  v.timestamp
FROM mandate.verdict_events v
WHERE v.organization_id = '550e8400-e29b-41d4-a716-446655440000'::UUID
ORDER BY v.created_at DESC;
```

### Verify Spec-Scope Binding

```sql
SELECT 
  p.id,
  p.verdict,
  p.spec_id,
  p.scope_id,
  s.scope_domain,
  s.service,
  s.agent,
  spec.intent,
  spec.stage
FROM mandate.policy_snapshots ps,
     jsonb_array_elements(ps.policies) AS p
CROSS JOIN mandate.mandate_specs spec ON spec.spec_id = p->>'spec_id'
CROSS JOIN mandate.scopes s ON s.scope_id = p->>'scope_id'
WHERE ps.organization_id = '550e8400-e29b-41d4-a716-446655440000'::UUID
ORDER BY ps.created_at DESC;
```

---

## Key Testing Points

### RFC-002 Compliance Verification

- [ ] Each policy has `spec_id` referencing an active spec
- [ ] Each policy has `scope_id` referencing an existing scope
- [ ] Spec domain matches scope domain
- [ ] Spec organization_id matches scope organization_id
- [ ] No cross-domain policy leakage possible
- [ ] Verdict events include `spec_id`, `scope_id`, and `domain`

### Decision Flow Verification

- [ ] Decision with matching intent/stage resolves to correct spec
- [ ] Spec resolution includes version for immutability
- [ ] Scope matching selects correct policies
- [ ] Conditions are evaluated against context signals
- [ ] Verdict is one of spec's `allowed_verdicts`
- [ ] Matched policy IDs appear in verdict event

### Agent-Specific Verification

- [ ] Pre-commit agent respects BLOCK verdict
- [ ] Pre-commit agent respects PAUSE verdict
- [ ] Pause-escalation agent polls for resolution
- [ ] Observe agent logs OBSERVE verdicts correctly
- [ ] Audit timeline includes spec_id and scope_id

---

## Cleanup and Reset

To clear all test data:

```sql
DELETE FROM mandate.audit_timeline_entries 
WHERE organization_id = '550e8400-e29b-41d4-a716-446655440000'::UUID;

DELETE FROM mandate.verdict_events 
WHERE organization_id = '550e8400-e29b-41d4-a716-446655440000'::UUID;

DELETE FROM mandate.decision_events 
WHERE organization_id = '550e8400-e29b-41d4-a716-446655440000'::UUID;
```

To remove specs and policies, you'll need to drop the schema and re-run all migrations (specs are append-only).

---

## Next Steps

1. **Apply migration 006** to populate specs, scopes, and policies
2. **Run example agents** to generate test decision/verdict events
3. **Verify verdicts match policies** using the SQL queries above
4. **Document any mismatches** for further investigation
5. **Update policies** by creating new policy snapshots (old ones remain immutable)

---

**End of SAMPLE-SPECS-AND-POLICIES.md**
