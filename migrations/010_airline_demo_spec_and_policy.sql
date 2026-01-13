-- Airline Demo - DecisionSpec and Policies for Chatbot Governance
-- Version: 002
-- RFC-002 v1.2 Compliance: domain_name as text slug, proper scope binding
-- Append-only, immutable policy snapshots per RFC-001 Section 11
--
-- This migration creates:
-- 1. Organization for acme-airlines
-- 2. Domain for customer-support
-- 3. DecisionSpec v1.0.0 for issue_refund intent (pre_commit stage)
-- 4. DecisionSpec v1.1.0 with flight_status signal (for BLOCK policy)
-- 5. Scope for chatbot-v3 agent
-- 6. PAUSE Policy: High-risk refund claims requiring escalation
-- 7. BLOCK Policy: Block refunds for completed flights
-- 8. Two policy snapshots (immutable):
--    - snap-v1: Contains PAUSE policy (for v1.0.0 decisions)
--    - snap-v2: Contains both PAUSE and BLOCK policies (for v1.1.0 decisions)

BEGIN;

SET search_path TO mandate;

-- =============================================================================
-- ENSURE DOMAIN EXISTS (reuse example-org)
-- =============================================================================
-- RFC-002 v1.2: domain_name is TEXT slug, not UUID
INSERT INTO domains (organization_id, domain_name, description)
VALUES (
  '550e8400-e29b-41d4-a716-446655440000'::UUID,
  'customer-support',
  'Customer support chatbot and response governance'
)
ON CONFLICT DO NOTHING;

-- =============================================================================
-- DECISION SPEC v1.0.0 - INITIAL VERSION (PAUSE POLICY ONLY)
-- =============================================================================
-- Original spec with 4 signals, used with snap-v1 (pol-refund-001)
INSERT INTO mandate_specs (spec_id, version, organization_id, domain_name, intent, stage, allowed_verdicts, signals, enforcement, status, created_at)
VALUES (
  'spec-refund-v1',
  '1.0.0',
  '550e8400-e29b-41d4-a716-446655440000'::UUID,
  'customer-support',
  'issue_refund',
  'pre_commit'::stage,
  ARRAY['ALLOW', 'PAUSE', 'OBSERVE']::verdict[],
  '[
    {
      "name": "has_monetary_value",
      "type": "boolean",
      "required": true,
      "source": "context",
      "description": "Indicates if response mentions a specific dollar amount"
    },
    {
      "name": "policy_keyword",
      "type": "enum",
      "values": ["refund", "charge", "fee", "escalate"],
      "required": true,
      "source": "context",
      "description": "Detected policy-related keyword from response text"
    },
    {
      "name": "monetary_amount",
      "type": "number",
      "required": false,
      "source": "context",
      "description": "Extracted dollar amount (e.g., 500 from $500)"
    },
    {
      "name": "requires_escalation",
      "type": "boolean",
      "required": false,
      "source": "context",
      "description": "Whether response avoids escalation language"
    }
  ]'::JSONB,
  '{
    "pause_requires": ["compliance-team"],
    "resolution_timeout_minutes": 60
  }'::JSONB,
  'deprecated',
  now()
  )
  ON CONFLICT DO NOTHING;

  -- =============================================================================
  -- DECISION SPEC v1.1.0 - EXTENDED VERSION (PAUSE + BLOCK POLICIES)
-- =============================================================================
-- Extended spec adds flight_status signal for BLOCK policy
-- Used with snap-v2 (pol-refund-001 + pol-refund-002)
INSERT INTO mandate_specs (spec_id, version, organization_id, domain_name, intent, stage, allowed_verdicts, signals, enforcement, status, created_at)
VALUES (
  'spec-refund-v1',
  '1.1.0',
  '550e8400-e29b-41d4-a716-446655440000'::UUID,
  'customer-support',
  'issue_refund',
  'pre_commit'::stage,
  ARRAY['ALLOW', 'PAUSE', 'BLOCK', 'OBSERVE']::verdict[],
  '[
    {
      "name": "has_monetary_value",
      "type": "boolean",
      "required": true,
      "source": "context",
      "description": "Indicates if response mentions a specific dollar amount"
    },
    {
      "name": "policy_keyword",
      "type": "enum",
      "values": ["refund", "charge", "fee", "escalate"],
      "required": true,
      "source": "context",
      "description": "Detected policy-related keyword from response text"
    },
    {
      "name": "monetary_amount",
      "type": "number",
      "required": false,
      "source": "context",
      "description": "Extracted dollar amount (e.g., 500 from $500)"
    },
    {
      "name": "requires_escalation",
      "type": "boolean",
      "required": false,
      "source": "context",
      "description": "Whether response avoids escalation language"
    },
    {
      "name": "flight_status",
      "type": "enum",
      "values": ["scheduled", "departed", "completed", "cancelled"],
      "required": false,
      "source": "context",
      "description": "Status of flight - NEW in v1.1.0 for BLOCK policy"
    }
  ]'::JSONB,
  '{
    "pause_requires": ["compliance-team"],
    "resolution_timeout_minutes": 60
  }'::JSONB,
  'active',
  now()
)
ON CONFLICT DO NOTHING;

