-- Mandate Control Plane - Sample Specs and Policies for Example Agents
-- Version: 007
-- Test data aligned to RFC-002 v1.2: domain_name (text slug) and scope_id (text with domain prefix)
-- 
-- This migration creates:
-- 1. Domain record for config-management
-- 2. DecisionSpecs for pre-commit-agent, pause-escalation-agent, and observe-agent
-- 3. Scopes for each agent with proper organizational binding
-- 4. Sample Policies that match specs and scopes
-- 5. Policy snapshot containing the sample policies

BEGIN;

SET search_path TO mandate;

-- =============================================================================
-- ENSURE ORGANIZATION EXISTS
-- =============================================================================
-- Use fixed UUID for consistent test data
INSERT INTO organizations (organization_id, name)
VALUES ('550e8400-e29b-41d4-a716-446655440000'::UUID, 'example-org')
ON CONFLICT DO NOTHING;

-- =============================================================================
-- ENSURE DOMAIN EXISTS
-- =============================================================================
-- RFC-002 v1.2: domain_name is TEXT slug, not UUID
INSERT INTO domains (organization_id, domain_name, description)
VALUES (
  '550e8400-e29b-41d4-a716-446655440000'::UUID,
  'config-management',
  'Configuration management and deployment governance'
)
ON CONFLICT DO NOTHING;

-- =============================================================================
-- SAMPLE DECISION SPECS FOR EXAMPLE AGENTS
-- =============================================================================

-- Pre-Commit Agent: file.write at pre_commit stage
INSERT INTO mandate_specs (spec_id, version, organization_id, domain_name, intent, stage, allowed_verdicts, signals, enforcement, status, created_at)
VALUES (
  'spec-pre-commit-file-write-v1',
  '1',
  '550e8400-e29b-41d4-a716-446655440000'::UUID,
  'config-management',
  'file.write',
  'pre_commit'::stage,
  ARRAY['ALLOW', 'BLOCK', 'PAUSE', 'OBSERVE']::verdict[],
  '[
    {
      "name": "content_length",
      "type": "number",
      "required": true,
      "source": "context"
    },
    {
      "name": "content_type",
      "type": "string",
      "required": true,
      "source": "context"
    },
    {
      "name": "target",
      "type": "string",
      "required": false,
      "source": "context"
    },
    {
      "name": "service",
      "type": "string",
      "required": false,
      "source": "scope"
    }
  ]'::JSONB,
  '{
    "pause_requires": ["compliance-review"],
    "resolution_timeout_minutes": 60
  }'::JSONB,
  'active',
  now()
)
ON CONFLICT DO NOTHING;

-- Pause-Escalation Agent: database.drop_table at pre_commit stage
INSERT INTO mandate_specs (spec_id, version, organization_id, domain_name, intent, stage, allowed_verdicts, signals, enforcement, status, created_at)
VALUES (
  'spec-pre-commit-database-drop-table-v1',
  '1',
  '550e8400-e29b-41d4-a716-446655440000'::UUID,
  'config-management',
  'database.drop_table',
  'pre_commit'::stage,
  ARRAY['ALLOW', 'BLOCK', 'PAUSE', 'OBSERVE']::verdict[],
  '[
    {
      "name": "risk_level",
      "type": "enum",
      "values": ["low", "medium", "high", "critical"],
      "required": true,
      "source": "context"
    },
    {
      "name": "reversible",
      "type": "boolean",
      "required": true,
      "source": "context"
    },
    {
      "name": "backup_first",
      "type": "boolean",
      "required": true,
      "source": "context"
    },
    {
      "name": "target",
      "type": "string",
      "required": false,
      "source": "context"
    }
  ]'::JSONB,
  '{
    "pause_requires": ["dba-approval", "compliance-review"],
    "resolution_timeout_minutes": 120
  }'::JSONB,
  'active',
  now()
)
ON CONFLICT DO NOTHING;

-- Observe-Only Agent: user.login at executed stage
INSERT INTO mandate_specs (spec_id, version, organization_id, domain_name, intent, stage, allowed_verdicts, signals, enforcement, status, created_at)
VALUES (
  'spec-executed-user-login-v1',
  '1',
  '550e8400-e29b-41d4-a716-446655440000'::UUID,
  'config-management',
  'user.login',
  'executed'::stage,
  ARRAY['OBSERVE']::verdict[],
  '[
    {
      "name": "user_id",
      "type": "string",
      "required": true,
      "source": "context"
    },
    {
      "name": "ip_address",
      "type": "string",
      "required": true,
      "source": "context"
    },
    {
      "name": "auth_method",
      "type": "enum",
      "values": ["password", "oauth", "mfa"],
      "required": true,
      "source": "context"
    }
  ]'::JSONB,
  '{}'::JSONB,
  'active',
  now()
)
ON CONFLICT DO NOTHING;

