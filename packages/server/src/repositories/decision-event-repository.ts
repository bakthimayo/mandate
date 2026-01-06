import type { DecisionEvent } from '@mandate/shared';
import { getPool } from '../db/connection.js';

export async function insertDecisionEvent(event: DecisionEvent): Promise<void> {
  const pool = getPool();
  await pool.query(
    `INSERT INTO mandate.decision_events 
     (decision_id, intent, stage, actor, target, context, scope, timestamp)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      event.decision_id,
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
