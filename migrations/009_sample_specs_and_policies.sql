-- Mandate Control Plane - Sample Specs and Policies for Example Agents
-- Version: 006
-- Test data aligned to RFC-002: Spec-Aware Scope Isolation
-- 
-- This migration creates:
-- 1. DecisionSpecs for pre-commit-agent, pause-escalation-agent, and observe-agent
-- 2. Scopes for each agent with proper organizational binding
-- 3. Sample Policies that match specs and scopes
-- 4. Policy snapshot containing the sample policies

BEGIN;

SET search_path TO mandate;

-- =============================================================================
-- SAMPLE DECISION SPECS FOR EXAMPLE AGENTS
-- =============================================================================

-- Pre-Commit Agent: file.write at pre_commit stage
INSERT INTO mandate_specs (spec_id, version, organization_id, domain, intent, stage, allowed_verdicts, signals, enforcement, status, created_at)
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
);

-- Pause-Escalation Agent: database.drop_table at pre_commit stage
INSERT INTO mandate_specs (spec_id, version, organization_id, domain, intent, stage, allowed_verdicts, signals, enforcement, status, created_at)
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
);

-- Observe-Only Agent: user.login at executed stage
INSERT INTO mandate_specs (spec_id, version, organization_id, domain, intent, stage, allowed_verdicts, signals, enforcement, status, created_at)
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
);

-- Observe-Only Agent: data.export at executed stage
INSERT INTO mandate_specs (spec_id, version, organization_id, domain, intent, stage, allowed_verdicts, signals, enforcement, status, created_at)
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
);

-- Observe-Only Agent: config.update at executed stage
INSERT INTO mandate_specs (spec_id, version, organization_id, domain, intent, stage, allowed_verdicts, signals, enforcement, status, created_at)
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
);

-- =============================================================================
-- SAMPLE SCOPES FOR EXAMPLE AGENTS
-- =============================================================================

-- Scope for pre-commit-agent (config-writer service at production)
INSERT INTO scopes (
  scope_id,
  scope_domain,
  service,
  agent,
  environment,
  organization_id,
  domain_id,
  owning_team,
  owner_contact,
  description
)
VALUES (
  '550e8400-e29b-41d4-a716-446655440100'::UUID,
  'config-management',
  'config-writer',
  'pre-commit-agent',
  'production',
  '550e8400-e29b-41d4-a716-446655440000'::UUID,
  '550e8400-e29b-41d4-a716-446655440001'::UUID,
  'config-team',
  'config-team@example.com',
  'Scope for pre-commit file write agent (config-writer service)'
)
ON CONFLICT DO NOTHING;

-- Scope for pause-escalation-agent (db-admin-tool service at production)
INSERT INTO scopes (
  scope_id,
  scope_domain,
  service,
  agent,
  environment,
  organization_id,
  domain_id,
  owning_team,
  owner_contact,
  description
)
VALUES (
  '550e8400-e29b-41d4-a716-446655440101'::UUID,
  'config-management',
  'db-admin-tool',
  'pause-escalation-agent',
  'production',
  '550e8400-e29b-41d4-a716-446655440000'::UUID,
  '550e8400-e29b-41d4-a716-446655440001'::UUID,
  'dba-team',
  'dba-team@example.com',
  'Scope for pause-escalation agent (db-admin-tool service)'
)
ON CONFLICT DO NOTHING;

-- Scope for observe-agent (audit-logger service at production)
INSERT INTO scopes (
  scope_id,
  scope_domain,
  service,
  agent,
  environment,
  organization_id,
  domain_id,
  owning_team,
  owner_contact,
  description
)
VALUES (
  '550e8400-e29b-41d4-a716-446655440102'::UUID,
  'config-management',
  'audit-logger',
  'observe-agent',
  'production',
  '550e8400-e29b-41d4-a716-446655440000'::UUID,
  '550e8400-e29b-41d4-a716-446655440001'::UUID,
  'audit-team',
  'audit-team@example.com',
  'Scope for observe-only agent (audit-logger service)'
)
ON CONFLICT DO NOTHING;

-- =============================================================================
-- CONSOLIDATED POLICY SNAPSHOT
-- =============================================================================
-- All policies for all specs in a single snapshot (required by RFC-002 isolation)
-- getLatestPolicySnapshot returns only one snapshot per org/domain, so all 
-- policies must be in the same snapshot to be available for evaluation.

INSERT INTO policy_snapshots (snapshot_id, version, policies, organization_id, domain_id, created_at)
SELECT 
  '550e8400-e29b-41d4-a716-446655440200'::UUID,
  1,
  '[
    {
      "id": "policy-allow-small-files-v1",
      "organization_id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "Allow small file writes",
      "description": "Allow writing files under 1MB to production config",
      "scope": {
        "domain": "config-management",
        "service": "config-writer",
        "agent": "pre-commit-agent",
        "environment": "production"
      },
      "scope_id": "550e8400-e29b-41d4-a716-446655440100",
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
      "name": "Pause large file writes",
      "description": "Require review for files over 1MB",
      "scope": {
        "domain": "config-management",
        "service": "config-writer",
        "agent": "pre-commit-agent",
        "environment": "production"
      },
      "scope_id": "550e8400-e29b-41d4-a716-446655440100",
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
      "name": "Block drops without backup",
      "description": "Block database drop_table if backup was not taken first",
      "scope": {
        "domain": "config-management",
        "service": "db-admin-tool",
        "agent": "pause-escalation-agent",
        "environment": "production"
      },
      "scope_id": "550e8400-e29b-41d4-a716-446655440101",
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
      "name": "Pause critical database operations",
      "description": "Require DBA approval for critical-level operations",
      "scope": {
        "domain": "config-management",
        "service": "db-admin-tool",
        "agent": "pause-escalation-agent",
        "environment": "production"
      },
      "scope_id": "550e8400-e29b-41d4-a716-446655440101",
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
      "name": "Allow low-risk drops",
      "description": "Allow drop_table for low-risk, reversible operations",
      "scope": {
        "domain": "config-management",
        "service": "db-admin-tool",
        "agent": "pause-escalation-agent",
        "environment": "production"
      },
      "scope_id": "550e8400-e29b-41d4-a716-446655440101",
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
      "name": "Observe user logins",
      "description": "Log all user login attempts for audit trail",
      "scope": {
        "domain": "config-management",
        "service": "audit-logger",
        "agent": "observe-agent"
      },
      "scope_id": "550e8400-e29b-41d4-a716-446655440102",
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
      "name": "Observe data exports",
      "description": "Log all data export operations including PII exports",
      "scope": {
        "domain": "config-management",
        "service": "audit-logger",
        "agent": "observe-agent"
      },
      "scope_id": "550e8400-e29b-41d4-a716-446655440102",
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
      "name": "Observe config updates",
      "description": "Log all configuration changes for audit trail",
      "scope": {
        "domain": "config-management",
        "service": "audit-logger",
        "agent": "observe-agent"
      },
      "scope_id": "550e8400-e29b-41d4-a716-446655440102",
      "conditions": [],
      "verdict": "OBSERVE",
      "spec_id": "spec-executed-config-update-v1"
    }
  ]'::JSONB,
  '550e8400-e29b-41d4-a716-446655440000'::UUID,
  '550e8400-e29b-41d4-a716-446655440001'::UUID,
  now()
WHERE NOT EXISTS (
  SELECT 1 FROM policy_snapshots WHERE snapshot_id = '550e8400-e29b-41d4-a716-446655440200'::UUID
);

COMMIT;