-- Observe-Only Agent: data.export at executed stage
INSERT INTO mandate_specs (spec_id, version, organization_id, domain_name, intent, stage, allowed_verdicts, signals, enforcement, status, created_at)
VALUES (
  'spec-executed-data-export-v1',
  '1',
  '550e8400-e29b-41d4-a716-446655440000'::UUID,
  'config-management',
  'data.export',
  'executed'::stage,
  ARRAY['OBSERVE']::verdict[],
  '[
    {
      "name": "format",
      "type": "enum",
      "values": ["csv", "json", "parquet"],
      "required": true,
      "source": "context"
    },
    {
      "name": "record_count",
      "type": "number",
      "required": true,
      "source": "context"
    },
    {
      "name": "includes_pii",
      "type": "boolean",
      "required": true,
      "source": "context"
    }
  ]'::JSONB,
  '{}'::JSONB,
  'active',
  now()
)
ON CONFLICT DO NOTHING;

-- Observe-Only Agent: config.update at executed stage
INSERT INTO mandate_specs (spec_id, version, organization_id, domain_name, intent, stage, allowed_verdicts, signals, enforcement, status, created_at)
VALUES (
  'spec-executed-config-update-v1',
  '1',
  '550e8400-e29b-41d4-a716-446655440000'::UUID,
  'config-management',
  'config.update',
  'executed'::stage,
  ARRAY['OBSERVE']::verdict[],
  '[
    {
      "name": "key",
      "type": "string",
      "required": true,
      "source": "context"
    },
    {
      "name": "old_value",
      "type": "string",
      "required": true,
      "source": "context"
    },
    {
      "name": "new_value",
      "type": "string",
      "required": true,
      "source": "context"
    }
  ]'::JSONB,
  '{}'::JSONB,
  'active',
  now()
)
ON CONFLICT DO NOTHING;

-- =============================================================================
-- SAMPLE SCOPES FOR EXAMPLE AGENTS
-- =============================================================================

-- RFC-002 v1.2: scope_id is TEXT with domain_name prefix (format: domain_name.service.agent.system)
-- Scope for pre-commit-agent (config-writer service at production)
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
  'config-management.config-writer.pre-commit-agent.prod',
  '550e8400-e29b-41d4-a716-446655440000'::UUID,
  'config-management',
  'config-writer',
  'pre-commit-agent',
  'prod',
  'production'
)
ON CONFLICT DO NOTHING;

-- Scope for pause-escalation-agent (db-admin-tool service at production)
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
  'config-management.db-admin-tool.pause-escalation-agent.prod',
  '550e8400-e29b-41d4-a716-446655440000'::UUID,
  'config-management',
  'db-admin-tool',
  'pause-escalation-agent',
  'prod',
  'production'
)
ON CONFLICT DO NOTHING;

-- Scope for observe-agent (audit-logger service at production)
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
  'config-management.audit-logger.observe-agent.prod',
  '550e8400-e29b-41d4-a716-446655440000'::UUID,
  'config-management',
  'audit-logger',
  'observe-agent',
  'prod',
  'production'
)
ON CONFLICT DO NOTHING;

-- =============================================================================
-- CONSOLIDATED POLICY SNAPSHOT
-- =============================================================================
-- All policies for all specs in a single snapshot (required by RFC-002 isolation)
-- getLatestPolicySnapshot returns only one snapshot per org/domain, so all 
-- policies must be in the same snapshot to be available for evaluation.

