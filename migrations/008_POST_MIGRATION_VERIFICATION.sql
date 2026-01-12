-- Post-Migration Verification Queries (RFC-002 v1.2 Domain Identity Migration)
-- Run AFTER executing migration 008
-- Purpose: Verify migration success and RFC-002 compliance

SET search_path TO mandate;

-- =============================================================================
-- VERIFICATION 1: domain_id Removal (RFC-002 CRITICAL)
-- =============================================================================
-- GOAL: Confirm all domain_id (UUID) columns are removed

ECHO '=== VERIFICATION 1: domain_id Column Removal ===';

SELECT 'Remaining domain_id columns in mandate schema:' as check_name,
  COUNT(*) as column_count
FROM information_schema.columns
WHERE column_name = 'domain_id'
  AND table_schema = 'mandate';
-- Expected: 0

SELECT 'Table' as table_name, 'Column' as column_name, 'Type' as data_type
FROM information_schema.columns
WHERE column_name = 'domain_id'
  AND table_schema = 'mandate';
-- Expected: No rows (empty result set)

-- =============================================================================
-- VERIFICATION 2: domain Column Type & Constraints (RFC-002)
-- =============================================================================
-- GOAL: Verify domain is TEXT and NOT NULL

ECHO '=== VERIFICATION 2: Domain Column Configuration ===';

SELECT table_name, data_type
FROM information_schema.columns
WHERE column_name = 'domain'
  AND table_schema = 'mandate'
  AND table_name IN ('scopes', 'policy_snapshots', 'decision_events', 'verdict_events', 'audit_timeline_entries', 'domains')
ORDER BY table_name;
-- Expected: All showing data_type = 'text'

SELECT table_name, column_name, is_nullable
FROM information_schema.columns
WHERE column_name = 'domain'
  AND table_schema = 'mandate'
  AND table_name IN ('scopes', 'policy_snapshots', 'decision_events', 'verdict_events', 'audit_timeline_entries')
ORDER BY table_name;
-- Expected: All showing is_nullable = 'NO'

-- =============================================================================
-- VERIFICATION 3: scope_id Type Conversion (RFC-002)
-- =============================================================================
-- GOAL: Verify scope_id is TEXT (not UUID)

ECHO '=== VERIFICATION 3: scope_id Type Conversion ===';

SELECT data_type
FROM information_schema.columns
WHERE table_name = 'scopes'
  AND column_name = 'scope_id'
  AND table_schema = 'mandate';
-- Expected: text

SELECT COUNT(*) as scope_id_count
FROM scopes;
-- Expected: Non-zero (all existing scopes converted)

-- =============================================================================
-- VERIFICATION 4: scope_id Domain Prefix Consistency (RFC-002)
-- =============================================================================
-- GOAL: Verify all scope_ids embed their domain

ECHO '=== VERIFICATION 4: scope_id Domain Prefix Consistency ===';

SELECT COUNT(*) as scopes_with_domain_prefix_match
FROM scopes
WHERE domain IS NOT NULL
  AND scope_id LIKE domain || '.%';
-- Expected: Equals total scope count with domain

SELECT COUNT(*) as scopes_with_domain_prefix_mismatch
FROM scopes
WHERE domain IS NOT NULL
  AND NOT (scope_id LIKE domain || '.%');
-- Expected: 0 (no mismatches)

-- Show any mismatches (should be none)
SELECT scope_id, domain, 
  SUBSTRING(scope_id FROM 1 FOR LENGTH(domain)) as scope_domain_prefix,
  CASE WHEN scope_id LIKE domain || '.%' THEN 'OK' ELSE 'MISMATCH' END as validation
FROM scopes
WHERE domain IS NOT NULL
  AND NOT (scope_id LIKE domain || '.%')
ORDER BY domain, scope_id;
-- Expected: No rows

-- =============================================================================
-- VERIFICATION 5: Domain Slug Format (RFC-002)
-- =============================================================================
-- GOAL: Verify all domains match RFC-002 slug format

ECHO '=== VERIFICATION 5: Domain Slug Format Compliance ===';

SELECT COUNT(*) as valid_domain_slugs
FROM domains
WHERE domain ~ '^[a-z0-9_-]+$';
-- Expected: Equals total domain count

SELECT COUNT(*) as invalid_domain_slugs
FROM domains
WHERE domain !~ '^[a-z0-9_-]+$';
-- Expected: 0

-- Show any invalid domains (should be none)
SELECT domain
FROM domains
WHERE domain !~ '^[a-z0-9_-]+$'
ORDER BY domain;
-- Expected: No rows

-- =============================================================================
-- VERIFICATION 6: Primary Key Structure (RFC-002)
-- =============================================================================
-- GOAL: Verify domains table uses (organization_id, domain) composite PK

