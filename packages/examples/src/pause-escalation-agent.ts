/**
 * Pause Escalation Agent Example
 *
 * Demonstrates an agent that properly handles PAUSE verdicts by:
 * - NOT proceeding with the action
 * - Polling for resolution (human approval/rejection)
 * - Respecting the final verdict after escalation
 *
 * RFC-002 Compliance:
 * - organization_id is explicitly provided (required)
 * - scope.domain is explicitly provided (required)
 * - No inference or defaults - caller provides full attribution
 *
 * Key principles:
 * - PAUSE means STOP and WAIT - never proceed without resolution
 * - Poll for verdict changes (or use webhooks in production)
 * - The agent does NOT escalate - it recognizes a PAUSE verdict
 * - Never bypass or timeout a PAUSE to proceed anyway
 */

import { MandateClient } from '@mandate/sdk';
import type { Verdict, VerdictEvent } from '@mandate/shared';

const ORGANIZATION_ID = '550e8400-e29b-41d4-a716-446655440000';
const DOMAIN = 'config-management';

const client = new MandateClient({
  baseUrl: process.env.MANDATE_URL ?? 'http://localhost:3000',
  apiKey: process.env.MANDATE_API_KEY,
});

interface HighRiskAction {
  type: string;
  target: string;
  parameters: Record<string, unknown>;
}

const POLL_INTERVAL_MS = 5000;
const MAX_POLL_ATTEMPTS = 12;

async function performHighRiskAction(action: HighRiskAction): Promise<void> {
  console.log(`[SIMULATED] Performing ${action.type} on ${action.target}`);
  console.log(`[SIMULATED] Parameters: ${JSON.stringify(action.parameters)}`);
}

async function pollForResolution(decisionId: string): Promise<VerdictEvent | null> {
  console.log('[PAUSE] Waiting for human review...');
  console.log('[PAUSE] Polling for verdict resolution...\n');

  for (let attempt = 1; attempt <= MAX_POLL_ATTEMPTS; attempt++) {
    console.log(`[POLL] Attempt ${attempt}/${MAX_POLL_ATTEMPTS}`);

    try {
      const verdict = await client.getVerdict(decisionId);

      if (verdict.verdict !== 'PAUSE') {
        console.log(`[POLL] Verdict resolved to: ${verdict.verdict}`);
        return verdict;
      }

      console.log('[POLL] Still paused, waiting...');
    } catch (error) {
      console.log(`[POLL] Error checking verdict: ${String(error)}`);
    }

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  console.log('[POLL] Max attempts reached. Verdict still PAUSE.');
  return null;
}

async function handleVerdict(
  verdict: Verdict,
  decisionId: string,
  action: HighRiskAction
): Promise<void> {
  switch (verdict) {
    case 'ALLOW':
      console.log(`[VERDICT: ALLOW] Proceeding with high-risk action`);
      try {
        await performHighRiskAction(action);
        await client.reportOutcome({
          decision_id: decisionId,
          success: true,
          details: { completed_at: new Date().toISOString() },
        });
        console.log('[OUTCOME] High-risk action completed successfully');
      } catch (error) {
        await client.reportOutcome({
          decision_id: decisionId,
          success: false,
          details: { error: String(error) },
        });
        console.log('[OUTCOME] High-risk action failed:', error);
      }
      break;

    case 'BLOCK':
      console.log(`[VERDICT: BLOCK] Action definitively blocked.`);
      await client.reportOutcome({
        decision_id: decisionId,
        success: false,
        details: { reason: 'blocked_by_policy' },
      });
      break;

    case 'PAUSE':
      console.log(`[VERDICT: PAUSE] Action requires human approval.`);
      console.log('[INFO] Decision ID for escalation:', decisionId);

      const resolvedVerdict = await pollForResolution(decisionId);

      if (resolvedVerdict === null) {
        console.log('[PAUSE] Resolution timeout. Action NOT performed.');
        await client.reportOutcome({
          decision_id: decisionId,
          success: false,
          details: { reason: 'escalation_timeout' },
        });
        return;
      }

      await handleVerdict(resolvedVerdict.verdict, decisionId, action);
      break;

    case 'OBSERVE':
      console.log(`[VERDICT: OBSERVE] Proceeding with high-risk action (observed)`);
      try {
        await performHighRiskAction(action);
        await client.reportOutcome({
          decision_id: decisionId,
          success: true,
          details: { observed: true },
        });
        console.log('[OUTCOME] High-risk action completed (observed)');
      } catch (error) {
        await client.reportOutcome({
          decision_id: decisionId,
          success: false,
          details: { error: String(error), observed: true },
        });
        console.log('[OUTCOME] High-risk action failed:', error);
      }
      break;
  }
}

async function pauseEscalationAgent(): Promise<void> {
  const action: HighRiskAction = {
    type: 'database.drop_table',
    target: 'production.users',
    parameters: {
      cascade: true,
      backup_first: false,
    },
  };

  console.log('=== Pause Escalation Agent ===');
  console.log(`Organization: ${ORGANIZATION_ID}`);
  console.log(`Domain: ${DOMAIN}`);
  console.log(`Requesting decision for: ${action.type} on ${action.target}`);
  console.log('This is a high-risk action that may require human approval.\n');

  const response = await client.requestDecision({
    organization_id: ORGANIZATION_ID,
    intent: action.type,
    stage: 'pre_commit',
    actor: 'pause-escalation-agent',
    target: action.target,
    context: {
      ...action.parameters,
      risk_level: 'critical',
      reversible: false,
    },
    scope: {
      domain: DOMAIN,
      service: 'db-admin-tool',
      environment: 'production',
    },
  });

  console.log(`Decision ID: ${response.decision.decision_id}`);
  console.log(`Verdict: ${response.verdict.verdict}`);
  console.log(`Matched policies: ${response.verdict.matched_policy_ids.join(', ') || 'none'}\n`);

  await handleVerdict(response.verdict.verdict, response.decision.decision_id, action);
}

pauseEscalationAgent().catch(console.error);
