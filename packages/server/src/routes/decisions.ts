import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { DecisionEvent, VerdictEvent, TimelineEntry } from '@mandate/shared';
import { validateDecisionEventRequest } from '../validation/schema-validator.js';
import { insertDecisionEvent } from '../repositories/decision-event-repository.js';
import { insertVerdictEvent } from '../repositories/verdict-event-repository.js';
import { insertTimelineEntry } from '../repositories/audit-timeline-repository.js';
import { getLatestPolicySnapshot } from '../repositories/policy-snapshot-repository.js';
import { evaluateDecision } from '../evaluator/index.js';
import { randomUUID } from 'node:crypto';

interface DecisionResponse {
  verdict_id: string;
  decision_id: string;
  verdict: string;
  matched_policy_ids: readonly string[];
  timestamp: string;
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

      const snapshot = await getLatestPolicySnapshot();
      if (!snapshot) {
        return reply.status(503).send({
          error: 'No policy snapshot available',
        });
      }

      await insertDecisionEvent(decisionEvent);

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
      await insertTimelineEntry(decisionReceivedEntry);

      const evaluationResult = evaluateDecision(decisionEvent, snapshot);

      const verdictEvent: VerdictEvent = {
        verdict_id: randomUUID(),
        decision_id: decisionEvent.decision_id,
        snapshot_id: snapshot.snapshot_id,
        verdict: evaluationResult.verdict,
        matched_policy_ids: evaluationResult.matched_policy_ids,
        timestamp: new Date().toISOString(),
      };

      await insertVerdictEvent(verdictEvent);

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
      await insertTimelineEntry(verdictIssuedEntry);

      return {
        verdict_id: verdictEvent.verdict_id,
        decision_id: verdictEvent.decision_id,
        verdict: verdictEvent.verdict,
        matched_policy_ids: verdictEvent.matched_policy_ids,
        timestamp: verdictEvent.timestamp,
      };
    }
  );
}
