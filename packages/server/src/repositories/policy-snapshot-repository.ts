/**
 * Policy Snapshot Repository - RFC-002 Isolation Enforced
 *
 * All queries enforce organization_id and domain_name boundaries.
 * No implicit cross-domain policy aggregation.
 */

import type { PolicySnapshotV1 } from '@mandate/shared';
import { getPool } from '../db/connection.js';
import type { IsolationContext } from './isolation-context.js';
import { validateIsolationContext } from './isolation-context.js';

/**
 * Gets the latest policy snapshot within isolation boundaries.
 * Only returns policies that belong to the specified org/domain.
 */
export async function getLatestPolicySnapshot(
  ctx: IsolationContext
): Promise<PolicySnapshotV1 | null> {
  validateIsolationContext(ctx);

  const pool = getPool();
  const result = await pool.query<{
    snapshot_id: string;
    version: number;
    policies: unknown[];
    created_at: Date;
  }>(
    `SELECT snapshot_id, version, policies, created_at 
      FROM mandate.policy_snapshots 
      WHERE organization_id = $1
        AND domain_name = $2
      ORDER BY created_at DESC 
      LIMIT 1`,
    [ctx.organization_id, ctx.domain_name]
  );

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];
  return {
    snapshot_id: row.snapshot_id,
    version: row.version as 1,
    policies: row.policies as PolicySnapshotV1['policies'],
    created_at: row.created_at.toISOString(),
  };
}

/**
 * Gets a policy snapshot by ID within isolation boundaries.
 * Returns null if not found or outside isolation context.
 */
export async function getPolicySnapshotById(
  snapshot_id: string,
  ctx: IsolationContext
): Promise<PolicySnapshotV1 | null> {
  validateIsolationContext(ctx);

  const pool = getPool();
  const result = await pool.query<{
    snapshot_id: string;
    version: number;
    policies: unknown[];
    created_at: Date;
  }>(
    `SELECT snapshot_id, version, policies, created_at 
      FROM mandate.policy_snapshots 
      WHERE snapshot_id = $1
        AND organization_id = $2
        AND domain_name = $3`,
    [snapshot_id, ctx.organization_id, ctx.domain_name]
  );

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];
  return {
    snapshot_id: row.snapshot_id,
    version: row.version as 1,
    policies: row.policies as PolicySnapshotV1['policies'],
    created_at: row.created_at.toISOString(),
  };
}

/**
 * Lists policy snapshots within isolation boundaries.
 * No cross-domain aggregation.
 */
export async function listPolicySnapshots(
  ctx: IsolationContext,
  options?: { limit?: number; offset?: number }
): Promise<readonly PolicySnapshotV1[]> {
  validateIsolationContext(ctx);

  const limit = options?.limit ?? 100;
  const offset = options?.offset ?? 0;

  const pool = getPool();
  const result = await pool.query<{
    snapshot_id: string;
    version: number;
    policies: unknown[];
    created_at: Date;
  }>(
    `SELECT snapshot_id, version, policies, created_at 
      FROM mandate.policy_snapshots 
      WHERE organization_id = $1
        AND domain_name = $2
      ORDER BY created_at DESC
      LIMIT $3 OFFSET $4`,
    [ctx.organization_id, ctx.domain_name, limit, offset]
  );

  return result.rows.map((row) => ({
    snapshot_id: row.snapshot_id,
    version: row.version as 1,
    policies: row.policies as PolicySnapshotV1['policies'],
    created_at: row.created_at.toISOString(),
  }));
}

/**
 * @internal - Used by startup validator only.
 * Gets the latest snapshot across all domains for validation.
 * NOT for general use - bypasses isolation for startup checks.
 */
export async function _getLatestSnapshotForValidation(): Promise<PolicySnapshotV1 | null> {
  const pool = getPool();
  const result = await pool.query<{
    snapshot_id: string;
    version: number;
    policies: unknown[];
    created_at: Date;
  }>(
    `SELECT snapshot_id, version, policies, created_at 
     FROM mandate.policy_snapshots 
     ORDER BY created_at DESC 
     LIMIT 1`
  );

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];
  return {
    snapshot_id: row.snapshot_id,
    version: row.version as 1,
    policies: row.policies as PolicySnapshotV1['policies'],
    created_at: row.created_at.toISOString(),
  };
}
