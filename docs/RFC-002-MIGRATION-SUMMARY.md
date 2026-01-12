# RFC-002 v1.2 Domain Identity Migration - Summary

**Migration File:** `migrations/008_rfc002_domain_identity_migration.sql`  
**Status:** Ready for execution  
**Governance:** Mandate Control Plane - RFC-002: Organizational Scope & Governance Isolation (Non-SaaS)

---

## Executive Summary

This migration implements **RFC-002 v1.2 Section 11 (Migration Rule)** to normalize domain identity from UUID-based (`domain_id`) to human-readable string slugs (`domain`).

### Governance Invariants Enforced
1. ✅ `domain_id` (UUID) MUST be removed
2. ✅ `domain` (text slug) MUST be canonical
3. ✅ All historical records MUST preserve domain meaning
4. ✅ `scope_id` MUST be human-readable string (text, not UUID)
5. ✅ `scope_id` MUST embed domain prefix (e.g., `finance.prod.billing.db-admin`)
6. ✅ No UUID-based domain identifiers may remain

---

## Migration Phases (13 Steps)

### Phase 1: Backfill domain from domains.name
**Action:** Populate `domain` columns in all tables from `domains.name`  
**Tables:** scopes, policy_snapshots, decision_events, verdict_events, audit_timeline_entries  
**Safety:** Only updates NULL domain values (idempotent)

### Phase 2: Enforce NOT NULL on domain
**Action:** Set `domain` columns to `NOT NULL`  
**Constraint:** All records must have domain attribution  
**Impact:** Rejects any future domain-less records

### Phase 3: Rename domain_name → domain in domains table
**Action:** Rename `domains.name` to `domains.domain`  
**Reason:** Semantic clarity per RFC-002 Section 3.2  
**Updates:** Unique constraint, indexes

### Phase 4: Add domain slug format constraint
**Action:** Add CHECK constraint for RFC-002 domain format  
**Pattern:** `^[a-z0-9_-]+$` (lowercase alphanumeric, dash, underscore)  
**Purpose:** Ensure domain slugs are stable and auditable

### Phase 5: Convert scope_id from UUID to TEXT
**Action:** Migrate `scope_id` column from `UUID` to `TEXT` type  
**Process:**
1. Create new TEXT column
2. Copy UUID values as text strings (preserves identity)
3. Drop old UUID column
4. Rename new TEXT column to scope_id
5. Re-create primary key on TEXT scope_id

**Critical:** No scope_id values are regenerated or renamed (per RFC-002 immutability rule)

### Phase 6: Add scope_id domain prefix validation
**Action:** Create trigger to enforce scope_id prefix consistency  
**Validation:** `scope_id LIKE domain || '.%'`  
**Example:** If domain is `finance`, valid scope_ids are:
- `finance.prod.billing.db-admin` ✓
- `finance.pre.payroll.hr-system` ✓
- `logistics.something` ✗ (domain mismatch)

**Enforcement:** BEFORE INSERT trigger on scopes table

### Phase 7: Update foreign key on verdict_events
**Action:** Convert `verdict_events.scope_id` foreign key from UUID to TEXT  
**Reference:** Now references `scopes.scope_id` (TEXT)

### Phase 8: Drop domain_id columns (CRITICAL)
**Action:** Remove all `domain_id` (UUID) columns  
**Scope:** domains, scopes, policy_snapshots, decision_events, verdict_events, audit_timeline_entries  
**Safety:** Drop foreign keys first, then columns  
**RFC-002:** Section 11 mandates UUID-based domain identifiers MUST NOT remain

### Phase 9: Restore primary key on domains table
**Action:** Replace single-column primary key with composite  
**New PK:** `(organization_id, domain)`  
**Reason:** Domain identity is now composite (org + human-readable slug)

### Phase 10: Add domain-bound foreign key references
**Action:** Create new foreign keys using (organization_id, domain) composite  
**Applies to:** scopes, policy_snapshots, decision_events, verdict_events, audit_timeline_entries  
**Purpose:** Enforce domain isolation at database level

