/**
 * Verdict Event Repository - RFC-002 Isolation Enforced
 *
 * All queries enforce organization_id and domain_id boundaries.
 * No implicit cross-domain aggregation.
 */

import type { VerdictEvent } from '@mandate/shared';
import { getPool } from '../db/connection.js';
import type { IsolationContext } from './isolation-context.js';
import { validateIsolationContext } from './isolation-context.js';

/**
 * Inserts a VerdictEvent with organization and domain attribution.
 * Requires IsolationContext to enforce RFC-002 boundaries.
 */
export async function insertVerdictEvent(
  event: VerdictEvent,
  ctx: IsolationContext
): Promise<void> {
  validateIsolationContext(ctx);

  const pool = getPool();
  await pool.query(
    `INSERT INTO mandate.verdict_events 
     (verdict_id, decision_id, snapshot_id, verdict, matched_policy_ids, timestamp, organization_id, domain_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      event.verdict_id,
      event.decision_id,
      event.snapshot_id,
      event.verdict,
      event.matched_policy_ids,
      event.timestamp,
      ctx.organization_id,
      ctx.domain_id,
    ]
  );
}

/**
 * Retrieves a VerdictEvent by ID within isolation boundaries.
 * Returns null if not found or outside isolation context.
 */
export async function getVerdictEventById(
  verdict_id: string,
  ctx: IsolationContext
): Promise<VerdictEvent | null> {
  validateIsolationContext(ctx);

  const pool = getPool();
  const result = await pool.query<{
    verdict_id: string;
    decision_id: string;
    snapshot_id: string;
    verdict: string;
    matched_policy_ids: readonly string[];
    timestamp: Date;
  }>(
    `SELECT verdict_id, decision_id, snapshot_id, verdict, matched_policy_ids, timestamp
     FROM mandate.verdict_events
     WHERE verdict_id = $1
       AND organization_id = $2
       AND domain_id = $3`,
    [verdict_id, ctx.organization_id, ctx.domain_id]
  );

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];
  return {
    verdict_id: row.verdict_id,
    decision_id: row.decision_id,
    snapshot_id: row.snapshot_id,
    verdict: row.verdict as VerdictEvent['verdict'],
    matched_policy_ids: row.matched_policy_ids,
    timestamp: row.timestamp.toISOString(),
  };
}

/**
 * Retrieves VerdictEvent by decision_id within isolation boundaries.
 * Returns null if not found or outside isolation context.
 */
export async function getVerdictEventByDecisionId(
  decision_id: string,
  ctx: IsolationContext
): Promise<VerdictEvent | null> {
  validateIsolationContext(ctx);

  const pool = getPool();
  const result = await pool.query<{
    verdict_id: string;
    decision_id: string;
    snapshot_id: string;
    verdict: string;
    matched_policy_ids: readonly string[];
    timestamp: Date;
  }>(
    `SELECT verdict_id, decision_id, snapshot_id, verdict, matched_policy_ids, timestamp
     FROM mandate.verdict_events
     WHERE decision_id = $1
       AND organization_id = $2
       AND domain_id = $3
     ORDER BY timestamp DESC
     LIMIT 1`,
    [decision_id, ctx.organization_id, ctx.domain_id]
  );

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];
  return {
    verdict_id: row.verdict_id,
    decision_id: row.decision_id,
    snapshot_id: row.snapshot_id,
    verdict: row.verdict as VerdictEvent['verdict'],
    matched_policy_ids: row.matched_policy_ids,
    timestamp: row.timestamp.toISOString(),
  };
}

/**
 * Lists VerdictEvents within isolation boundaries.
 * No cross-domain aggregation.
 */
export async function listVerdictEvents(
  ctx: IsolationContext,
  options?: { limit?: number; offset?: number }
): Promise<readonly VerdictEvent[]> {
  validateIsolationContext(ctx);

  const limit = options?.limit ?? 100;
  const offset = options?.offset ?? 0;

  const pool = getPool();
  const result = await pool.query<{
    verdict_id: string;
    decision_id: string;
    snapshot_id: string;
    verdict: string;
    matched_policy_ids: readonly string[];
    timestamp: Date;
  }>(
    `SELECT verdict_id, decision_id, snapshot_id, verdict, matched_policy_ids, timestamp
     FROM mandate.verdict_events
     WHERE organization_id = $1
       AND domain_id = $2
     ORDER BY timestamp DESC
     LIMIT $3 OFFSET $4`,
    [ctx.organization_id, ctx.domain_id, limit, offset]
  );

  return result.rows.map((row) => ({
    verdict_id: row.verdict_id,
    decision_id: row.decision_id,
    snapshot_id: row.snapshot_id,
    verdict: row.verdict as VerdictEvent['verdict'],
    matched_policy_ids: row.matched_policy_ids,
    timestamp: row.timestamp.toISOString(),
  }));
}
