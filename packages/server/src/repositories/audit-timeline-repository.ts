import type { TimelineEntry } from '@mandate/shared';
import { getPool } from '../db/connection.js';

export async function insertTimelineEntry(entry: TimelineEntry): Promise<void> {
  const pool = getPool();
  await pool.query(
    `INSERT INTO mandate.audit_timeline_entries 
     (entry_id, decision_id, intent, stage, actor, target, summary, details, severity, event_source, authority_level, timestamp)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
    [
      entry.entry_id,
      entry.decision_id,
      entry.intent,
      entry.stage,
      entry.actor,
      entry.target,
      entry.summary,
      JSON.stringify(entry.details),
      entry.severity,
      entry.source,
      entry.authority_level,
      entry.timestamp,
    ]
  );
}
