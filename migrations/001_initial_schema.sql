-- Mandate Control Plane - Initial Schema
-- Version: 001
-- Rules: Append-only, no UPDATE/DELETE, immutable data
-- Aligned to BUILD-PLAN-v1.1 and RFC-001

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
-- SCOPES TABLE
-- =============================================================================
-- Scope defines where policies apply.
-- All selector fields must match; missing fields act as wildcards.
-- Empty selector applies globally.
-- @see RFC-001 Section 8

CREATE TABLE scopes (
    scope_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scope_domain    TEXT,
    service         TEXT,
    agent           TEXT,
    scope_system    TEXT,
    environment     TEXT,
    tenant          TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_scopes_domain ON scopes (scope_domain);
CREATE INDEX idx_scopes_service ON scopes (service);
CREATE INDEX idx_scopes_environment ON scopes (environment);
CREATE INDEX idx_scopes_tenant ON scopes (tenant);

-- Idempotent insert support via unique constraint on scope fields
CREATE UNIQUE INDEX idx_scopes_unique ON scopes (
    COALESCE(scope_domain, ''),
    COALESCE(service, ''),
    COALESCE(agent, ''),
    COALESCE(scope_system, ''),
    COALESCE(environment, ''),
    COALESCE(tenant, '')
);

-- =============================================================================
-- POLICY SNAPSHOTS TABLE
-- =============================================================================
-- Immutable policy snapshots.
-- Policies are grouped into immutable snapshots.
-- Snapshots are never edited; historical verdicts are never re-evaluated.
-- @see RFC-001 Section 11, BUILD-PLAN Section 7

CREATE TABLE policy_snapshots (
    snapshot_id     UUID PRIMARY KEY,
    version         INTEGER NOT NULL DEFAULT 1,
    policies        JSONB NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    CONSTRAINT policy_snapshots_version_positive CHECK (version > 0),
    CONSTRAINT policy_snapshots_policies_array CHECK (jsonb_typeof(policies) = 'array')
);

CREATE INDEX idx_policy_snapshots_created_at ON policy_snapshots (created_at DESC);

-- =============================================================================
-- DECISION EVENTS TABLE
-- =============================================================================
-- A DecisionEvent declares intent to perform an action.
-- Immutable, append-only, contextual (not executable).
-- @see RFC-001 Section 5.1

CREATE TABLE decision_events (
    decision_id     UUID PRIMARY KEY,
    intent          TEXT NOT NULL,
    stage           stage NOT NULL,
    actor           TEXT NOT NULL,
    target          TEXT NOT NULL,
    context         JSONB NOT NULL DEFAULT '{}',
    scope           JSONB NOT NULL DEFAULT '{}',
    timestamp       TIMESTAMPTZ NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_decision_events_intent ON decision_events (intent);
CREATE INDEX idx_decision_events_stage ON decision_events (stage);
CREATE INDEX idx_decision_events_actor ON decision_events (actor);
CREATE INDEX idx_decision_events_target ON decision_events (target);
CREATE INDEX idx_decision_events_timestamp ON decision_events (timestamp DESC);
CREATE INDEX idx_decision_events_created_at ON decision_events (created_at DESC);
CREATE INDEX idx_decision_events_scope ON decision_events USING GIN (scope);
CREATE INDEX idx_decision_events_context ON decision_events USING GIN (context);

-- =============================================================================
-- VERDICT EVENTS TABLE
-- =============================================================================
-- A VerdictEvent is Mandate's authoritative response to a DecisionEvent.
-- Verdicts express governance intent only.
-- @see RFC-001 Section 5.2

CREATE TABLE verdict_events (
    verdict_id          UUID PRIMARY KEY,
    decision_id         UUID NOT NULL REFERENCES decision_events(decision_id),
    snapshot_id         UUID NOT NULL REFERENCES policy_snapshots(snapshot_id),
    verdict             verdict NOT NULL,
    matched_policy_ids  TEXT[] NOT NULL DEFAULT '{}',
    timestamp           TIMESTAMPTZ NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_verdict_events_decision_id ON verdict_events (decision_id);
CREATE INDEX idx_verdict_events_snapshot_id ON verdict_events (snapshot_id);
CREATE INDEX idx_verdict_events_verdict ON verdict_events (verdict);
CREATE INDEX idx_verdict_events_timestamp ON verdict_events (timestamp DESC);
CREATE INDEX idx_verdict_events_created_at ON verdict_events (created_at DESC);
CREATE INDEX idx_verdict_events_matched_policies ON verdict_events USING GIN (matched_policy_ids);

-- =============================================================================
-- AUDIT TIMELINE ENTRIES TABLE
-- =============================================================================
-- An entry in the append-only audit timeline.
-- Primary compliance artifact.
-- Authority-aware with source and authority_level.
-- @see RFC-001 Section 12, BUILD-PLAN Section 9

CREATE TABLE audit_timeline_entries (
    entry_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

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

-- =============================================================================
-- APPEND-ONLY ENFORCEMENT (TRIGGERS)
-- =============================================================================
-- These triggers enforce immutability by preventing UPDATE and DELETE operations.
-- This is a defense-in-depth measure aligned with R0.4 (Append-Only).

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

CREATE TRIGGER prevent_scopes_mutation
    BEFORE UPDATE OR DELETE ON scopes
    FOR EACH ROW EXECUTE FUNCTION prevent_mutation();

CREATE TRIGGER prevent_policy_snapshots_mutation
    BEFORE UPDATE OR DELETE ON policy_snapshots
    FOR EACH ROW EXECUTE FUNCTION prevent_mutation();

COMMIT;
