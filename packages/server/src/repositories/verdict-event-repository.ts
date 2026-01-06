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
 * Inserts a VerdictEvent with organization, domain, spec, and scope attribution.
 * RFC-002: Enforces spec_id, scope_id, and domain in audit record.
 * Requires IsolationContext to enforce RFC-002 boundaries.
 */
export async function insertVerdictEvent(
  event: VerdictEvent,
  ctx: IsolationContext
): Promise<void> {
  validateIsolationContext(ctx);

  // RFC-002: Require spec_id for all verdicts (fail fast on incomplete data)
  if (!event.spec_id) {
    throw new Error(
      `RFC-002 violation: VerdictEvent missing required spec_id (verdict_id: ${event.verdict_id})`
    );
  }

  // RFC-002: Require scope_id for all verdicts
  if (!event.scope_id) {
    throw new Error(
      `RFC-002 violation: VerdictEvent missing required scope_id (verdict_id: ${event.verdict_id})`
    );
  }

  // RFC-002: Require domain for auditability
  if (!event.domain) {
    throw new Error(
      `RFC-002 violation: VerdictEvent missing required domain (verdict_id: ${event.verdict_id})`
    );
  }

  const pool = getPool();
  await pool.query(
    `INSERT INTO mandate.verdict_events 
     (verdict_id, decision_id, snapshot_id, verdict, matched_policy_ids, timestamp, organization_id, domain_id, spec_id, scope_id, domain, owning_team)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
    [
      event.verdict_id,
      event.decision_id,
      event.snapshot_id,
      event.verdict,
      event.matched_policy_ids,
      event.timestamp,
      ctx.organization_id,
      ctx.domain_id,
      event.spec_id,
      event.scope_id,
      event.domain,
      event.owning_team ?? null,
    ]
  );
}

/**
 * Retrieves a VerdictEvent by ID within isolation boundaries.
 * RFC-002: Returns verdict with spec_id, scope_id, and domain for auditability.
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
    spec_id: string;
    spec_version: string;
    scope_id: string;
    domain: string;
    owning_team?: string;
  }>(
    `SELECT verdict_id, decision_id, snapshot_id, verdict, matched_policy_ids, timestamp, spec_id, scope_id, domain, owning_team
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
    spec_id: row.spec_id,
    spec_version: row.spec_version,
    scope_id: row.scope_id,
    domain: row.domain,
    owning_team: row.owning_team,
  };
}

/**
 * Retrieves VerdictEvent by decision_id within isolation boundaries.
 * RFC-002: Returns verdict with spec_id, scope_id, and domain for auditability.
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
    spec_id: string;
    spec_version: string;
    scope_id: string;
    domain: string;
    owning_team?: string;
  }>(
    `SELECT verdict_id, decision_id, snapshot_id, verdict, matched_policy_ids, timestamp, spec_id, scope_id, domain, owning_team
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
    spec_id: row.spec_id,
    spec_version: row.spec_version,
    scope_id: row.scope_id,
    domain: row.domain,
    owning_team: row.owning_team,
  };
}

/**
 * Lists VerdictEvents within isolation boundaries.
 * RFC-002: Returns verdicts with spec_id, scope_id, and domain for auditability.
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
    spec_id: string;
    spec_version: string;
    scope_id: string;
    domain: string;
    owning_team?: string;
  }>(
    `SELECT verdict_id, decision_id, snapshot_id, verdict, matched_policy_ids, timestamp, spec_id, scope_id, domain, owning_team
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
    spec_id: row.spec_id,
    spec_version: row.spec_version,
    scope_id: row.scope_id,
    domain: row.domain,
    owning_team: row.owning_team,
  }));
}
