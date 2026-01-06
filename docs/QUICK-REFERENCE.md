# RFC-002 Quick Reference Card

**For:** Sample Specs, Policies & Testing  
**Status:** Ready to Use  
**Last Updated:** 2026-01-07

---

## Sample Data Identifiers

### Organization
```
ID: 550e8400-e29b-41d4-a716-446655440000
Name: example-org
Domain: config-management (ID: 550e8400-e29b-41d4-a716-446655440001)
```

### Specs (5 Total, All Active)

| Spec ID | Intent | Stage | Verdicts | Type |
|---------|--------|-------|----------|------|
| `spec-pre-commit-file-write-v1` | file.write | pre_commit | ALLOW/PAUSE/BLOCK/OBSERVE | Pre-prevention |
| `spec-pre-commit-database-drop-table-v1` | database.drop_table | pre_commit | ALLOW/PAUSE/BLOCK/OBSERVE | Pre-prevention |
| `spec-executed-user-login-v1` | user.login | executed | OBSERVE | Audit-only |
| `spec-executed-data-export-v1` | data.export | executed | OBSERVE | Audit-only |
| `spec-executed-config-update-v1` | config.update | executed | OBSERVE | Audit-only |

### Scopes (3 Total)

| Scope ID | Agent | Service | Environment | Owner |
|----------|-------|---------|-------------|-------|
| `550e8400-e29b-41d4-a716-446655440100` | pre-commit-agent | config-writer | production | config-team |
| `550e8400-e29b-41d4-a716-446655440101` | pause-escalation-agent | db-admin-tool | production | dba-team |
| `550e8400-e29b-41d4-a716-446655440102` | observe-agent | audit-logger | (none) | audit-team |

### Policies (8 Total, 3 Snapshots)

#### Snapshot 1: File Write (ID: `550e8400-e29b-41d4-a716-446655440200`)

| Policy ID | Verdict | Conditions |
|-----------|---------|-----------|
| `policy-allow-small-files-v1` | ALLOW | content_length < 1MB, type in [yaml/json/toml] |
| `policy-pause-large-files-v1` | PAUSE | content_length >= 1MB |

#### Snapshot 2: Database (ID: `550e8400-e29b-41d4-a716-446655440201`)

| Policy ID | Verdict | Conditions |
|-----------|---------|-----------|
| `policy-block-unbackedup-drops-v1` | BLOCK | backup_first == false |
| `policy-pause-critical-db-ops-v1` | PAUSE | risk_level == "critical" |
| `policy-allow-low-risk-drops-v1` | ALLOW | risk_level == "low" && reversible == true |

#### Snapshot 3: Audit (ID: `550e8400-e29b-41d4-a716-446655440202`)

| Policy ID | Verdict | Spec |
|-----------|---------|------|
| `policy-observe-user-login-v1` | OBSERVE | spec-executed-user-login-v1 |
| `policy-observe-data-exports-v1` | OBSERVE | spec-executed-data-export-v1 |
| `policy-observe-config-updates-v1` | OBSERVE | spec-executed-config-update-v1 |

---

## Quick Commands

### Setup
```bash
# Apply sample data
pnpm db:migrate

# Verify setup
psql $DATABASE_URL -c "SELECT COUNT(*) FROM mandate.mandate_specs;"
# Expected: 5
```

### Run Agents
```bash
pnpm run examples:pre-commit-agent
pnpm run examples:pause-escalation-agent
pnpm run examples:observe-agent
```

### Test Decisions via API
```bash
# Small file (ALLOW)
curl -X POST http://localhost:3000/api/v1/decisions \
  -H "Content-Type: application/json" \
  -d '{
    "organization_id": "550e8400-e29b-41d4-a716-446655440000",
    "intent": "file.write",
    "stage": "pre_commit",
    "actor": "pre-commit-agent",
    "target": "/test/file.yaml",
    "context": {"content_length": 500, "content_type": "yaml"},
    "scope": {
      "domain": "config-management",
      "service": "config-writer",
      "agent": "pre-commit-agent",
      "environment": "production"
    }
  }'
# Expected: verdict = ALLOW

# Large file (PAUSE)
curl -X POST http://localhost:3000/api/v1/decisions \
  -H "Content-Type: application/json" \
  -d '{
    "organization_id": "550e8400-e29b-41d4-a716-446655440000",
    "intent": "file.write",
    "stage": "pre_commit",
    "actor": "pre-commit-agent",
    "target": "/test/file.yaml",
    "context": {"content_length": 5000000, "content_type": "yaml"},
    "scope": {
      "domain": "config-management",
      "service": "config-writer",
      "agent": "pre-commit-agent",
      "environment": "production"
    }
  }'
# Expected: verdict = PAUSE
```

