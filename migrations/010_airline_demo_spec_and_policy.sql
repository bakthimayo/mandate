-- Airline Demo - DecisionSpec and Policies for Chatbot Governance
-- Version: 001
-- RFC-002 v1.2 Compliance: domain_name as text slug, proper scope binding
--
-- This migration creates:
-- 1. Organization for acme-airlines
-- 2. Domain for customer-support
-- 3. DecisionSpec for issue_refund intent (pre_commit stage)
-- 4. Scope for chatbot-v3 agent
-- 5. Policy for high-risk refund claims requiring escalation

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
-- DECISION SPEC FOR AIRLINE REFUND DECISIONS
-- =============================================================================
INSERT INTO mandate_specs (spec_id, version, organization_id, domain_name, intent, stage, allowed_verdicts, signals, enforcement, status, created_at)
VALUES (
  'spec-refund-v1',
  '1.0.0',
  '550e8400-e29b-41d4-a716-446655440000'::UUID,
  'customer-support',
  'issue_refund',
  'pre_commit'::stage,
  ARRAY['ALLOW', 'BLOCK', 'PAUSE', 'OBSERVE']::verdict[],
  '[
    {
      "name": "has_monetary_value",
      "type": "boolean",
      "required": true,
      "source": "context"
    },
    {
      "name": "monetary_amount",
      "type": "number",
      "required": false,
      "source": "context"
    },
    {
      "name": "policy_keyword",
      "type": "enum",
      "values": ["refund", "charge", "fee", "escalate"],
      "required": false,
      "source": "context"
    },
    {
      "name": "requires_escalation",
      "type": "boolean",
      "required": false,
      "source": "context"
    },
    {
      "name": "customer_id",
      "type": "string",
      "required": true,
      "source": "context"
    },
    {
      "name": "booking_id",
      "type": "string",
      "required": true,
      "source": "context"
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
-- CONSOLIDATED POLICY SNAPSHOT FOR AIRLINE DOMAIN
-- =============================================================================
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
      "description": "PAUSE refund claims involving monetary amounts >= $100 for compliance review",
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
      "name": "Allow Small Refunds",
      "description": "ALLOW refund claims under $100 without escalation",
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
          "field": "monetary_amount",
          "operator": "<",
          "value": 100
        }
      ],
      "verdict": "ALLOW",
      "spec_id": "spec-refund-v1"
    },
    {
      "id": "pol-refund-003",
      "organization_id": "550e8400-e29b-41d4-a716-446655440000",
      "domain_name": "customer-support",
      "name": "Observe All Refund Requests",
      "description": "Log all refund requests for audit trail",
      "scope": {
        "organization_id": "550e8400-e29b-41d4-a716-446655440000",
        "domain_name": "customer-support",
        "service": "chat-api",
        "agent": "chatbot-v3",
        "environment": "production"
      },
      "scope_id": "customer-support.chat-api.chatbot-v3.production",
      "conditions": [],
      "verdict": "OBSERVE",
      "spec_id": "spec-refund-v1"
    }
  ]'::JSONB,
  '550e8400-e29b-41d4-a716-446655440000'::UUID,
  'customer-support',
  now()
)
ON CONFLICT DO NOTHING;

COMMIT;
