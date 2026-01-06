/**
 * Decision Event Repository - RFC-002 Isolation Enforced
 *
 * All queries enforce organization_id and domain_id boundaries.
 * No implicit cross-domain aggregation.
 */

import type { DecisionEvent } from '@mandate/shared';
import { getPool } from '../db/connection.js';
import type { IsolationContext } from './isolation-context.js';
import { validateIsolationContext } from './isolation-context.js';

/**
 * Inserts a DecisionEvent with organization and domain attribution.
 * Requires IsolationContext to enforce RFC-002 boundaries.
 */
export async function insertDecisionEvent(
  event: DecisionEvent,
  ctx: IsolationContext
): Promise<void> {
  validateIsolationContext(ctx);

  const pool = getPool();
  await pool.query(
    `INSERT INTO mandate.decision_events 
     (decision_id, organization_id, domain_id, intent, stage, actor, target, context, scope, timestamp)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      event.decision_id,
      ctx.organization_id,
      ctx.domain_id,
      event.intent,
      event.stage,
      event.actor,
      event.target,
      JSON.stringify(event.context),
      JSON.stringify(event.scope),
      event.timestamp,
    ]
  );
}

/**
 * Retrieves a DecisionEvent by ID within isolation boundaries.
 * Returns null if not found or outside isolation context.
 */
export async function getDecisionEventById(
  decision_id: string,
  ctx: IsolationContext
): Promise<DecisionEvent | null> {
  validateIsolationContext(ctx);

  const pool = getPool();
  const result = await pool.query<{
    decision_id: string;
    organization_id: string;
    intent: string;
    stage: string;
    actor: string;
    target: string;
    context: Record<string, unknown>;
    scope: DecisionEvent['scope'];
    timestamp: Date;
  }>(
    `SELECT decision_id, organization_id, intent, stage, actor, target, context, scope, timestamp
     FROM mandate.decision_events
     WHERE decision_id = $1
       AND organization_id = $2
       AND domain_id = $3`,
    [decision_id, ctx.organization_id, ctx.domain_id]
  );

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];
  return {
    decision_id: row.decision_id,
    organization_id: row.organization_id,
    intent: row.intent,
    stage: row.stage as DecisionEvent['stage'],
    actor: row.actor,
    target: row.target,
    context: row.context,
    scope: row.scope,
    timestamp: row.timestamp.toISOString(),
  };
}

/**
 * Lists DecisionEvents within isolation boundaries.
 * No cross-domain aggregation.
 */
export async function listDecisionEvents(
  ctx: IsolationContext,
  options?: { limit?: number; offset?: number }
): Promise<readonly DecisionEvent[]> {
  validateIsolationContext(ctx);

  const limit = options?.limit ?? 100;
  const offset = options?.offset ?? 0;

  const pool = getPool();
  const result = await pool.query<{
    decision_id: string;
    organization_id: string;
    intent: string;
    stage: string;
    actor: string;
    target: string;
    context: Record<string, unknown>;
    scope: DecisionEvent['scope'];
    timestamp: Date;
  }>(
    `SELECT decision_id, organization_id, intent, stage, actor, target, context, scope, timestamp
     FROM mandate.decision_events
     WHERE organization_id = $1
       AND domain_id = $2
     ORDER BY timestamp DESC
     LIMIT $3 OFFSET $4`,
    [ctx.organization_id, ctx.domain_id, limit, offset]
  );

  return result.rows.map((row) => ({
    decision_id: row.decision_id,
    organization_id: row.organization_id,
    intent: row.intent,
    stage: row.stage as DecisionEvent['stage'],
    actor: row.actor,
    target: row.target,
    context: row.context,
    scope: row.scope,
    timestamp: row.timestamp.toISOString(),
  }));
}
