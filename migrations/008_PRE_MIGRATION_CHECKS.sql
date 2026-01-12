-- Pre-Migration Validation Queries (RFC-002 v1.2 Domain Identity Migration)
-- Run BEFORE executing migration 008
-- Purpose: Verify data integrity and migration readiness

SET search_path TO mandate;

-- =============================================================================
-- CHECK 1: Domain data availability
-- =============================================================================
-- GOAL: Verify domains table has all required data

ECHO '=== CHECK 1: Domain Data Availability ===';

SELECT 'domains table row count:' as check_name, COUNT(*) as result
FROM domains;

SELECT 'domain_id NULL count:' as check_name, COUNT(*) as result
FROM domains WHERE domain_id IS NULL;

SELECT 'name (future domain) NULL count:' as check_name, COUNT(*) as result
FROM domains WHERE name IS NULL;

-- =============================================================================
-- CHECK 2: Orphaned foreign keys
-- =============================================================================
-- GOAL: Verify no domain_id foreign key violations

ECHO '=== CHECK 2: Orphaned Foreign Keys ===';

SELECT 'scopes.domain_id -> domains.domain_id orphans:' as check_name, COUNT(*) as result
FROM scopes s
WHERE s.domain_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM domains d WHERE d.domain_id = s.domain_id);

SELECT 'policy_snapshots.domain_id -> domains.domain_id orphans:' as check_name, COUNT(*) as result
FROM policy_snapshots ps
WHERE ps.domain_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM domains d WHERE d.domain_id = ps.domain_id);

SELECT 'decision_events.domain_id -> domains.domain_id orphans:' as check_name, COUNT(*) as result
FROM decision_events de
WHERE de.domain_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM domains d WHERE d.domain_id = de.domain_id);

SELECT 'verdict_events.domain_id -> domains.domain_id orphans:' as check_name, COUNT(*) as result
FROM verdict_events ve
WHERE ve.domain_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM domains d WHERE d.domain_id = ve.domain_id);

SELECT 'audit_timeline_entries.domain_id -> domains.domain_id orphans:' as check_name, COUNT(*) as result
FROM audit_timeline_entries ate
WHERE ate.domain_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM domains d WHERE d.domain_id = ate.domain_id);

-- =============================================================================
-- CHECK 3: Domain name format validation
-- =============================================================================
-- GOAL: Verify all domain names are RFC-002 compliant (slug format)

ECHO '=== CHECK 3: Domain Name Format (RFC-002 Slug) ===';

SELECT 'domains.name values NOT matching ^[a-z0-9_-]+$:' as check_name, COUNT(*) as result
FROM domains
WHERE name !~ '^[a-z0-9_-]+$';

-- Show problematic domain names if any
SELECT 'Problematic domain names (non-slug):' as check_name, name as domain_name
FROM domains
WHERE name !~ '^[a-z0-9_-]+$';

-- =============================================================================
-- CHECK 4: Existing domain column state
-- =============================================================================
-- GOAL: Check if domain columns already exist and have data

ECHO '=== CHECK 4: Existing Domain Column State ===';

SELECT 'scopes.domain IS NOT NULL count:' as check_name, COUNT(*) as result
FROM scopes WHERE domain IS NOT NULL;

SELECT 'policy_snapshots.domain IS NOT NULL count:' as check_name, COUNT(*) as result
FROM policy_snapshots WHERE domain IS NOT NULL;

SELECT 'decision_events.domain IS NOT NULL count:' as check_name, COUNT(*) as result
FROM decision_events WHERE domain IS NOT NULL;

SELECT 'verdict_events.domain IS NOT NULL count:' as check_name, COUNT(*) as result
FROM verdict_events WHERE domain IS NOT NULL;

SELECT 'audit_timeline_entries.domain IS NOT NULL count:' as check_name, COUNT(*) as result
FROM audit_timeline_entries WHERE domain IS NOT NULL;

-- =============================================================================
-- CHECK 5: Scope data integrity
-- =============================================================================
-- GOAL: Verify scopes table is consistent

ECHO '=== CHECK 5: Scope Data Integrity ===';

SELECT 'scopes.scope_id NULL count:' as check_name, COUNT(*) as result
FROM scopes WHERE scope_id IS NULL;

SELECT 'scopes.domain_id NULL count:' as check_name, COUNT(*) as result
FROM scopes WHERE domain_id IS NULL;

SELECT 'scopes.organization_id NULL count:' as check_name, COUNT(*) as result
FROM scopes WHERE organization_id IS NULL;

-- =============================================================================
-- CHECK 6: Verdict events critical fields
-- =============================================================================
-- GOAL: Verify verdict events have required attribution

ECHO '=== CHECK 6: Verdict Events Critical Fields ===';

SELECT 'verdict_events.domain IS NOT NULL count:' as check_name, COUNT(*) as result
FROM verdict_events WHERE domain IS NOT NULL;

SELECT 'verdict_events.scope_id IS NOT NULL count:' as check_name, COUNT(*) as result
FROM verdict_events WHERE scope_id IS NOT NULL;

SELECT 'verdict_events.decision_id references valid decision:' as check_name, 
  COUNT(*) as result
FROM verdict_events ve
WHERE NOT EXISTS (SELECT 1 FROM decision_events de WHERE de.decision_id = ve.decision_id);

-- =============================================================================
-- CHECK 7: Organization data coverage
-- =============================================================================
-- GOAL: Verify all records have organization_id

ECHO '=== CHECK 7: Organization Data Coverage ===';

SELECT 'scopes.organization_id NULL count:' as check_name, COUNT(*) as result
FROM scopes WHERE organization_id IS NULL;

SELECT 'policy_snapshots.organization_id NULL count:' as check_name, COUNT(*) as result
FROM policy_snapshots WHERE organization_id IS NULL;

SELECT 'decision_events.organization_id NULL count:' as check_name, COUNT(*) as result
FROM decision_events WHERE organization_id IS NULL;

SELECT 'verdict_events.organization_id NULL count:' as check_name, COUNT(*) as result
FROM verdict_events WHERE organization_id IS NULL;

-- =============================================================================
-- SUMMARY
-- =============================================================================
-- GOAL: Show overall readiness status

ECHO '=== MIGRATION READINESS SUMMARY ===';

SELECT 'If all "result" values are 0 (except for row counts), migration is SAFE to proceed.' as status;

-- =============================================================================
-- END PRE-MIGRATION CHECKS
-- =============================================================================
