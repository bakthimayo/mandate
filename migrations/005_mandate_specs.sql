-- Mandate Control Plane - Decision Specs Table
-- Version: 005
-- RFC-001 v1.1: Decision Specs as first-class primitives
-- Aligned to BUILD-PLAN-v1.2

BEGIN;

SET search_path TO mandate;

-- =============================================================================
-- DECISION SPECS TABLE (mandate_specs)
-- =============================================================================
-- Decision Specs are immutable contracts that define governance rules.
-- Once active, they MUST NOT be modified or deleted.
-- @see RFC-001 Section 4.2, Section 5, BUILD-PLAN-v1.2 Section 5

CREATE TABLE mandate_specs (
    spec_id           TEXT NOT NULL,
    version           TEXT NOT NULL,
    organization_id   UUID NOT NULL,

    domain             TEXT NOT NULL,
    intent             TEXT NOT NULL,
    stage              stage NOT NULL,

    allowed_verdicts   verdict[] NOT NULL,
    signals            JSONB NOT NULL,
    enforcement        JSONB NOT NULL,

    status             TEXT NOT NULL CHECK (status IN ('draft', 'active', 'deprecated')),
    replaced_by        TEXT NULL,

    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),

    PRIMARY KEY (spec_id, version),
    CONSTRAINT spec_signals_is_array CHECK (jsonb_typeof(signals) = 'array'),
    CONSTRAINT spec_enforcement_is_object CHECK (jsonb_typeof(enforcement) = 'object')
);

-- Indexes for spec resolution
CREATE INDEX idx_mandate_specs_organization_id ON mandate_specs (organization_id);
CREATE INDEX idx_mandate_specs_domain ON mandate_specs (domain);
CREATE INDEX idx_mandate_specs_intent ON mandate_specs (intent);
CREATE INDEX idx_mandate_specs_stage ON mandate_specs (stage);
CREATE INDEX idx_mandate_specs_status ON mandate_specs (status);
CREATE INDEX idx_mandate_specs_created_at ON mandate_specs (created_at DESC);

-- Unique constraint: only one active spec per (org, domain, intent, stage)
CREATE UNIQUE INDEX idx_mandate_specs_active_unique
ON mandate_specs (organization_id, domain, intent, stage)
WHERE status = 'active';

-- =============================================================================
-- APPEND-ONLY ENFORCEMENT FOR MANDATE_SPECS
-- =============================================================================
-- Prevent UPDATE/DELETE on specs per R0.4 (Append-Only)

CREATE TRIGGER prevent_mandate_specs_mutation
    BEFORE UPDATE OR DELETE ON mandate_specs
    FOR EACH ROW EXECUTE FUNCTION prevent_mutation();

-- =============================================================================
-- UPDATE DECISION_EVENTS TABLE
-- =============================================================================
-- Add spec_id and spec_version to decision_events
-- @see RFC-001 Section 12

ALTER TABLE decision_events
ADD COLUMN spec_id TEXT,
ADD COLUMN spec_version TEXT;

CREATE INDEX idx_decision_events_spec_id ON decision_events (spec_id, spec_version);

-- =============================================================================
-- UPDATE VERDICT_EVENTS TABLE
-- =============================================================================
-- Add spec_id and spec_version to verdict_events
-- @see RFC-001 Section 12

ALTER TABLE verdict_events
ADD COLUMN spec_id TEXT,
ADD COLUMN spec_version TEXT;

CREATE INDEX idx_verdict_events_spec_id ON verdict_events (spec_id, spec_version);

-- =============================================================================
-- UPDATE AUDIT_TIMELINE_ENTRIES TABLE
-- =============================================================================
-- Add spec_id and spec_version to audit timeline
-- @see BUILD-PLAN-v1.2 Section 10

ALTER TABLE audit_timeline_entries
ADD COLUMN spec_id TEXT,
ADD COLUMN spec_version TEXT;

CREATE INDEX idx_audit_timeline_spec_id ON audit_timeline_entries (spec_id, spec_version);

COMMIT;