ECHO '=== VERIFICATION 6: Domains Primary Key Structure ===';

SELECT constraint_name, constraint_type
FROM information_schema.table_constraints
WHERE table_name = 'domains'
  AND table_schema = 'mandate'
  AND constraint_type = 'PRIMARY KEY';
-- Expected: 1 row

SELECT column_name, ordinal_position
FROM information_schema.constraint_column_usage
WHERE table_name = 'domains'
  AND table_schema = 'mandate'
  AND constraint_name = (
    SELECT constraint_name
    FROM information_schema.table_constraints
    WHERE table_name = 'domains'
      AND table_schema = 'mandate'
      AND constraint_type = 'PRIMARY KEY'
  )
ORDER BY ordinal_position;
-- Expected: 2 rows (organization_id, domain)

-- =============================================================================
-- VERIFICATION 7: Foreign Key References (RFC-002)
-- =============================================================================
-- GOAL: Verify (organization_id, domain) composite foreign keys exist

ECHO '=== VERIFICATION 7: Domain-Bound Foreign Keys ===';

SELECT constraint_name, table_name
FROM information_schema.table_constraints
WHERE constraint_type = 'FOREIGN KEY'
  AND table_schema = 'mandate'
  AND (table_name IN ('scopes', 'policy_snapshots', 'decision_events', 'verdict_events', 'audit_timeline_entries')
       AND constraint_name LIKE '%organization_domain%')
ORDER BY table_name;
-- Expected: 5 rows (one per table)

-- Verify foreign key references domains table
SELECT rc.constraint_name, rc.table_name, rc.referenced_table_name
FROM information_schema.referential_constraints rc
WHERE rc.constraint_schema = 'mandate'
  AND rc.constraint_name LIKE '%organization_domain%'
ORDER BY rc.table_name;
-- Expected: 5 rows, all referencing 'domains'

-- =============================================================================
-- VERIFICATION 8: Historical Data Preservation (RFC-002)
-- =============================================================================
-- GOAL: Verify all historical records are preserved and populated

ECHO '=== VERIFICATION 8: Historical Data Preservation ===';

SELECT 'scopes with domain populated:' as table_check,
  COUNT(*) as populated_count
FROM scopes WHERE domain IS NOT NULL;

SELECT 'policy_snapshots with domain populated:' as table_check,
  COUNT(*) as populated_count
FROM policy_snapshots WHERE domain IS NOT NULL;

SELECT 'decision_events with domain populated:' as table_check,
  COUNT(*) as populated_count
FROM decision_events WHERE domain IS NOT NULL;

SELECT 'verdict_events with domain populated:' as table_check,
  COUNT(*) as populated_count
FROM verdict_events WHERE domain IS NOT NULL;

SELECT 'audit_timeline_entries with domain populated:' as table_check,
  COUNT(*) as populated_count
FROM audit_timeline_entries WHERE domain IS NOT NULL;

-- Verify no NULL domains
SELECT 'scopes with NULL domain:' as table_check,
  COUNT(*) as null_count
FROM scopes WHERE domain IS NULL;

SELECT 'policy_snapshots with NULL domain:' as table_check,
  COUNT(*) as null_count
FROM policy_snapshots WHERE domain IS NULL;

SELECT 'decision_events with NULL domain:' as table_check,
  COUNT(*) as null_count
FROM decision_events WHERE domain IS NULL;

SELECT 'verdict_events with NULL domain:' as table_check,
  COUNT(*) as null_count
FROM verdict_events WHERE domain IS NULL;

SELECT 'audit_timeline_entries with NULL domain:' as table_check,
  COUNT(*) as null_count
FROM audit_timeline_entries WHERE domain IS NULL;
-- All expected: 0

-- =============================================================================
-- VERIFICATION 9: Indexes Created (RFC-002)
-- =============================================================================
-- GOAL: Verify composite and scope_id indexes exist

ECHO '=== VERIFICATION 9: Index Creation ===';

SELECT indexname
FROM pg_indexes
WHERE schemaname = 'mandate'
  AND (indexname LIKE '%organization_domain%' OR indexname = 'idx_verdict_events_scope_id_text')
ORDER BY indexname;
-- Expected: 6 indexes
-- - idx_scopes_organization_domain
-- - idx_policy_snapshots_organization_domain
-- - idx_decision_events_organization_domain
-- - idx_verdict_events_organization_domain
-- - idx_audit_timeline_organization_domain
-- - idx_verdict_events_scope_id_text

-- =============================================================================
-- VERIFICATION 10: Constraint Validation (RFC-002)
-- =============================================================================
-- GOAL: Verify CHECK constraints for domain slug format

ECHO '=== VERIFICATION 10: Domain Slug Format Constraints ===';

