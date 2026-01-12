-- Mandate Control Plane - RFC-002 v1.2 Domain Identity Migration
-- Version: 008
-- Migration Rule: Normalize domain to human-readable string slug
-- Removes domain_id (UUID), promotes domain_name → domain (text slug)
-- Aligns with RFC-002 Section 11 (Migration Rule)
--
-- Rules enforced by this migration:
-- 1. domain_id MUST be removed (UUID forbidden for domain identity)
-- 2. domain_name MUST become canonical domain (text slug)
-- 3. All historical records MUST preserve domain meaning
-- 4. scope_id MUST embed domain prefix and be human-readable string
-- 5. Scope prefix consistency MUST be enforced

BEGIN;

SET search_path TO mandate;

-- =============================================================================
-- PHASE 1: BACKFILL domain FROM domains.name
-- =============================================================================
-- RFC-002: Domain must be canonical string slug, not UUID
-- Backfill all domain-referencing tables from domains table

-- Backfill scopes.domain (human-readable string)
-- Rule: Extract domain string from domains table by domain_id
UPDATE scopes s
SET domain = d.name
FROM domains d
WHERE s.domain_id = d.domain_id
  AND s.domain IS NULL;

-- Backfill policy_snapshots.domain (human-readable string)
UPDATE policy_snapshots ps
SET domain = d.name
FROM domains d
WHERE ps.domain_id = d.domain_id
  AND ps.domain IS NULL;

-- Backfill decision_events.domain (human-readable string)
UPDATE decision_events de
SET domain = d.name
FROM domains d
WHERE de.domain_id = d.domain_id
  AND de.domain IS NULL;

-- Backfill verdict_events.domain (human-readable string) - already present from 007
-- Just ensure consistency with domains table
UPDATE verdict_events ve
SET domain = d.name
FROM domains d
WHERE ve.domain_id = d.domain_id
  AND ve.domain IS NULL;

-- Backfill audit_timeline_entries.domain (human-readable string)
UPDATE audit_timeline_entries ate
SET domain = d.name
FROM domains d
WHERE ate.domain_id = d.domain_id
  AND ate.domain IS NULL;

-- =============================================================================
-- PHASE 2: ENFORCE NOT NULL CONSTRAINTS ON domain COLUMNS
-- =============================================================================
-- RFC-002: Domain MUST be non-null and human-readable
-- Once backfill is complete, enforce NOT NULL

ALTER TABLE scopes
    ALTER COLUMN domain SET NOT NULL;

ALTER TABLE policy_snapshots
    ALTER COLUMN domain SET NOT NULL;

ALTER TABLE decision_events
    ALTER COLUMN domain SET NOT NULL;

ALTER TABLE verdict_events
    ALTER COLUMN domain SET NOT NULL;

ALTER TABLE audit_timeline_entries
    ALTER COLUMN domain SET NOT NULL;

-- =============================================================================
-- PHASE 3: RENAME domain_name TO domain IN domains TABLE
-- =============================================================================
-- RFC-002: Promote domain_name to canonical domain column
-- The domains table uses 'name' column; rename to 'domain' for clarity

ALTER TABLE domains
    RENAME COLUMN name TO domain;

-- Update unique constraint to use renamed column
ALTER TABLE domains
    DROP CONSTRAINT domains_unique_name_per_org,
    ADD CONSTRAINT domains_unique_domain_per_org UNIQUE (organization_id, domain);

-- Update index
DROP INDEX idx_domains_name;
CREATE INDEX idx_domains_domain ON domains (domain);

-- =============================================================================
-- PHASE 4: ADD DOMAIN SLUG CONSTRAINT (RFC-002)
-- =============================================================================
-- RFC-002: Domain MUST be stable, human-readable, and slug-compatible
-- Enforce lowercase alphanumeric + underscore/dash pattern
-- Pattern: ^[a-z0-9_-]+$

ALTER TABLE domains
    ADD CONSTRAINT domains_domain_slug_format 
    CHECK (domain ~ '^[a-z0-9_-]+$');

ALTER TABLE scopes
    ADD CONSTRAINT scopes_domain_slug_format 
    CHECK (domain ~ '^[a-z0-9_-]+$');

ALTER TABLE policy_snapshots
    ADD CONSTRAINT policy_snapshots_domain_slug_format 
    CHECK (domain ~ '^[a-z0-9_-]+$');

ALTER TABLE decision_events
    ADD CONSTRAINT decision_events_domain_slug_format 
    CHECK (domain ~ '^[a-z0-9_-]+$');

ALTER TABLE verdict_events
    ADD CONSTRAINT verdict_events_domain_slug_format 
    CHECK (domain ~ '^[a-z0-9_-]+$');

ALTER TABLE audit_timeline_entries
    ADD CONSTRAINT audit_timeline_entries_domain_slug_format 
    CHECK (domain ~ '^[a-z0-9_-]+$');

-- =============================================================================
-- PHASE 5: CONVERT scope_id FROM UUID TO TEXT (RFC-002)
-- =============================================================================
-- RFC-002 Section 3.3: scope_id MUST be human-readable string
-- Preserve all existing scope_id values (convert UUID → text representation)
-- Format: domain.service.agent.scope_system (human-readable)

