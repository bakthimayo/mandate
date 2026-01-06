/**
 * Pre-Commit Check Agent Example
 *
 * Demonstrates an agent that requests a decision at the pre_commit stage
 * BEFORE performing any action. The agent MUST respect the verdict and
 * NOT bypass it under any circumstances.
 *
 * RFC-002 Compliance:
 * - organization_id is explicitly provided (required)
 * - scope.domain is explicitly provided (required)
 * - No inference or defaults - caller provides full attribution
 *
 * Key principles:
 * - Request decision BEFORE acting
 * - Respect ALL verdicts (ALLOW, BLOCK, PAUSE, OBSERVE)
 * - Report outcome after action completes (or fails)
 * - Never assume enforcement - verdicts are advisory signals
 */

import { MandateClient } from '@mandate/sdk';
import type { Verdict } from '@mandate/shared';

const ORGANIZATION_ID = '550e8400-e29b-41d4-a716-446655440000';
const DOMAIN = 'config-management';

const client = new MandateClient({
  baseUrl: process.env.MANDATE_URL ?? 'http://localhost:3000',
  apiKey: process.env.MANDATE_API_KEY,
});

interface FileWriteAction {
  path: string;
  content: string;
}

async function performFileWrite(action: FileWriteAction): Promise<void> {
  console.log(`[SIMULATED] Writing to file: ${action.path}`);
  console.log(`[SIMULATED] Content length: ${action.content.length} bytes`);
}

async function handleVerdict(
  verdict: Verdict,
  decisionId: string,
  action: FileWriteAction
): Promise<void> {
  switch (verdict) {
    case 'ALLOW':
      console.log(`[VERDICT: ALLOW] Proceeding with file write to ${action.path}`);
      try {
        await performFileWrite(action);
        await client.reportOutcome({
          decision_id: decisionId,
          success: true,
          details: { bytes_written: action.content.length },
        });
        console.log('[OUTCOME] Action completed successfully');
      } catch (error) {
        await client.reportOutcome({
          decision_id: decisionId,
          success: false,
          details: { error: String(error) },
        });
        console.log('[OUTCOME] Action failed:', error);
      }
      break;

    case 'BLOCK':
      console.log(`[VERDICT: BLOCK] Action blocked by policy. Not proceeding.`);
      await client.reportOutcome({
        decision_id: decisionId,
        success: false,
        details: { reason: 'blocked_by_policy' },
      });
      break;

    case 'PAUSE':
      console.log(`[VERDICT: PAUSE] Action requires escalation. Not proceeding.`);
      console.log('[INFO] This decision requires human review.');
      await client.reportOutcome({
        decision_id: decisionId,
        success: false,
        details: { reason: 'awaiting_escalation' },
      });
      break;

    case 'OBSERVE':
      console.log(`[VERDICT: OBSERVE] Proceeding with file write (observed)`);
      try {
        await performFileWrite(action);
        await client.reportOutcome({
          decision_id: decisionId,
          success: true,
          details: { bytes_written: action.content.length, observed: true },
        });
        console.log('[OUTCOME] Action completed (observed)');
      } catch (error) {
        await client.reportOutcome({
          decision_id: decisionId,
          success: false,
          details: { error: String(error), observed: true },
        });
        console.log('[OUTCOME] Action failed:', error);
      }
      break;
  }
}

async function preCommitAgent(): Promise<void> {
  const action: FileWriteAction = {
    path: '/data/config/production.yaml',
    content: 'database_url: postgres://prod-db:5432/app',
  };

  console.log('=== Pre-Commit Agent ===');
  console.log(`Organization: ${ORGANIZATION_ID}`);
  console.log(`Domain: ${DOMAIN}`);
  console.log(`Requesting decision for: file.write to ${action.path}\n`);

  const response = await client.requestDecision({
    organization_id: ORGANIZATION_ID,
    intent: 'file.write',
    stage: 'pre_commit',
    actor: 'pre-commit-agent',
    target: action.path,
    context: {
      content_length: action.content.length,
      content_type: 'yaml',
    },
    scope: {
      domain: DOMAIN,
      service: 'config-writer',
      environment: 'production',
    },
  });

  console.log(`Decision ID: ${response.decision.decision_id}`);
  console.log(`Verdict: ${response.verdict.verdict}`);
  console.log(`Matched policies: ${response.verdict.matched_policy_ids.join(', ') || 'none'}\n`);

  await handleVerdict(response.verdict.verdict, response.decision.decision_id, action);
}

preCommitAgent().catch(console.error);
