-- Mandate Control Plane - Example Test Data
-- Version: 003
-- Initialization data for running example agents
-- Rules: Append-only, idempotent inserts only

BEGIN;

SET search_path TO mandate;

-- =============================================================================
-- TEST ORGANIZATION & DOMAIN
-- =============================================================================
-- Creates a test organization and domain for example agents to use.
-- Uses deterministic UUID for reproducibility.

INSERT INTO organizations (organization_id, name, description)
VALUES (
  '550e8400-e29b-41d4-a716-446655440000'::UUID,
  'example-org',
  'Test organization for example agents'
)
ON CONFLICT (organization_id) DO NOTHING;

-- Create domain in the test organization
INSERT INTO domains (domain_id, organization_id, name, description)
VALUES (
  '550e8400-e29b-41d4-a716-446655440001'::UUID,
  '550e8400-e29b-41d4-a716-446655440000'::UUID,
  'config-management',
  'Config management domain for examples'
)
ON CONFLICT (organization_id, name) DO NOTHING;

-- =============================================================================
-- DEFAULT SCOPE
-- =============================================================================
-- Creates a default scope for the test domain to satisfy scope matching.

INSERT INTO scopes (
  scope_id,
  organization_id,
  domain_id,
  scope_domain,
  description
)
VALUES (
  '550e8400-e29b-41d4-a716-446655440002'::UUID,
  '550e8400-e29b-41d4-a716-446655440000'::UUID,
  '550e8400-e29b-41d4-a716-446655440001'::UUID,
  'config-management',
  'Default scope for config-management domain'
)
ON CONFLICT (
  COALESCE(scope_domain, ''),
  COALESCE(service, ''),
  COALESCE(agent, ''),
  COALESCE(scope_system, ''),
  COALESCE(environment, ''),
  COALESCE(tenant, '')
) DO NOTHING;

COMMIT;