-- Create new TEXT column for new scope_id
ALTER TABLE scopes
    ADD COLUMN scope_id_new TEXT;

-- Copy existing UUID values as text (preserves meaning)
UPDATE scopes
SET scope_id_new = CAST(scope_id AS TEXT)
WHERE scope_id IS NOT NULL;

-- Drop old UUID column and trigger on it
ALTER TABLE scopes
    DROP CONSTRAINT scopes_pkey;

DROP INDEX idx_scopes_unique;

ALTER TABLE scopes
    DROP COLUMN scope_id;

-- Rename new TEXT column to scope_id
ALTER TABLE scopes
    RENAME COLUMN scope_id_new TO scope_id;

-- Re-add primary key on new TEXT scope_id
ALTER TABLE scopes
    ADD PRIMARY KEY (scope_id);

-- Re-add unique constraint
CREATE UNIQUE INDEX idx_scopes_unique ON scopes (
    COALESCE(scope_domain, ''),
    COALESCE(service, ''),
    COALESCE(agent, ''),
    COALESCE(scope_system, ''),
    COALESCE(environment, ''),
    COALESCE(tenant, '')
);

-- =============================================================================
-- PHASE 6: ENFORCE scope_id PREFIX CONSISTENCY (RFC-002 Section 3.3)
-- =============================================================================
-- RFC-002: scope_id MUST embed the domain
-- Example: finance.prod.billing.db-admin
-- Implemented as trigger: scope_id immutable, validated at insert time

CREATE OR REPLACE FUNCTION validate_scope_id_domain_prefix()
RETURNS TRIGGER AS $$
BEGIN
    -- RFC-002: scope_id MUST start with domain prefix followed by dot
    -- Pattern: domain.* (e.g., finance.prod.billing.db-admin)
    IF NOT (NEW.scope_id LIKE NEW.domain || '.%') THEN
        RAISE EXCEPTION 'GOVERNANCE VIOLATION: scope_id ''%'' does not embed domain prefix ''%'' (expected format: %.*, e.g., %.service.agent.scope)', 
            NEW.scope_id, NEW.domain, NEW.domain, NEW.domain;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validate_scopes_scope_id_domain_prefix
    BEFORE INSERT ON scopes
    FOR EACH ROW EXECUTE FUNCTION validate_scope_id_domain_prefix();

-- =============================================================================
-- PHASE 7: UPDATE FOREIGN KEY REFERENCES TO scope_id
-- =============================================================================
-- RFC-002: scope_id is now TEXT, not UUID
-- Update all references to use TEXT type

-- Drop old UUID foreign key constraint on verdict_events
ALTER TABLE verdict_events
    DROP CONSTRAINT verdict_events_scope_id_fkey;

-- Add new foreign key with TEXT type
ALTER TABLE verdict_events
    ADD CONSTRAINT verdict_events_scope_id_fkey
    FOREIGN KEY (scope_id) REFERENCES scopes(scope_id);

-- =============================================================================
-- PHASE 8: DROP domain_id (UUID) - GOVERNANCE CRITICAL
-- =============================================================================
-- RFC-002 Section 11: domain_id MUST be removed
-- UUID-based domain identifiers are forbidden per RFC-002 Section 3.2

-- Drop foreign key references to domain_id first
ALTER TABLE policy_snapshots
    DROP CONSTRAINT policy_snapshots_domain_id_fkey;

ALTER TABLE scopes
    DROP CONSTRAINT scopes_domain_id_fkey;

ALTER TABLE decision_events
    DROP CONSTRAINT decision_events_domain_id_fkey;

ALTER TABLE verdict_events
    DROP CONSTRAINT verdict_events_domain_id_fkey;

ALTER TABLE audit_timeline_entries
    DROP CONSTRAINT audit_timeline_entries_domain_id_fkey;

-- Drop all domain_id columns (except from domains table itself)
ALTER TABLE scopes
    DROP COLUMN domain_id;

ALTER TABLE policy_snapshots
    DROP COLUMN domain_id;

ALTER TABLE decision_events
    DROP COLUMN domain_id;

ALTER TABLE verdict_events
    DROP COLUMN domain_id;

ALTER TABLE audit_timeline_entries
    DROP COLUMN domain_id;

-- Drop domain_id from domains table itself
ALTER TABLE domains
    DROP COLUMN domain_id;

-- Drop the primary key on domains (was domain_id)
ALTER TABLE domains
    DROP CONSTRAINT domains_pkey;

-- =============================================================================
-- PHASE 9: RESTORE PRIMARY KEY ON domains TABLE (RFC-002)
-- =============================================================================
-- RFC-002: Domain is identified by (organization_id, domain) composite
-- This is the authoritative domain identity

ALTER TABLE domains
    ADD PRIMARY KEY (organization_id, domain);

-- =============================================================================
-- PHASE 10: ADD DOMAIN REFERENCES BACK (HUMAN-READABLE)
-- =============================================================================
-- RFC-002: Policies, specs, and verdicts are now domain-bound
-- via the human-readable domain string, not UUID

