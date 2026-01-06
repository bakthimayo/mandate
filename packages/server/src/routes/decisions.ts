/**
 * Decisions API Routes - RFC-002 Isolation Enforced
 *
 * All operations require IsolationContext derived from DecisionEvent.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { DecisionEvent, VerdictEvent, TimelineEntry } from '@mandate/shared';
import { validateDecisionEventRequest } from '../validation/schema-validator.js';
import { insertDecisionEvent } from '../repositories/decision-event-repository.js';
import { insertVerdictEvent } from '../repositories/verdict-event-repository.js';
import { insertTimelineEntry } from '../repositories/audit-timeline-repository.js';
import { getLatestPolicySnapshot } from '../repositories/policy-snapshot-repository.js';
import { evaluateDecision } from '../evaluator/index.js';
import { createIsolationContext } from '../repositories/isolation-context.js';
import { randomUUID } from 'node:crypto';
import { getPool } from '../db/connection.js';

interface DecisionResponse {
  decision: DecisionEvent;
  verdict: VerdictEvent;
}

async function resolveDomainId(
  organization_id: string,
  domain_name: string
): Promise<string | null> {
  const pool = getPool();
  const result = await pool.query<{ domain_id: string }>(
    `SELECT domain_id FROM mandate.domains WHERE organization_id = $1 AND name = $2`,
    [organization_id, domain_name]
  );
  return result.rows.length > 0 ? result.rows[0].domain_id : null;
}

export async function decisionsRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post(
    '/api/v1/decisions',
    async (
      request: FastifyRequest<{ Body: unknown }>,
      reply: FastifyReply
    ): Promise<DecisionResponse> => {
      const validation = validateDecisionEventRequest(request.body);
      if (!validation.valid) {
        return reply.status(400).send({
          error: 'Validation failed',
          details: validation.errors,
        });
      }

      const decisionEvent = request.body as DecisionEvent;

      if (!decisionEvent.organization_id) {
        return reply.status(400).send({
          error: 'RFC-002 violation: organization_id is required',
        });
      }

      if (!decisionEvent.scope.domain) {
        return reply.status(400).send({
          error: 'RFC-002 violation: scope.domain is required',
        });
      }

      const domain_id = await resolveDomainId(
        decisionEvent.organization_id,
        decisionEvent.scope.domain
      );

      if (!domain_id) {
        return reply.status(400).send({
          error: `RFC-002 violation: domain "${decisionEvent.scope.domain}" not found in organization`,
        });
      }

      const ctx = createIsolationContext(decisionEvent.organization_id, domain_id);

      const snapshot = await getLatestPolicySnapshot(ctx);
      if (!snapshot) {
        return reply.status(503).send({
          error: 'No policy snapshot available for this domain',
        });
      }

      await insertDecisionEvent(decisionEvent, ctx);

      const decisionReceivedEntry: TimelineEntry = {
        entry_id: randomUUID(),
        decision_id: decisionEvent.decision_id,
        intent: decisionEvent.intent,
        stage: decisionEvent.stage,
        actor: decisionEvent.actor,
        target: decisionEvent.target,
        summary: `Decision received: ${decisionEvent.intent}`,
        details: { context: decisionEvent.context },
        severity: 'info',
        source: 'system',
        authority_level: 'system',
        timestamp: new Date().toISOString(),
      };
      await insertTimelineEntry(decisionReceivedEntry, ctx);

      const evaluationResult = evaluateDecision(decisionEvent, snapshot);

      const verdictEvent: VerdictEvent = {
        verdict_id: randomUUID(),
        decision_id: decisionEvent.decision_id,
        snapshot_id: snapshot.snapshot_id,
        verdict: evaluationResult.verdict,
        matched_policy_ids: evaluationResult.matched_policy_ids,
        timestamp: new Date().toISOString(),
      };

      await insertVerdictEvent(verdictEvent, ctx);

      const verdictIssuedEntry: TimelineEntry = {
        entry_id: randomUUID(),
        decision_id: decisionEvent.decision_id,
        intent: decisionEvent.intent,
        stage: decisionEvent.stage,
        actor: decisionEvent.actor,
        target: decisionEvent.target,
        summary: `Verdict issued: ${evaluationResult.verdict}`,
        details: {
          verdict: evaluationResult.verdict,
          matched_policy_ids: evaluationResult.matched_policy_ids,
          snapshot_id: snapshot.snapshot_id,
        },
        severity: 'info',
        source: 'system',
        authority_level: 'system',
        timestamp: new Date().toISOString(),
      };
      await insertTimelineEntry(verdictIssuedEntry, ctx);

      return {
        decision: decisionEvent,
        verdict: verdictEvent,
      };
    }
  );

  fastify.post(
    '/api/v1/decisions/:decision_id/outcome',
    async (
      request: FastifyRequest<{ Params: { decision_id: string }; Body: unknown }>,
      reply: FastifyReply
    ): Promise<void> => {
      const { decision_id } = request.params;
      const body = request.body as { success: boolean; details?: Record<string, unknown> };

      const pool = getPool();

      // Get the decision event to extract org/domain context
      const decisionResult = await pool.query<{
        organization_id: string;
        domain_id: string;
      }>(
        `SELECT organization_id, domain_id FROM mandate.decision_events WHERE decision_id = $1`,
        [decision_id]
      );

      if (decisionResult.rows.length === 0) {
        return reply.status(404).send({
          error: 'Decision not found',
        });
      }

      const { organization_id, domain_id } = decisionResult.rows[0];
      const ctx = createIsolationContext(organization_id, domain_id);

      const outcomeEntry: TimelineEntry = {
        entry_id: randomUUID(),
        decision_id,
        intent: 'outcome',
        stage: 'executed',
        actor: 'agent',
        target: 'outcome',
        summary: `Outcome reported: ${body.success ? 'success' : 'failure'}`,
        details: body.details || {},
        severity: body.success ? 'info' : 'warning',
        source: 'agent',
        authority_level: 'agent',
        timestamp: new Date().toISOString(),
      };

      await insertTimelineEntry(outcomeEntry, ctx);

      reply.status(204).send();
    }
  );
}
