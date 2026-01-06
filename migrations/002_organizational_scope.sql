-- Mandate Control Plane - Organizational Scope & Governance Isolation
-- Version: 002
-- Rules: Append-only, no UPDATE/DELETE, immutable data
-- Aligned to RFC-002: Organizational Scope & Governance Isolation (Non-SaaS)

BEGIN;

SET search_path TO mandate;

-- =============================================================================
-- ORGANIZATIONS TABLE
-- =============================================================================
-- Top-level governance boundary.
-- Exactly one organization in non-SaaS v1 (forward compatible).
-- @see RFC-002 Section 4.1

CREATE TABLE organizations (
    organization_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                TEXT NOT NULL,
    description         TEXT,
    metadata            JSONB NOT NULL DEFAULT '{}',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_organizations_name ON organizations (name);
CREATE INDEX idx_organizations_created_at ON organizations (created_at DESC);

-- =============================================================================
-- DOMAINS TABLE
-- =============================================================================
-- Functional or business area within an organization.
-- Primary unit of policy isolation.
-- @see RFC-002 Section 4.2

CREATE TABLE domains (
    domain_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID NOT NULL REFERENCES organizations(organization_id),
    name                TEXT NOT NULL,
    description         TEXT,
    metadata            JSONB NOT NULL DEFAULT '{}',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    CONSTRAINT domains_unique_name_per_org UNIQUE (organization_id, name)
);

CREATE INDEX idx_domains_organization_id ON domains (organization_id);
CREATE INDEX idx_domains_name ON domains (name);
CREATE INDEX idx_domains_created_at ON domains (created_at DESC);

-- =============================================================================
-- EXTEND SCOPES TABLE - ADD OWNERSHIP METADATA
-- =============================================================================
-- Scope ownership for accountability and audit explanations.
-- @see RFC-002 Section 5

ALTER TABLE scopes
    ADD COLUMN organization_id  UUID REFERENCES organizations(organization_id),
    ADD COLUMN domain_id        UUID REFERENCES domains(domain_id),
    ADD COLUMN owning_team      TEXT,
    ADD COLUMN owner_contact    TEXT,
    ADD COLUMN description      TEXT;

CREATE INDEX idx_scopes_organization_id ON scopes (organization_id);
CREATE INDEX idx_scopes_domain_id ON scopes (domain_id);
CREATE INDEX idx_scopes_owning_team ON scopes (owning_team);

-- =============================================================================
-- EXTEND POLICY SNAPSHOTS - ADD ORGANIZATIONAL CONTEXT
-- =============================================================================
-- Policies must be associated with exactly one scope/domain.
-- @see RFC-002 Section 6

ALTER TABLE policy_snapshots
    ADD COLUMN organization_id  UUID REFERENCES organizations(organization_id),
    ADD COLUMN domain_id        UUID REFERENCES domains(domain_id);

CREATE INDEX idx_policy_snapshots_organization_id ON policy_snapshots (organization_id);
CREATE INDEX idx_policy_snapshots_domain_id ON policy_snapshots (domain_id);

-- =============================================================================
-- EXTEND DECISION EVENTS - ADD ORGANIZATIONAL ATTRIBUTION
-- =============================================================================
-- Every DecisionEvent must include context for attribution.
-- @see RFC-002 Section 8

ALTER TABLE decision_events
    ADD COLUMN organization_id  UUID REFERENCES organizations(organization_id),
    ADD COLUMN domain_id        UUID REFERENCES domains(domain_id);

CREATE INDEX idx_decision_events_organization_id ON decision_events (organization_id);
CREATE INDEX idx_decision_events_domain_id ON decision_events (domain_id);

-- =============================================================================
-- EXTEND VERDICT EVENTS - ADD ORGANIZATIONAL CONTEXT
-- =============================================================================
-- Verdicts preserve organizational context for isolation guarantees.
-- @see RFC-002 Section 9

ALTER TABLE verdict_events
    ADD COLUMN organization_id  UUID REFERENCES organizations(organization_id),
    ADD COLUMN domain_id        UUID REFERENCES domains(domain_id);

CREATE INDEX idx_verdict_events_organization_id ON verdict_events (organization_id);
CREATE INDEX idx_verdict_events_domain_id ON verdict_events (domain_id);

-- =============================================================================
-- EXTEND AUDIT TIMELINE - ADD ORGANIZATIONAL CONTEXT
-- =============================================================================
-- Audit trails must remain domain-consistent.
-- @see RFC-002 Section 9, Section 10

ALTER TABLE audit_timeline_entries
    ADD COLUMN organization_id  UUID REFERENCES organizations(organization_id),
    ADD COLUMN domain_id        UUID REFERENCES domains(domain_id);

CREATE INDEX idx_audit_timeline_organization_id ON audit_timeline_entries (organization_id);
CREATE INDEX idx_audit_timeline_domain_id ON audit_timeline_entries (domain_id);

-- =============================================================================
-- APPEND-ONLY ENFORCEMENT FOR NEW TABLES
-- =============================================================================

CREATE TRIGGER prevent_organizations_mutation
    BEFORE UPDATE OR DELETE ON organizations
    FOR EACH ROW EXECUTE FUNCTION prevent_mutation();

CREATE TRIGGER prevent_domains_mutation
    BEFORE UPDATE OR DELETE ON domains
    FOR EACH ROW EXECUTE FUNCTION prevent_mutation();

COMMIT;
