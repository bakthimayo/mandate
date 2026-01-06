import type { VerdictEvent } from '@mandate/shared';
import { getPool } from '../db/connection.js';

export async function insertVerdictEvent(event: VerdictEvent): Promise<void> {
  const pool = getPool();
  await pool.query(
    `INSERT INTO mandate.verdict_events 
     (verdict_id, decision_id, snapshot_id, verdict, matched_policy_ids, timestamp)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      event.verdict_id,
      event.decision_id,
      event.snapshot_id,
      event.verdict,
      event.matched_policy_ids,
      event.timestamp,
    ]
  );
}
