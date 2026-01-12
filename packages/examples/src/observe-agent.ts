/**
 * Observe-Only Logging Agent Example
 *
 * Demonstrates an agent that uses Mandate purely for observability.
 * Actions are performed, and Mandate is notified at the 'executed' stage
 * for audit trail purposes.
 *
 * RFC-002 v1.2 Compliance:
 * - organization_id is explicitly provided (required, top-level)
 * - domain_name is explicitly provided (required, top-level)
 * - scope includes organization_id and domain_name (required)
 * - No inference or defaults - caller provides full attribution
 *
 * Key principles:
 * - Report actions AFTER they occur (executed stage)
 * - Still respect verdicts - even OBSERVE verdicts may inform behavior
 * - Verdicts at executed stage are for logging/audit, not prevention
 * - Never assume the system will enforce anything
 */

import { MandateClient } from '@mandate/sdk';

const ORGANIZATION_ID = '550e8400-e29b-41d4-a716-446655440000';
const DOMAIN = 'config-management';

const client = new MandateClient({
  baseUrl: process.env.MANDATE_URL ?? 'http://localhost:3001',
  apiKey: process.env.MANDATE_API_KEY,
});

interface LogEntry {
  level: 'info' | 'warn' | 'error';
  message: string;
  metadata: Record<string, unknown>;
}

function writeLog(entry: LogEntry): void {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [${entry.level.toUpperCase()}] ${entry.message}`);
  if (Object.keys(entry.metadata).length > 0) {
    console.log(`  metadata: ${JSON.stringify(entry.metadata)}`);
  }
}

async function reportExecutedAction(
  intent: string,
  target: string,
  context: Record<string, unknown>,
  success: boolean
): Promise<void> {
  try {
    const response = await client.requestDecision({
      organization_id: ORGANIZATION_ID,
      domain_name: DOMAIN,
      intent,
      stage: 'executed',
      actor: 'observe-agent',
      target,
      context: {
        ...context,
        execution_success: success,
      },
      scope: {
        organization_id: ORGANIZATION_ID,
        domain_name: DOMAIN,
        service: 'audit-logger',
        agent: 'observe-agent',
        environment: 'production',
      },
    });

    writeLog({
      level: 'info',
      message: `Reported to Mandate: ${intent} on ${target}`,
      metadata: {
        decision_id: response.decision.decision_id,
        verdict: response.verdict.verdict,
        matched_policies: response.verdict.matched_policy_ids,
      },
    });

    await client.reportOutcome({
      decision_id: response.decision.decision_id,
      success,
      details: { reported_at: new Date().toISOString() },
    });
  } catch (error) {
    writeLog({
      level: 'error',
      message: `Failed to report to Mandate: ${String(error)}`,
      metadata: { intent, target },
    });
  }
}

async function simulateUserLogin(userId: string, ipAddress: string): Promise<boolean> {
  console.log(`[SIMULATED] User ${userId} logging in from ${ipAddress}`);
  return true;
}

async function simulateDataExport(format: string, recordCount: number): Promise<boolean> {
  console.log(`[SIMULATED] Exporting ${recordCount} records as ${format}`);
  return true;
}

async function simulateConfigChange(key: string, value: string): Promise<boolean> {
  console.log(`[SIMULATED] Config change: ${key} = ${value}`);
  return true;
}

async function observeAgent(): Promise<void> {
  console.log('=== Observe-Only Agent ===');
  console.log(`Organization: ${ORGANIZATION_ID}`);
  console.log(`Domain: ${DOMAIN}`);
  console.log('This agent reports executed actions for audit purposes.\n');

  console.log('--- Simulating user login ---');
  const loginSuccess = await simulateUserLogin('user-12345', '192.168.1.100');
  await reportExecutedAction(
    'user.login',
    'auth-service',
    {
      user_id: 'user-12345',
      ip_address: '192.168.1.100',
      auth_method: 'password',
    },
    loginSuccess
  );

  console.log('\n--- Simulating data export ---');
  const exportSuccess = await simulateDataExport('csv', 5000);
  await reportExecutedAction(
    'data.export',
    'customer-records',
    {
      format: 'csv',
      record_count: 5000,
      includes_pii: true,
    },
    exportSuccess
  );

  console.log('\n--- Simulating config change ---');
  const configSuccess = await simulateConfigChange('max_connections', '100');
  await reportExecutedAction(
    'config.update',
    'database-pool',
    {
      key: 'max_connections',
      old_value: '50',
      new_value: '100',
    },
    configSuccess
  );

  console.log('\n=== Observation complete ===');
  console.log('All actions have been logged to Mandate for audit trail.');
}

observeAgent().catch(console.error);
