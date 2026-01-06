-- Mandate Control Plane - Example Policy Snapshot
-- Version: 004
-- Test policy snapshot for example agents
-- Rules: Append-only, immutable policies

BEGIN;

SET search_path TO mandate;

-- =============================================================================
-- POLICY SNAPSHOT FOR TEST DOMAIN
-- =============================================================================
-- Creates an empty policy snapshot for the example-org/config-management domain.
-- This allows the example agents to run without policy constraints.
-- New policies can be added by creating new snapshots.

INSERT INTO policy_snapshots (snapshot_id, version, policies, organization_id, domain_id, created_at)
VALUES (
  '550e8400-e29b-41d4-a716-446655440010'::UUID,
  1,
  '[]'::JSONB,
  '550e8400-e29b-41d4-a716-446655440000'::UUID,
  '550e8400-e29b-41d4-a716-446655440001'::UUID,
  now()
)
ON CONFLICT (snapshot_id) DO NOTHING;

COMMIT;
