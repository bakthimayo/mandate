/**
 * Decision Event Repository - RFC-002 Isolation Enforced
 *
 * All queries enforce organization_id and domain_name boundaries.
 * No implicit cross-domain aggregation.
 * RFC-002: domain_name is TEXT slug, not UUID.
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
     (decision_id, organization_id, domain_name, intent, stage, actor, target, context, scope, timestamp)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      event.decision_id,
      ctx.organization_id,
      ctx.domain_name,
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
    domain_name: string;
    intent: string;
    stage: string;
    actor: string;
    target: string;
    context: Record<string, unknown>;
    scope: DecisionEvent['scope'];
    timestamp: Date;
  }>(
    `SELECT decision_id, organization_id, domain_name, intent, stage, actor, target, context, scope, timestamp
     FROM mandate.decision_events
     WHERE decision_id = $1
       AND organization_id = $2
       AND domain_name = $3`,
    [decision_id, ctx.organization_id, ctx.domain_name]
  );

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];
   return {
     decision_id: row.decision_id,
     organization_id: row.organization_id,
     domain_name: row.domain_name,
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
      domain_name: string;
      intent: string;
      stage: string;
      actor: string;
      target: string;
      context: Record<string, unknown>;
      scope: DecisionEvent['scope'];
      timestamp: Date;
    }>(
      `SELECT decision_id, organization_id, domain_name, intent, stage, actor, target, context, scope, timestamp
       FROM mandate.decision_events
       WHERE organization_id = $1
         AND domain_name = $2
       ORDER BY timestamp DESC
       LIMIT $3 OFFSET $4`,
      [ctx.organization_id, ctx.domain_name, limit, offset]
    );

    return result.rows.map((row) => ({
      decision_id: row.decision_id,
      organization_id: row.organization_id,
      domain_name: row.domain_name,
      intent: row.intent,
      stage: row.stage as DecisionEvent['stage'],
      actor: row.actor,
      target: row.target,
      context: row.context,
      scope: row.scope,
      timestamp: row.timestamp.toISOString(),
    }));
  }

  /**
   * Lists DecisionEvents with verdict and spec_id joined from verdict_events.
   * RFC-002: Enforces organization_id and domain_name isolation on both tables.
   * Used by observability audit endpoints to provide complete audit information.
   * Supports filtering by verdict and time range.
   */
  export async function listDecisionEventsWithVerdicts(
    ctx: IsolationContext,
    options?: {
      limit?: number;
      offset?: number;
      verdict?: string;
      startTime?: Date;
      endTime?: Date;
    }
  ): Promise<
    readonly Array<
      DecisionEvent & {
        verdict?: string | null;
        spec_id?: string | null;
      }
    >
  > {
    validateIsolationContext(ctx);

    const limit = options?.limit ?? 100;
    const offset = options?.offset ?? 0;
    const verdict = options?.verdict;
    const startTime = options?.startTime;
    const endTime = options?.endTime;

    const pool = getPool();

    // Build WHERE clause dynamically based on filters
    const whereConditions: string[] = [
      'de.organization_id = $1',
      'de.domain_name = $2',
    ];
    const params: unknown[] = [ctx.organization_id, ctx.domain_name];
    let paramIndex = 3;

    // Add verdict filter if provided
    if (verdict) {
      whereConditions.push(`ve.verdict = $${paramIndex}`);
      params.push(verdict);
      paramIndex++;
    }

    // Add time range filters if provided
    if (startTime) {
      whereConditions.push(`de.timestamp >= $${paramIndex}`);
      params.push(startTime);
      paramIndex++;
    }

    if (endTime) {
      whereConditions.push(`de.timestamp <= $${paramIndex}`);
      params.push(endTime);
      paramIndex++;
    }

    const limitParamIndex = paramIndex;
    const offsetParamIndex = paramIndex + 1;
    params.push(limit, offset);

    const whereClause = whereConditions.join(' AND ');

    const result = await pool.query<{
      decision_id: string;
      organization_id: string;
      domain_name: string;
      intent: string;
      stage: string;
      actor: string;
      target: string;
      context: Record<string, unknown>;
      scope: DecisionEvent['scope'];
      timestamp: Date;
      verdict: string | null;
      spec_id: string | null;
    }>(
      `SELECT 
         de.decision_id, 
         de.organization_id, 
         de.domain_name, 
         de.intent, 
         de.stage, 
         de.actor, 
         de.target, 
         de.context, 
         de.scope, 
         de.timestamp,
         ve.verdict,
         ve.spec_id
       FROM mandate.decision_events de
       LEFT JOIN mandate.verdict_events ve 
         ON de.decision_id = ve.decision_id 
         AND de.organization_id = ve.organization_id
         AND de.domain_name = ve.domain_name
       WHERE ${whereClause}
       ORDER BY de.timestamp DESC
       LIMIT $${limitParamIndex} OFFSET $${offsetParamIndex}`,
      params
    );

    return result.rows.map((row) => ({
      decision_id: row.decision_id,
      organization_id: row.organization_id,
      domain_name: row.domain_name,
      intent: row.intent,
      stage: row.stage as DecisionEvent['stage'],
      actor: row.actor,
      target: row.target,
      context: row.context,
      scope: row.scope,
      timestamp: row.timestamp.toISOString(),
      verdict: row.verdict,
      spec_id: row.spec_id,
    }));
  }
