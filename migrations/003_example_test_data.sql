-- Mandate Control Plane - Example Test Data
-- Version: 003
-- Initialization data for running example agents
-- Rules: Append-only, immutable inserts only
-- RFC-002: Uses domain_name (text slug), NOT domain_id (UUID)

BEGIN;

SET search_path TO mandate;

-- =============================================================================
-- TEST ORGANIZATION & DOMAIN
-- =============================================================================
-- Creates a test organization and domain for example agents to use.
-- Uses deterministic UUID for reproducibility.

INSERT INTO organizations (organization_id, name)
VALUES (
  '550e8400-e29b-41d4-a716-446655440000'::UUID,
  'example-org'
)
ON CONFLICT (organization_id) DO NOTHING;

-- Create domain in the test organization
-- RFC-002: domain_name is TEXT slug (lowercase alphanumeric + dash/underscore)
INSERT INTO domains (organization_id, domain_name, description)
VALUES (
  '550e8400-e29b-41d4-a716-446655440000'::UUID,
  'config-management',
  'Config management domain for examples'
)
ON CONFLICT (organization_id, domain_name) DO NOTHING;

-- =============================================================================
-- DEFAULT SCOPE
-- =============================================================================
-- Creates a default scope for the test domain to satisfy scope matching.
-- RFC-002: scope_id is TEXT with domain prefix (e.g., config-management.prod.billing)

INSERT INTO scopes (
  scope_id,
  organization_id,
  domain_name,
  service,
  agent,
  scope_system,
  environment
)
VALUES (
  'config-management.default',
  '550e8400-e29b-41d4-a716-446655440000'::UUID,
  'config-management',
  NULL,
  NULL,
  NULL,
  'prod'
)
ON CONFLICT DO NOTHING;

COMMIT;