-- =============================================================================
-- SCOPE FOR CHATBOT AGENT
-- =============================================================================
-- RFC-002 v1.2: scope_id is TEXT with domain_name prefix
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
  'customer-support.chat-api.chatbot-v3.production',
  '550e8400-e29b-41d4-a716-446655440000'::UUID,
  'customer-support',
  'chat-api',
  'chatbot-v3',
  'production',
  'production'
)
ON CONFLICT DO NOTHING;

-- =============================================================================
-- POLICY SNAPSHOT v1 - PAUSE POLICY ONLY
-- =============================================================================
-- RFC-001 Section 11: Snapshots are immutable, never updated
-- snap-v1 contains pol-refund-001 (PAUSE)
-- Used by decisions referencing spec v1.0.0
-- Historical snapshots never change; new decisions use new snapshots
INSERT INTO policy_snapshots (snapshot_id, version, policies, organization_id, domain_name, created_at)
VALUES (
  '550e8400-e29b-41d4-a716-446655440201'::UUID,
  1,
  '[
    {
      "id": "pol-refund-001",
      "organization_id": "550e8400-e29b-41d4-a716-446655440000",
      "domain_name": "customer-support",
      "name": "High-Risk Refund Claims Require Escalation",
      "description": "When a refund is claimed with a specific monetary amount >= $100, escalation to compliance team is mandatory",
      "scope": {
        "organization_id": "550e8400-e29b-41d4-a716-446655440000",
        "domain_name": "customer-support",
        "service": "chat-api",
        "agent": "chatbot-v3",
        "environment": "production"
      },
      "scope_id": "customer-support.chat-api.chatbot-v3.production",
      "conditions": [
        {
          "field": "has_monetary_value",
          "operator": "==",
          "value": true
        },
        {
          "field": "policy_keyword",
          "operator": "==",
          "value": "refund"
        },
        {
          "field": "monetary_amount",
          "operator": ">=",
          "value": 100
        }
      ],
      "verdict": "PAUSE",
      "spec_id": "spec-refund-v1"
    }
  ]'::JSONB,
  '550e8400-e29b-41d4-a716-446655440000'::UUID,
  'customer-support',
  now()
)
ON CONFLICT DO NOTHING;

-- =============================================================================
-- POLICY SNAPSHOT v2 - PAUSE + BLOCK POLICIES
-- =============================================================================
-- RFC-001 Section 11: NEW snapshot (immutable, never updated)
-- snap-v2 contains pol-refund-001 (PAUSE) + pol-refund-002 (BLOCK)
-- Used by decisions referencing spec v1.1.0
-- Previous snapshot snap-v1 remains unchanged for historical decisions
INSERT INTO policy_snapshots (snapshot_id, version, policies, organization_id, domain_name, created_at)
VALUES (
  '550e8400-e29b-41d4-a716-446655440202'::UUID,
  1,
  '[
    {
      "id": "pol-refund-001",
      "organization_id": "550e8400-e29b-41d4-a716-446655440000",
      "domain_name": "customer-support",
      "name": "High-Risk Refund Claims Require Escalation",
      "description": "When a refund is claimed with a specific monetary amount >= $100, escalation to compliance team is mandatory",
      "scope": {
        "organization_id": "550e8400-e29b-41d4-a716-446655440000",
        "domain_name": "customer-support",
        "service": "chat-api",
        "agent": "chatbot-v3",
        "environment": "production"
      },
      "scope_id": "customer-support.chat-api.chatbot-v3.production",
      "conditions": [
        {
          "field": "has_monetary_value",
          "operator": "==",
          "value": true
        },
        {
          "field": "policy_keyword",
          "operator": "==",
          "value": "refund"
        },
        {
          "field": "monetary_amount",
          "operator": ">=",
          "value": 100
        }
      ],
      "verdict": "PAUSE",
      "spec_id": "spec-refund-v1"
    },
    {
      "id": "pol-refund-002",
      "organization_id": "550e8400-e29b-41d4-a716-446655440000",
      "domain_name": "customer-support",
      "name": "Block Refunds for Completed Flights",
      "description": "Completely block any refund offer for flights that have already departed/completed",
      "scope": {
        "organization_id": "550e8400-e29b-41d4-a716-446655440000",
        "domain_name": "customer-support",
        "service": "chat-api",
        "agent": "chatbot-v3",
        "environment": "production"
      },
      "scope_id": "customer-support.chat-api.chatbot-v3.production",
      "conditions": [
        {
          "field": "policy_keyword",
          "operator": "==",
          "value": "refund"
        },
        {
          "field": "flight_status",
          "operator": "==",
          "value": "completed"
        }
      ],
      "verdict": "BLOCK",
      "spec_id": "spec-refund-v1"
    }
  ]'::JSONB,
  '550e8400-e29b-41d4-a716-446655440000'::UUID,
  'customer-support',
  now()
)
ON CONFLICT DO NOTHING;

COMMIT;
