import type { PolicySnapshotV1 } from '@mandate/shared';
import { getPool } from '../db/connection.js';

export async function getLatestPolicySnapshot(): Promise<PolicySnapshotV1 | null> {
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
