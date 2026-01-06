-- Mandate Control Plane - Add scope_id and domain to verdict_events
-- Version: 007
-- RFC-002: Add scope attribution and domain field to verdict events for isolation

BEGIN;

SET search_path TO mandate;

-- =============================================================================
-- ADD SCOPE_ID AND DOMAIN TO VERDICT_EVENTS
-- =============================================================================
-- RFC-002: Verdicts must record which scope matched (for auditability)
-- RFC-002: Verdicts must record domain for isolation enforcement

ALTER TABLE verdict_events
    ADD COLUMN scope_id   UUID REFERENCES scopes(scope_id),
    ADD COLUMN domain     TEXT;

CREATE INDEX idx_verdict_events_scope_id ON verdict_events (scope_id);
CREATE INDEX idx_verdict_events_domain ON verdict_events (domain);

-- =============================================================================
-- ADD OWNING_TEAM TO VERDICT_EVENTS
-- =============================================================================
-- RFC-002: Track ownership for audit accountability

ALTER TABLE verdict_events
    ADD COLUMN owning_team TEXT;

CREATE INDEX idx_verdict_events_owning_team ON verdict_events (owning_team);

COMMIT;