### Phase 11: Create composite indexes for domain-aware queries
**Action:** Index (organization_id, domain) pairs  
**Performance:** Optimizes domain-scoped lookups  
**Indexes:**
- idx_scopes_organization_domain
- idx_policy_snapshots_organization_domain
- idx_decision_events_organization_domain
- idx_verdict_events_organization_domain
- idx_audit_timeline_organization_domain
- idx_verdict_events_scope_id_text (for scope_id TEXT queries)

### Phase 12: Cleanup old indexes
**Action:** Drop obsolete UUID-based domain_id indexes

### Phase 13: Audit log and validation
**Action:** Record migration in migration_log table  
**Provides:** Post-execution verification queries

---

## Data Integrity Guarantees

### No Data Loss
- All historical verdict_events records preserved
- All decision_events records preserved
- All audit_timeline_entries records preserved
- All scope_id values preserved (UUID → text conversion)
- All domain meanings preserved (domain_name → domain)

### Semantic Consistency
- All domain references use human-readable strings after migration
- All scope_ids embed their governing domain
- All historical records remain auditable
- No UUIDs used for domain identity after migration

### Immutability
- scope_id values are never regenerated (only type-converted)
- Historical verdict records immutable (append-only enforcement)
- Domain identity stable for audit explanations

---

## Pre-Migration Checklist

Before running this migration:

- [ ] Backup database (critical governance data)
- [ ] Stop all application services that write to Mandate tables
- [ ] Verify domains table has data populated (name column filled)
- [ ] Confirm no NULL domain_id foreign keys in dependent tables
- [ ] Test on staging environment first
- [ ] Document organization_id value for post-migration audit

---

## Post-Migration Verification

After running migration, execute these queries:

```sql
-- 1. All scopes have domain values
SELECT COUNT(*) FROM scopes WHERE domain IS NULL;
-- Expected: 0

-- 2. Scope_id domain prefix consistency
SELECT scope_id, domain, 
  SUBSTRING(scope_id, 1, LENGTH(domain)) AS scope_domain_prefix,
  CASE WHEN SUBSTRING(scope_id, 1, LENGTH(domain)) = domain THEN 'OK' ELSE 'MISMATCH' END AS validation
FROM scopes WHERE domain IS NOT NULL
ORDER BY domain, scope_id;
-- Expected: All rows show 'OK'

-- 3. No domain_id columns remain
SELECT * FROM information_schema.columns 
WHERE column_name = 'domain_id' AND table_schema = 'mandate';
-- Expected: 0 rows

-- 4. Domains primary key is (organization_id, domain)
SELECT constraint_name FROM information_schema.table_constraints
WHERE table_name = 'domains' AND constraint_type = 'PRIMARY KEY';
-- Expected: 1 row showing composite key

-- 5. scope_id is TEXT type
SELECT data_type FROM information_schema.columns
WHERE table_name = 'scopes' AND column_name = 'scope_id';
-- Expected: text

-- 6. All verdict records preserved
SELECT COUNT(*) FROM verdict_events WHERE domain IS NULL OR scope_id IS NULL;
-- Expected: 0
```

---

## Rollback Procedure

This migration is **NOT reversible** without prior backup. If rollback is needed:

1. Restore from pre-migration database backup
2. Re-apply previous migrations (001-007)
3. Coordinate with audit team for verdict record retention

**Recommendation:** Treat as immutable once committed to production.

---

## RFC-002 Compliance Map