SELECT constraint_name, table_name
FROM information_schema.check_constraints
WHERE constraint_schema = 'mandate'
  AND constraint_name LIKE '%domain_slug_format%'
ORDER BY table_name;
-- Expected: 6 rows (one per table with domain column)

-- =============================================================================
-- VERIFICATION 11: scope_id Validation Trigger (RFC-002)
-- =============================================================================
-- GOAL: Verify scope_id domain prefix validation trigger exists

ECHO '=== VERIFICATION 11: scope_id Validation Trigger ===';

SELECT trigger_name, event_object_table
FROM information_schema.triggers
WHERE trigger_schema = 'mandate'
  AND trigger_name = 'validate_scopes_scope_id_domain_prefix';
-- Expected: 1 row

-- =============================================================================
-- VERIFICATION 12: Migration Audit Log (RFC-002)
-- =============================================================================
-- GOAL: Verify migration_log entry was created

ECHO '=== VERIFICATION 12: Migration Audit Log ===';

SELECT * FROM migration_log
WHERE migration_version = 8
  AND migration_name = 'RFC-002 v1.2 Domain Identity Migration'
ORDER BY executed_at DESC
LIMIT 1;
-- Expected: 1 row with migration details

-- =============================================================================
-- VERIFICATION 13: Verdict Events Complete Attribution (RFC-002)
-- =============================================================================
-- GOAL: Verify verdict events have all required RFC-002 fields

ECHO '=== VERIFICATION 13: Verdict Events RFC-002 Attribution ===';

SELECT COUNT(*) as verdicts_with_full_attribution
FROM verdict_events
WHERE domain IS NOT NULL
  AND scope_id IS NOT NULL
  AND organization_id IS NOT NULL;
-- Expected: Equals total verdict count

SELECT COUNT(*) as verdicts_missing_domain
FROM verdict_events WHERE domain IS NULL;

SELECT COUNT(*) as verdicts_missing_scope_id
FROM verdict_events WHERE scope_id IS NULL;

SELECT COUNT(*) as verdicts_missing_organization_id
FROM verdict_events WHERE organization_id IS NULL;
-- All expected: 0

-- =============================================================================
-- VERIFICATION 14: Append-Only Immutability (RFC-002)
-- =============================================================================
-- GOAL: Verify immutability triggers still exist

ECHO '=== VERIFICATION 14: Append-Only Enforcement ===';

SELECT trigger_name, event_object_table
FROM information_schema.triggers
WHERE trigger_schema = 'mandate'
  AND trigger_name LIKE 'prevent_%_mutation'
ORDER BY event_object_table;
-- Expected: 7 rows (decision_events, verdict_events, audit_timeline, scopes, policy_snapshots, organizations, domains)

-- =============================================================================
-- SUMMARY & COMPLIANCE CHECKLIST
-- =============================================================================

ECHO '=== RFC-002 v1.2 COMPLIANCE CHECKLIST ===';

ECHO 'Invariant #2: domain is human-readable string';
SELECT 'PASS' as status WHERE EXISTS (
  SELECT 1 FROM information_schema.columns
  WHERE table_name = 'domains' AND column_name = 'domain'
  AND table_schema = 'mandate' AND data_type = 'text'
)
UNION ALL
SELECT 'FAIL' WHERE NOT EXISTS (
  SELECT 1 FROM information_schema.columns
  WHERE table_name = 'domains' AND column_name = 'domain'
  AND table_schema = 'mandate' AND data_type = 'text'
);

ECHO 'Invariant #3: scope_id is structured, human-readable string';
SELECT 'PASS' as status WHERE EXISTS (
  SELECT 1 FROM information_schema.columns
  WHERE table_name = 'scopes' AND column_name = 'scope_id'
  AND table_schema = 'mandate' AND data_type = 'text'
)
UNION ALL
SELECT 'FAIL' WHERE NOT EXISTS (
  SELECT 1 FROM information_schema.columns
  WHERE table_name = 'scopes' AND column_name = 'scope_id'
  AND table_schema = 'mandate' AND data_type = 'text'
);

ECHO 'Section 11: domain_id MUST be removed';
SELECT 'PASS' as status WHERE NOT EXISTS (
  SELECT 1 FROM information_schema.columns
  WHERE column_name = 'domain_id' AND table_schema = 'mandate'
)
UNION ALL
SELECT 'FAIL' WHERE EXISTS (
  SELECT 1 FROM information_schema.columns
  WHERE column_name = 'domain_id' AND table_schema = 'mandate'
);

ECHO '=== MIGRATION VERIFICATION COMPLETE ===';
ECHO 'All checks should show PASS status and expected row counts.';
ECHO 'If any check shows FAIL or unexpected counts, investigate before proceeding.';
