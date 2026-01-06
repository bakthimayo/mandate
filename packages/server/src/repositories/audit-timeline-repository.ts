/**
 * Audit Timeline Repository - RFC-002 Isolation Enforced
 *
 * All queries enforce organization_id and domain_id boundaries.
 * No implicit cross-domain aggregation.
 * Preserves domain context for compliance exports.
 */

import type { TimelineEntry } from '@mandate/shared';
import { getPool } from '../db/connection.js';
import type { IsolationContext } from './isolation-context.js';
import { validateIsolationContext } from './isolation-context.js';

/**
 * Inserts a TimelineEntry with organization and domain attribution.
 * Requires IsolationContext to enforce RFC-002 boundaries.
 */
export async function insertTimelineEntry(
  entry: TimelineEntry,
  ctx: IsolationContext
): Promise<void> {
  validateIsolationContext(ctx);

  const pool = getPool();
  await pool.query(
    `INSERT INTO mandate.audit_timeline_entries 
     (entry_id, decision_id, intent, stage, actor, target, summary, details, severity, event_source, authority_level, timestamp, organization_id, domain_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
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
      ctx.organization_id,
      ctx.domain_id,
    ]
  );
}

/**
 * Retrieves a TimelineEntry by ID within isolation boundaries.
 * Returns null if not found or outside isolation context.
 */
export async function getTimelineEntryById(
  entry_id: string,
  ctx: IsolationContext
): Promise<TimelineEntry | null> {
  validateIsolationContext(ctx);

  const pool = getPool();
  const result = await pool.query<{
    entry_id: string;
    decision_id: string;
    intent: string;
    stage: string;
    actor: string;
    target: string;
    summary: string;
    details: Record<string, unknown>;
    severity: string;
    event_source: string;
    authority_level: string;
    timestamp: Date;
  }>(
    `SELECT entry_id, decision_id, intent, stage, actor, target, summary, details, severity, event_source, authority_level, timestamp
     FROM mandate.audit_timeline_entries
     WHERE entry_id = $1
       AND organization_id = $2
       AND domain_id = $3`,
    [entry_id, ctx.organization_id, ctx.domain_id]
  );

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];
  return {
    entry_id: row.entry_id,
    decision_id: row.decision_id,
    intent: row.intent,
    stage: row.stage as TimelineEntry['stage'],
    actor: row.actor,
    target: row.target,
    summary: row.summary,
    details: row.details,
    severity: row.severity,
    source: row.event_source as TimelineEntry['source'],
    authority_level: row.authority_level as TimelineEntry['authority_level'],
    timestamp: row.timestamp.toISOString(),
  };
}

/**
 * Lists TimelineEntries for a decision within isolation boundaries.
 * Preserves domain context for audit trails.
 */
export async function listTimelineEntriesByDecisionId(
  decision_id: string,
  ctx: IsolationContext
): Promise<readonly TimelineEntry[]> {
  validateIsolationContext(ctx);

  const pool = getPool();
  const result = await pool.query<{
    entry_id: string;
    decision_id: string;
    intent: string;
    stage: string;
    actor: string;
    target: string;
    summary: string;
    details: Record<string, unknown>;
    severity: string;
    event_source: string;
    authority_level: string;
    timestamp: Date;
  }>(
    `SELECT entry_id, decision_id, intent, stage, actor, target, summary, details, severity, event_source, authority_level, timestamp
     FROM mandate.audit_timeline_entries
     WHERE decision_id = $1
       AND organization_id = $2
       AND domain_id = $3
     ORDER BY timestamp ASC`,
    [decision_id, ctx.organization_id, ctx.domain_id]
  );

  return result.rows.map((row) => ({
    entry_id: row.entry_id,
    decision_id: row.decision_id,
    intent: row.intent,
    stage: row.stage as TimelineEntry['stage'],
    actor: row.actor,
    target: row.target,
    summary: row.summary,
    details: row.details,
    severity: row.severity,
    source: row.event_source as TimelineEntry['source'],
    authority_level: row.authority_level as TimelineEntry['authority_level'],
    timestamp: row.timestamp.toISOString(),
  }));
}

/**
 * Lists TimelineEntries within isolation boundaries.
 * No cross-domain aggregation.
 */
export async function listTimelineEntries(
  ctx: IsolationContext,
  options?: { limit?: number; offset?: number }
): Promise<readonly TimelineEntry[]> {
  validateIsolationContext(ctx);

  const limit = options?.limit ?? 100;
  const offset = options?.offset ?? 0;

  const pool = getPool();
  const result = await pool.query<{
    entry_id: string;
    decision_id: string;
    intent: string;
    stage: string;
    actor: string;
    target: string;
    summary: string;
    details: Record<string, unknown>;
    severity: string;
    event_source: string;
    authority_level: string;
    timestamp: Date;
  }>(
    `SELECT entry_id, decision_id, intent, stage, actor, target, summary, details, severity, event_source, authority_level, timestamp
     FROM mandate.audit_timeline_entries
     WHERE organization_id = $1
       AND domain_id = $2
     ORDER BY timestamp DESC
     LIMIT $3 OFFSET $4`,
    [ctx.organization_id, ctx.domain_id, limit, offset]
  );

  return result.rows.map((row) => ({
    entry_id: row.entry_id,
    decision_id: row.decision_id,
    intent: row.intent,
    stage: row.stage as TimelineEntry['stage'],
    actor: row.actor,
    target: row.target,
    summary: row.summary,
    details: row.details,
    severity: row.severity,
    source: row.event_source as TimelineEntry['source'],
    authority_level: row.authority_level as TimelineEntry['authority_level'],
    timestamp: row.timestamp.toISOString(),
  }));
}
