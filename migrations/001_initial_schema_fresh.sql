-- Mandate Control Plane - RFC-002 v1.2 Fresh Schema
-- Version: 001
-- Append-only, immutable, domain-driven architecture
-- RFC-002: domain_name is canonical text slug, scope_id is text with domain prefix

BEGIN;

-- =============================================================================
-- SCHEMA
-- =============================================================================

CREATE SCHEMA IF NOT EXISTS mandate;
SET search_path TO mandate;

-- =============================================================================
-- ENUM TYPES
-- =============================================================================

CREATE TYPE stage AS ENUM ('proposed', 'pre_commit', 'executed');
CREATE TYPE verdict AS ENUM ('ALLOW', 'PAUSE', 'BLOCK', 'OBSERVE');
CREATE TYPE event_source AS ENUM ('system', 'agent', 'human');
CREATE TYPE authority_level AS ENUM ('system', 'agent', 'human');

-- =============================================================================
-- ORGANIZATIONS TABLE
-- =============================================================================
-- Top-level governance boundary

CREATE TABLE organizations (
    organization_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT NOT NULL UNIQUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_organizations_name ON organizations (name);

-- =============================================================================
-- DOMAINS TABLE
-- =============================================================================
-- RFC-002: Domains are identified by (organization_id, domain_name)
-- domain_name is human-readable text slug (lowercase alphanumeric + dash/underscore)
-- No UUID-based domain identifiers

CREATE TABLE domains (
    organization_id UUID NOT NULL REFERENCES organizations(organization_id),
    domain_name     TEXT NOT NULL,
    description     TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    PRIMARY KEY (organization_id, domain_name),
    
    CONSTRAINT domains_domain_name_slug_format 
        CHECK (domain_name ~ '^[a-z0-9_-]+$')
);

CREATE INDEX idx_domains_organization ON domains (organization_id);

-- =============================================================================
-- SCOPES TABLE
-- =============================================================================
-- RFC-002: scope_id is TEXT (human-readable), must embed domain prefix
-- Format: domain_name.service.agent.scope_system (e.g., finance.prod.billing.db-admin)

CREATE TABLE scopes (
    scope_id        TEXT PRIMARY KEY,
    organization_id UUID NOT NULL,
    domain_name     TEXT NOT NULL,
    service         TEXT,
    agent           TEXT,
    scope_system    TEXT,
    environment     TEXT,
    tenant          TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    CONSTRAINT scopes_organization_domain_fkey
        FOREIGN KEY (organization_id, domain_name)
        REFERENCES domains(organization_id, domain_name),
    
    CONSTRAINT scopes_domain_name_slug_format 
        CHECK (domain_name ~ '^[a-z0-9_-]+$'),
    
    CONSTRAINT scopes_scope_id_slug_format
        CHECK (scope_id ~ '^[a-z0-9._-]+$')
);

CREATE INDEX idx_scopes_organization ON scopes (organization_id);
CREATE INDEX idx_scopes_domain ON scopes (domain_name);
CREATE INDEX idx_scopes_organization_domain ON scopes (organization_id, domain_name);
CREATE INDEX idx_scopes_service ON scopes (service);
CREATE INDEX idx_scopes_environment ON scopes (environment);
CREATE INDEX idx_scopes_tenant ON scopes (tenant);

-- Idempotent insert support
--CREATE UNIQUE INDEX idx_scopes_unique ON scopes (
--    organization_id,
--    domain_name,
--    COALESCE(service, ''),
--    COALESCE(agent, ''),
--    COALESCE(scope_system, ''),
--    COALESCE(environment, ''),
--    COALESCE(tenant, '')
--);

-- =============================================================================
-- POLICY SNAPSHOTS TABLE
-- =============================================================================
-- RFC-002: Immutable policy snapshots bound to organization + domain

CREATE TABLE policy_snapshots (
    snapshot_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL,
    domain_name     TEXT NOT NULL,
    version         INTEGER NOT NULL DEFAULT 1,
    policies        JSONB NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    CONSTRAINT policy_snapshots_organization_domain_fkey
        FOREIGN KEY (organization_id, domain_name)
        REFERENCES domains(organization_id, domain_name),
    
    CONSTRAINT policy_snapshots_domain_name_slug_format 
        CHECK (domain_name ~ '^[a-z0-9_-]+$'),
    
    CONSTRAINT policy_snapshots_version_positive 
        CHECK (version > 0),
    
    CONSTRAINT policy_snapshots_policies_array 
        CHECK (jsonb_typeof(policies) = 'array')
);

CREATE INDEX idx_policy_snapshots_organization ON policy_snapshots (organization_id);
CREATE INDEX idx_policy_snapshots_domain ON policy_snapshots (domain_name);
CREATE INDEX idx_policy_snapshots_organization_domain ON policy_snapshots (organization_id, domain_name);
CREATE INDEX idx_policy_snapshots_created_at ON policy_snapshots (created_at DESC);

-- =============================================================================
-- DECISION EVENTS TABLE
-- =============================================================================
-- RFC-002: Immutable, append-only; bound to organization + domain for audit isolation
-- RFC-001: Includes spec_id and spec_version for auditability

CREATE TABLE decision_events (
    decision_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL,
    domain_name     TEXT NOT NULL,
    intent          TEXT NOT NULL,
    stage           stage NOT NULL,
    actor           TEXT NOT NULL,
    target          TEXT NOT NULL,
    context         JSONB NOT NULL DEFAULT '{}',
    scope           JSONB NOT NULL DEFAULT '{}',
    timestamp       TIMESTAMPTZ NOT NULL,
    spec_id         TEXT,
    spec_version    TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    CONSTRAINT decision_events_organization_domain_fkey
        FOREIGN KEY (organization_id, domain_name)
        REFERENCES domains(organization_id, domain_name),
    
    CONSTRAINT decision_events_domain_name_slug_format 
        CHECK (domain_name ~ '^[a-z0-9_-]+$')
);

CREATE INDEX idx_decision_events_organization ON decision_events (organization_id);
CREATE INDEX idx_decision_events_domain ON decision_events (domain_name);
CREATE INDEX idx_decision_events_organization_domain ON decision_events (organization_id, domain_name);
CREATE INDEX idx_decision_events_intent ON decision_events (intent);
CREATE INDEX idx_decision_events_stage ON decision_events (stage);
CREATE INDEX idx_decision_events_actor ON decision_events (actor);
CREATE INDEX idx_decision_events_target ON decision_events (target);
CREATE INDEX idx_decision_events_timestamp ON decision_events (timestamp DESC);
CREATE INDEX idx_decision_events_created_at ON decision_events (created_at DESC);
CREATE INDEX idx_decision_events_scope ON decision_events USING GIN (scope);
CREATE INDEX idx_decision_events_context ON decision_events USING GIN (context);
CREATE INDEX idx_decision_events_spec_id ON decision_events (spec_id, spec_version);

-- =============================================================================
-- VERDICT EVENTS TABLE
-- =============================================================================
-- RFC-002: Immutable verdicts; audit-critical with organization_id, domain_name, scope_id
-- RFC-001: Includes spec_id and spec_version for auditability

CREATE TABLE verdict_events (
    verdict_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID NOT NULL,
    domain_name         TEXT NOT NULL,
    decision_id         UUID NOT NULL REFERENCES decision_events(decision_id),
    snapshot_id         UUID NOT NULL REFERENCES policy_snapshots(snapshot_id),
    scope_id            TEXT,
    verdict             verdict NOT NULL,
    matched_policy_ids  TEXT[] NOT NULL DEFAULT '{}',
    timestamp           TIMESTAMPTZ NOT NULL,
    spec_id             TEXT,
    spec_version        TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    CONSTRAINT verdict_events_organization_domain_fkey
        FOREIGN KEY (organization_id, domain_name)
        REFERENCES domains(organization_id, domain_name),
    
    CONSTRAINT verdict_events_domain_name_slug_format 
        CHECK (domain_name ~ '^[a-z0-9_-]+$'),
    
    CONSTRAINT verdict_events_scope_id_slug_format
        CHECK (scope_id IS NULL OR scope_id ~ '^[a-z0-9._-]+$')
);

CREATE INDEX idx_verdict_events_organization ON verdict_events (organization_id);
CREATE INDEX idx_verdict_events_domain ON verdict_events (domain_name);
CREATE INDEX idx_verdict_events_organization_domain ON verdict_events (organization_id, domain_name);
CREATE INDEX idx_verdict_events_decision_id ON verdict_events (decision_id);
CREATE INDEX idx_verdict_events_snapshot_id ON verdict_events (snapshot_id);
CREATE INDEX idx_verdict_events_scope_id ON verdict_events (scope_id);
CREATE INDEX idx_verdict_events_verdict ON verdict_events (verdict);
CREATE INDEX idx_verdict_events_timestamp ON verdict_events (timestamp DESC);
CREATE INDEX idx_verdict_events_created_at ON verdict_events (created_at DESC);
CREATE INDEX idx_verdict_events_matched_policies ON verdict_events USING GIN (matched_policy_ids);
CREATE INDEX idx_verdict_events_spec_id ON verdict_events (spec_id, spec_version);

-- =============================================================================
-- AUDIT TIMELINE ENTRIES TABLE
-- =============================================================================
-- RFC-002: Append-only compliance artifact; bound to organization + domain

CREATE TABLE audit_timeline_entries (
    entry_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID NOT NULL,
    domain_name         TEXT NOT NULL,
    decision_id         UUID NOT NULL REFERENCES decision_events(decision_id),
    intent              TEXT NOT NULL,
    stage               stage NOT NULL,
    actor               TEXT NOT NULL,
    target              TEXT NOT NULL,
    summary             TEXT NOT NULL,
    details             JSONB NOT NULL DEFAULT '{}',
    severity            TEXT NOT NULL,
    event_source        event_source NOT NULL,
    authority_level     authority_level NOT NULL,
    timestamp           TIMESTAMPTZ NOT NULL,
    spec_id             TEXT,
    spec_version        TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    CONSTRAINT audit_timeline_organization_domain_fkey
        FOREIGN KEY (organization_id, domain_name)
        REFERENCES domains(organization_id, domain_name),
    
    CONSTRAINT audit_timeline_domain_name_slug_format 
        CHECK (domain_name ~ '^[a-z0-9_-]+$')
);

CREATE INDEX idx_audit_timeline_organization ON audit_timeline_entries (organization_id);
CREATE INDEX idx_audit_timeline_domain ON audit_timeline_entries (domain_name);
CREATE INDEX idx_audit_timeline_organization_domain ON audit_timeline_entries (organization_id, domain_name);
CREATE INDEX idx_audit_timeline_decision_id ON audit_timeline_entries (decision_id);
CREATE INDEX idx_audit_timeline_intent ON audit_timeline_entries (intent);
CREATE INDEX idx_audit_timeline_stage ON audit_timeline_entries (stage);
CREATE INDEX idx_audit_timeline_actor ON audit_timeline_entries (actor);
CREATE INDEX idx_audit_timeline_severity ON audit_timeline_entries (severity);
CREATE INDEX idx_audit_timeline_source ON audit_timeline_entries (event_source);
CREATE INDEX idx_audit_timeline_authority_level ON audit_timeline_entries (authority_level);
CREATE INDEX idx_audit_timeline_timestamp ON audit_timeline_entries (timestamp DESC);
CREATE INDEX idx_audit_timeline_created_at ON audit_timeline_entries (created_at DESC);
CREATE INDEX idx_audit_timeline_details ON audit_timeline_entries USING GIN (details);
CREATE INDEX idx_audit_timeline_spec_id ON audit_timeline_entries (spec_id, spec_version);

-- =============================================================================
-- DECISION SPECS TABLE
-- =============================================================================
-- RFC-001: Decision Specs as immutable first-class primitives
-- Specs define contracts for governed decisions. Once active, immutable.

CREATE TABLE mandate_specs (
    spec_id           TEXT NOT NULL,
    version           TEXT NOT NULL,
    organization_id   UUID NOT NULL,
    domain_name       TEXT NOT NULL,
    intent            TEXT NOT NULL,
    stage             stage NOT NULL,
    allowed_verdicts  verdict[] NOT NULL,
    signals           JSONB NOT NULL,
    enforcement       JSONB NOT NULL,
    status            TEXT NOT NULL CHECK (status IN ('draft', 'active', 'deprecated')),
    replaced_by       TEXT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    PRIMARY KEY (spec_id, version),
    
    CONSTRAINT mandate_specs_organization_domain_fkey
        FOREIGN KEY (organization_id, domain_name)
        REFERENCES domains(organization_id, domain_name),
    
    CONSTRAINT mandate_specs_domain_name_slug_format 
        CHECK (domain_name ~ '^[a-z0-9_-]+$'),
    
    CONSTRAINT mandate_specs_signals_array 
        CHECK (jsonb_typeof(signals) = 'array'),
    
    CONSTRAINT mandate_specs_enforcement_object 
        CHECK (jsonb_typeof(enforcement) = 'object')
);

CREATE INDEX idx_mandate_specs_organization_id ON mandate_specs (organization_id);
CREATE INDEX idx_mandate_specs_domain ON mandate_specs (domain_name);
CREATE INDEX idx_mandate_specs_intent ON mandate_specs (intent);
CREATE INDEX idx_mandate_specs_stage ON mandate_specs (stage);
CREATE INDEX idx_mandate_specs_status ON mandate_specs (status);
CREATE INDEX idx_mandate_specs_created_at ON mandate_specs (created_at DESC);

-- Unique constraint: only one active spec per (org, domain, intent, stage)
CREATE UNIQUE INDEX idx_mandate_specs_active_unique
ON mandate_specs (organization_id, domain_name, intent, stage)
WHERE status = 'active';

-- =============================================================================
-- TRIGGERS: SCOPE_ID DOMAIN PREFIX VALIDATION (RFC-002)
-- =============================================================================
-- RFC-002 Section 3.3: scope_id MUST embed domain prefix
-- Enforced at insert time

CREATE OR REPLACE FUNCTION validate_scope_id_domain_prefix()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.scope_id IS NOT NULL AND NEW.domain_name IS NOT NULL THEN
        IF NOT (NEW.scope_id LIKE NEW.domain_name || '.%') THEN
            RAISE EXCEPTION 'GOVERNANCE VIOLATION: scope_id % does not embed domain prefix % (expected format: domain.service.agent.scope)', 
                NEW.scope_id, NEW.domain_name;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validate_scopes_scope_id_domain_prefix
    BEFORE INSERT ON scopes
    FOR EACH ROW EXECUTE FUNCTION validate_scope_id_domain_prefix();

CREATE TRIGGER validate_verdict_events_scope_id_domain_prefix
    BEFORE INSERT ON verdict_events
    FOR EACH ROW EXECUTE FUNCTION validate_scope_id_domain_prefix();

-- =============================================================================
-- TRIGGERS: APPEND-ONLY ENFORCEMENT
-- =============================================================================
-- Immutability for all event tables

CREATE OR REPLACE FUNCTION prevent_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Mutations are not allowed on append-only table %', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prevent_decision_events_mutation
    BEFORE UPDATE OR DELETE ON decision_events
    FOR EACH ROW EXECUTE FUNCTION prevent_mutation();

CREATE TRIGGER prevent_verdict_events_mutation
    BEFORE UPDATE OR DELETE ON verdict_events
    FOR EACH ROW EXECUTE FUNCTION prevent_mutation();

CREATE TRIGGER prevent_audit_timeline_mutation
    BEFORE UPDATE OR DELETE ON audit_timeline_entries
    FOR EACH ROW EXECUTE FUNCTION prevent_mutation();

CREATE TRIGGER prevent_policy_snapshots_mutation
    BEFORE UPDATE OR DELETE ON policy_snapshots
    FOR EACH ROW EXECUTE FUNCTION prevent_mutation();

CREATE TRIGGER prevent_mandate_specs_mutation
    BEFORE UPDATE OR DELETE ON mandate_specs
    FOR EACH ROW EXECUTE FUNCTION prevent_mutation();

COMMIT;