### Verify Data
```bash
# Check specs
psql $DATABASE_URL -c "
  SELECT spec_id, intent, stage, status 
  FROM mandate.mandate_specs 
  ORDER BY created_at;"

# Check scopes
psql $DATABASE_URL -c "
  SELECT scope_id, agent, service, owning_team 
  FROM mandate.scopes 
  WHERE organization_id = '550e8400-e29b-41d4-a716-446655440000'::UUID;"

# Check policies
psql $DATABASE_URL -c "
  SELECT snapshot_id, version, jsonb_array_length(policies) as policy_count
  FROM mandate.policy_snapshots 
  WHERE organization_id = '550e8400-e29b-41d4-a716-446655440000'::UUID;"

# Check verdicts
psql $DATABASE_URL -c "
  SELECT decision_id, verdict, spec_id, scope_id, matched_policy_ids
  FROM mandate.verdict_events
  WHERE organization_id = '550e8400-e29b-41d4-a716-446655440000'::UUID
  ORDER BY created_at DESC
  LIMIT 5;"
```

### Reset
```bash
pnpm db:reset
pnpm db:migrate
```

---

## RFC-002 Compliance Checklist

- ✅ Specs are immutable (status = active, append-only)
- ✅ Policies have spec_id (required, spec is active)
- ✅ Policies have scope_id (required, scope exists)
- ✅ Scope domain = Spec domain
- ✅ Scope org_id = Spec org_id
- ✅ Verdicts include spec_id, spec_version, scope_id, domain
- ✅ Audit timeline includes all verdict fields
- ✅ No cross-domain policy leakage possible
- ⏳ TODO 1: Scope ID resolution in decision evaluation
- ⏳ TODO 2: Owning team resolution in decision evaluation

---

## Expected Behavior

### Pre-Commit Agent (file.write @ pre_commit)

**Small file (< 1MB, safe type):**
```
Request → Spec resolved → Scope matched → Policies evaluated
→ ALLOW (policy-allow-small-files-v1) → File written ✅
```

**Large file (>= 1MB):**
```
Request → Spec resolved → Scope matched → Policies evaluated
→ PAUSE (policy-pause-large-files-v1) → Awaiting approval ⏸️
```

### Pause-Escalation Agent (database.drop_table @ pre_commit)

**Without backup:**
```
Request → BLOCK (policy-block-unbackedup-drops-v1) → Rejected ❌
```

**Critical risk level:**
```
Request → PAUSE (policy-pause-critical-db-ops-v1) → Escalated ⏸️
```

**Low risk + reversible:**
```
Request → ALLOW (policy-allow-low-risk-drops-v1) → Executed ✅
```

### Observe-Only Agent (user.login, data.export, config.update @ executed)

**All actions:**
```
Request → Spec resolved (executed stage) → Verdict = OBSERVE
→ Logged to audit trail 📝
```

---

## Common Issues & Fixes

### Issue: No scope matches
**Solution:** Ensure decision.scope includes domain and matches a scope's selectors

### Issue: Spec not found
**Solution:** Verify intent, stage, and domain are correct for the organization

### Issue: Policy not matched
**Solution:** Check context values against policy conditions (exact match required)

### Issue: Verdict is wrong
**Solution:** Check verdict precedence: BLOCK > PAUSE > ALLOW > OBSERVE

### Issue: Audit timeline empty
**Solution:** Verdicts only create audit entries if spec and scope resolve correctly

---

## Documentation Index

| Document | Purpose |
|----------|---------|
| `RFC-002-Spec-Aware-Scope-Isolation-v1.1.md` | Specification (governance rules) |
| `BUILD-PLAN-RFC-002-v1.1.md` | Build plan (implementation guidance) |
| `SAMPLE-SPECS-AND-POLICIES.md` | Complete reference (all 5 specs, 3 scopes, 8 policies) |
| `TESTING-CHECKLIST.md` | 17 test cases (comprehensive verification) |
| `TODO-RESOLUTIONS.md` | Implementation guide (scope resolution design) |
| `RFC-002-IMPLEMENTATION-STATUS.md` | Status tracking (current progress) |
| `QUICK-REFERENCE.md` | This file (IDs and commands) |

---

## Scope Selectors (For TODO 1 Implementation)

These fields in decision.scope are used for scope matching:

```
decision.scope = {
  domain: "config-management"      // REQUIRED
  service?: "config-writer"        // Optional
  agent?: "pre-commit-agent"       // Optional
  environment?: "production"       // Optional
  system?: string                  // Optional
}
```

Matching rule: All provided selectors must match a scope record (exact match, no wildcards).

---

## Verdict Precedence

If multiple policies match a single decision:

1. **BLOCK** - Prevents action (highest priority)
2. **PAUSE** - Requires escalation
3. **ALLOW** - Permits action
4. **OBSERVE** - Logs action only (lowest priority)

Example: If one policy says ALLOW and another says BLOCK, final verdict is **BLOCK**.

---

## Files to Know

### Migration
- `migrations/006_sample_specs_and_policies.sql` - Sample data (apply with `pnpm db:migrate`)

### Example Agents
- `packages/examples/src/pre-commit-agent.ts` - File write control
- `packages/examples/src/pause-escalation-agent.ts` - Escalation flow
- `packages/examples/src/observe-agent.ts` - Audit logging

### Routes
- `packages/server/src/routes/decisions.ts` - Decision evaluation (TODO 1 & 2 here)

### Schemas
- `packages/shared/src/schemas.ts` - Type definitions (DecisionSpec, Policy, etc.)

---

**Quick ref v1.0 | Last Updated: 2026-01-07**