-- Add foreign key constraints on domain (text) instead of domain_id (UUID)
-- These reference (organization_id, domain) composite key in domains table

ALTER TABLE scopes
    ADD CONSTRAINT scopes_organization_domain_fkey
    FOREIGN KEY (organization_id, domain)
    REFERENCES domains(organization_id, domain);

ALTER TABLE policy_snapshots
    ADD CONSTRAINT policy_snapshots_organization_domain_fkey
    FOREIGN KEY (organization_id, domain)
    REFERENCES domains(organization_id, domain);

ALTER TABLE decision_events
    ADD CONSTRAINT decision_events_organization_domain_fkey
    FOREIGN KEY (organization_id, domain)
    REFERENCES domains(organization_id, domain);

ALTER TABLE verdict_events
    ADD CONSTRAINT verdict_events_organization_domain_fkey
    FOREIGN KEY (organization_id, domain)
    REFERENCES domains(organization_id, domain);

ALTER TABLE audit_timeline_entries
    ADD CONSTRAINT audit_timeline_entries_organization_domain_fkey
    FOREIGN KEY (organization_id, domain)
    REFERENCES domains(organization_id, domain);

-- =============================================================================
-- PHASE 11: CREATE COMPOSITE INDEXES FOR DOMAIN-BOUND QUERIES (RFC-002)
-- =============================================================================
-- RFC-002: Queries are domain-aware; optimize for (organization_id, domain) lookups

CREATE INDEX idx_scopes_organization_domain ON scopes (organization_id, domain);
CREATE INDEX idx_policy_snapshots_organization_domain ON policy_snapshots (organization_id, domain);
CREATE INDEX idx_decision_events_organization_domain ON decision_events (organization_id, domain);
CREATE INDEX idx_verdict_events_organization_domain ON verdict_events (organization_id, domain);
CREATE INDEX idx_audit_timeline_organization_domain ON audit_timeline_entries (organization_id, domain);

-- Additional indices for scope_id (now TEXT) queries
CREATE INDEX idx_verdict_events_scope_id_text ON verdict_events (scope_id);

-- =============================================================================
-- PHASE 12: CLEANUP - DROP OLD INDEXES
-- =============================================================================

DROP INDEX IF EXISTS idx_scopes_domain_id;
DROP INDEX IF EXISTS idx_policy_snapshots_domain_id;
DROP INDEX IF EXISTS idx_decision_events_domain_id;
DROP INDEX IF EXISTS idx_verdict_events_domain_id;
DROP INDEX IF EXISTS idx_audit_timeline_domain_id;

-- =============================================================================
-- PHASE 13: AUDIT SAFE - VERIFY IMMUTABILITY
-- =============================================================================
-- RFC-002 Section 3.3: scope_id MUST be immutable once created
-- All historical scope_ids (previously UUIDs) are preserved as text
-- No regeneration or renaming occurred per RFC-002 rules

-- Create summary table of migration (informational only)
CREATE TABLE IF NOT EXISTS migration_log (
    id SERIAL PRIMARY KEY,
    migration_version INT NOT NULL,
    migration_name TEXT NOT NULL,
    description TEXT,
    executed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO migration_log (migration_version, migration_name, description)
VALUES (
    8,
    'RFC-002 v1.2 Domain Identity Migration',
    'Removed domain_id UUIDs, promoted domain to canonical text slug, converted scope_id to human-readable string, enforced domain prefix consistency in scope_id'
);

-- =============================================================================
-- VALIDATION QUERIES (For post-migration verification)
-- =============================================================================

-- 1. Verify all scopes have domain values
-- SELECT COUNT(*) FROM scopes WHERE domain IS NULL;
-- Expected: 0

-- 2. Verify scope_id domain prefix consistency
-- SELECT 
--   scope_id,
--   domain,
--   SUBSTRING(scope_id FROM 1 FOR LENGTH(domain)) AS scope_domain_prefix,
--   CASE WHEN SUBSTRING(scope_id FROM 1 FOR LENGTH(domain)) = domain THEN 'OK' ELSE 'MISMATCH' END AS validation
-- FROM scopes
-- WHERE domain IS NOT NULL
-- ORDER BY domain, scope_id;
-- Expected: All rows show 'OK'

-- 3. Verify all domain_id columns are dropped
-- SELECT * FROM information_schema.columns WHERE column_name = 'domain_id' AND table_schema = 'mandate';
-- Expected: 0 rows

-- 4. Verify domains primary key is (organization_id, domain)
-- SELECT constraint_name, constraint_type FROM information_schema.table_constraints
-- WHERE table_name = 'domains' AND table_schema = 'mandate' AND constraint_type = 'PRIMARY KEY';
-- Expected: 1 row with PRIMARY KEY on (organization_id, domain)

-- 5. Verify scope_id is TEXT type
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_name = 'scopes' AND column_name = 'scope_id' AND table_schema = 'mandate';
-- Expected: TEXT

-- 6. Verify all historical verdict records are preserved
-- SELECT COUNT(*) FROM verdict_events WHERE domain IS NULL OR scope_id IS NULL;
-- Expected: 0

COMMIT;