INSERT INTO policy_snapshots (snapshot_id, version, policies, organization_id, domain_name, created_at)
VALUES (
  '550e8400-e29b-41d4-a716-446655440200'::UUID,
  1,
  '[
    {
      "id": "policy-allow-small-files-v1",
      "organization_id": "550e8400-e29b-41d4-a716-446655440000",
      "domain_name": "config-management",
      "name": "Allow small file writes",
      "description": "Allow writing files under 1MB to production config",
      "scope": {
        "organization_id": "550e8400-e29b-41d4-a716-446655440000",
        "domain_name": "config-management",
        "service": "config-writer",
        "agent": "pre-commit-agent",
        "environment": "production"
      },
      "scope_id": "config-management.config-writer.pre-commit-agent.prod",
      "conditions": [
        {
          "field": "content_length",
          "operator": "<",
          "value": 1048576
        },
        {
          "field": "content_type",
          "operator": "in",
          "value": ["yaml", "json", "toml"]
        }
      ],
      "verdict": "ALLOW",
      "spec_id": "spec-pre-commit-file-write-v1"
    },
    {
      "id": "policy-pause-large-files-v1",
      "organization_id": "550e8400-e29b-41d4-a716-446655440000",
      "domain_name": "config-management",
      "name": "Pause large file writes",
      "description": "Require review for files over 1MB",
      "scope": {
        "organization_id": "550e8400-e29b-41d4-a716-446655440000",
        "domain_name": "config-management",
        "service": "config-writer",
        "agent": "pre-commit-agent",
        "environment": "production"
      },
      "scope_id": "config-management.config-writer.pre-commit-agent.prod",
      "conditions": [
        {
          "field": "content_length",
          "operator": ">=",
          "value": 1048576
        }
      ],
      "verdict": "PAUSE",
      "spec_id": "spec-pre-commit-file-write-v1"
    },
    {
      "id": "policy-block-unbackedup-drops-v1",
      "organization_id": "550e8400-e29b-41d4-a716-446655440000",
      "domain_name": "config-management",
      "name": "Block drops without backup",
      "description": "Block database drop_table if backup was not taken first",
      "scope": {
        "organization_id": "550e8400-e29b-41d4-a716-446655440000",
        "domain_name": "config-management",
        "service": "db-admin-tool",
        "agent": "pause-escalation-agent",
        "environment": "production"
      },
      "scope_id": "config-management.db-admin-tool.pause-escalation-agent.prod",
      "conditions": [
        {
          "field": "backup_first",
          "operator": "==",
          "value": false
        }
      ],
      "verdict": "BLOCK",
      "spec_id": "spec-pre-commit-database-drop-table-v1"
    },
    {
      "id": "policy-pause-critical-db-ops-v1",
      "organization_id": "550e8400-e29b-41d4-a716-446655440000",
      "domain_name": "config-management",
      "name": "Pause critical database operations",
      "description": "Require DBA approval for critical-level operations",
      "scope": {
        "organization_id": "550e8400-e29b-41d4-a716-446655440000",
        "domain_name": "config-management",
        "service": "db-admin-tool",
        "agent": "pause-escalation-agent",
        "environment": "production"
      },
      "scope_id": "config-management.db-admin-tool.pause-escalation-agent.prod",
      "conditions": [
        {
          "field": "risk_level",
          "operator": "==",
          "value": "critical"
        }
      ],
      "verdict": "PAUSE",
      "spec_id": "spec-pre-commit-database-drop-table-v1"
    },
    {
      "id": "policy-allow-low-risk-drops-v1",
      "organization_id": "550e8400-e29b-41d4-a716-446655440000",
      "domain_name": "config-management",
      "name": "Allow low-risk drops",
      "description": "Allow drop_table for low-risk, reversible operations",
      "scope": {
        "organization_id": "550e8400-e29b-41d4-a716-446655440000",
        "domain_name": "config-management",
        "service": "db-admin-tool",
        "agent": "pause-escalation-agent",
        "environment": "production"
      },
      "scope_id": "config-management.db-admin-tool.pause-escalation-agent.prod",
      "conditions": [
        {
          "field": "risk_level",
          "operator": "==",
          "value": "low"
        },
        {
          "field": "reversible",
          "operator": "==",
          "value": true
        }
      ],
      "verdict": "ALLOW",
      "spec_id": "spec-pre-commit-database-drop-table-v1"
    },
    {
      "id": "policy-observe-user-login-v1",
      "organization_id": "550e8400-e29b-41d4-a716-446655440000",
      "domain_name": "config-management",
      "name": "Observe user logins",
      "description": "Log all user login attempts for audit trail",
      "scope": {
        "organization_id": "550e8400-e29b-41d4-a716-446655440000",
        "domain_name": "config-management",
        "service": "audit-logger",
        "agent": "observe-agent"
      },
      "scope_id": "config-management.audit-logger.observe-agent.prod",
      "conditions": [
        {
          "field": "auth_method",
          "operator": "in",
          "value": ["password", "oauth", "mfa"]
        }
      ],
      "verdict": "OBSERVE",
      "spec_id": "spec-executed-user-login-v1"
    },
    {
      "id": "policy-observe-data-exports-v1",
      "organization_id": "550e8400-e29b-41d4-a716-446655440000",
      "domain_name": "config-management",
      "name": "Observe data exports",
      "description": "Log all data export operations including PII exports",
      "scope": {
        "organization_id": "550e8400-e29b-41d4-a716-446655440000",
        "domain_name": "config-management",
        "service": "audit-logger",
        "agent": "observe-agent"
      },
      "scope_id": "config-management.audit-logger.observe-agent.prod",
      "conditions": [
        {
          "field": "format",
          "operator": "in",
          "value": ["csv", "json", "parquet"]
        }
      ],
      "verdict": "OBSERVE",
      "spec_id": "spec-executed-data-export-v1"
    },
    {
      "id": "policy-observe-config-updates-v1",
      "organization_id": "550e8400-e29b-41d4-a716-446655440000",
      "domain_name": "config-management",
      "name": "Observe config updates",
      "description": "Log all configuration changes for audit trail",
      "scope": {
        "organization_id": "550e8400-e29b-41d4-a716-446655440000",
        "domain_name": "config-management",
        "service": "audit-logger",
        "agent": "observe-agent"
      },
      "scope_id": "config-management.audit-logger.observe-agent.prod",
      "conditions": [],
      "verdict": "OBSERVE",
      "spec_id": "spec-executed-config-update-v1"
    }
  ]'::JSONB,
  '550e8400-e29b-41d4-a716-446655440000'::UUID,
  'config-management',
  now()
)
ON CONFLICT DO NOTHING;

COMMIT;