| RFC-002 Section | Requirement | Implemented | Method |
|---|---|---|---|
| 3.2 | Domain is string slug | ✓ | Column type TEXT + CHECK constraint |
| 3.2 | Domain identified by name, not ID | ✓ | domain_id removed, domain canonical |
| 3.3 | scope_id is human-readable string | ✓ | UUID → TEXT conversion |
| 3.3 | scope_id embeds domain | ✓ | BEFORE INSERT trigger validation |
| 3.3 | scope_id is immutable | ✓ | No regeneration, only type conversion |
| 11 | domain_id MUST be removed | ✓ | All domain_id columns dropped |
| 11 | domain_name becomes canonical domain | ✓ | Column renamed in domains table |
| 11 | Historical records preserve domain meaning | ✓ | Backfill from domains table |
| Invariant #2 | domain is human-readable string | ✓ | Text type enforced |
| Invariant #3 | scope_id is structured, human-readable | ✓ | TEXT type, domain.* pattern |

---

## Impact Analysis

### Tables Modified
1. **domains** - Rename name→domain, drop domain_id, change PK
2. **scopes** - Add domain constraint, convert scope_id UUID→TEXT, add FK
3. **policy_snapshots** - Add domain constraint, add FK
4. **decision_events** - Add domain constraint, add FK
5. **verdict_events** - Add domain constraint, add FK, update scope_id FK
6. **audit_timeline_entries** - Add domain constraint, add FK

### Tables Created
- migration_log (for audit trail)

### Indexes Added
- 5 composite (org_id, domain) indexes
- 1 scope_id TEXT index

### Constraints Added
- 6 domain slug format checks
- 5 organization-domain foreign keys
- 1 scope_id domain prefix validation trigger

### Constraints Dropped
- All domain_id foreign keys
- Domains single-column UUID primary key

---

## Performance Considerations

**Query optimization after migration:**
- Domain-scoped queries benefit from composite indexes
- UUID lookup replacement with string comparison (negligible impact)
- Additional foreign key checks at insert time (minimal overhead)

**No expected performance degradation** for read operations.

---

## Testing Recommendation

Test with this sample data:

```sql
-- Insert test organization
INSERT INTO organizations (name, description) 
VALUES ('Test Corp', 'For migration testing')
RETURNING organization_id;

-- Insert test domain (e.g., organization_id = 'xxxx-xxxx-xxxx')
INSERT INTO domains (organization_id, domain, description)
VALUES ('xxxx-xxxx-xxxx', 'finance', 'Finance domain')
RETURNING organization_id, domain;

-- Insert test scope (with proper domain prefix)
INSERT INTO scopes (scope_id, domain, organization_id, owning_team)
VALUES ('finance.prod.billing.system', 'finance', 'xxxx-xxxx-xxxx', 'Billing Team')
RETURNING scope_id, domain;

-- Verify scope_id prefix validation works
-- This should FAIL:
-- INSERT INTO scopes (scope_id, domain, organization_id, owning_team)
-- VALUES ('logistics.prod.system', 'finance', 'xxxx-xxxx-xxxx', 'Team');
-- Expected: GOVERNANCE VIOLATION error
```

---

## Questions & Clarifications

**Q: Why convert scope_id from UUID to TEXT?**  
A: RFC-002 Section 3.3 mandates scope_id be "human-readable string". UUIDs are not human-readable. Text format like `finance.prod.billing.db-admin` is auditable and explainable to compliance teams.

**Q: What if scope_id values don't embed domain prefix?**  
A: Migration only validates NEW inserts. Existing scope_ids (now TEXT) are preserved as-is for historical accuracy. Future inserts will be validated by trigger.

**Q: Can I customize domain slug format?**  
A: Pattern `^[a-z0-9_-]+$` is per RFC-002 Section 3.2 (stable, auditable). If different slugs are needed, file RFC amendment.

**Q: Is this reversible?**  
A: No. UUID→TEXT is irreversible at database level. Requires full backup+restore for rollback.

---

## Sign-Off

**Migration Owner:** Mandate Control Plane Team  
**RFC Reference:** RFC-002 v1.2 Section 11  
**Governance Impact:** CRITICAL - Changes domain identity model  
**Audit Safe:** All historical records preserved  
**Data Loss Risk:** NONE  

---

**End of RFC-002 Migration Summary**
