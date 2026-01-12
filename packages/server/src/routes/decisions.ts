/**
 * Decisions API Routes - RFC-001 v1.1 + Build Plan v1.2
 *
 * Responsibilities:
 * 1. Resolve active spec by (org, domain, intent, stage)
 * 2. Validate required signals
 * 3. Persist decision with spec reference
 * 4. Invoke evaluator with spec constraint
 * 5. Persist verdict with spec reference
 *
 * @see BUILD-PLAN-v1.2 Section 6
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { DecisionEvent, VerdictEvent, TimelineEntry } from '@mandate/shared';
import { validateDecisionEventRequest } from '../validation/schema-validator.js';
import { insertDecisionEvent } from '../repositories/decision-event-repository.js';
import { insertVerdictEvent } from '../repositories/verdict-event-repository.js';
import { insertTimelineEntry } from '../repositories/audit-timeline-repository.js';
import { getLatestPolicySnapshot } from '../repositories/policy-snapshot-repository.js';
import { evaluateDecision } from '../evaluator/index.js';
import { SpecRepository } from '../repositories/spec-repository.js';
import { SignalValidator } from '../validation/signal-validator.js';
import { createIsolationContext } from '../repositories/isolation-context.js';
import { randomUUID } from 'node:crypto';
import { getPool } from '../db/connection.js';
import { listDecisionEvents } from '../repositories/decision-event-repository.js';

interface DecisionResponse {
  decision: Required<Pick<DecisionEvent, 'spec_id' | 'spec_version'>> & DecisionEvent;
  verdict: VerdictEvent;
}

interface ListDecisionsQuery {
  organization_id: string;
  domain: string;
  limit?: string;
  offset?: string;
}

async function resolveDomainName(
  organization_id: string,
  domain_name: string
): Promise<boolean> {
  const pool = getPool();
  const result = await pool.query<{ domain_name: string }>(
    `SELECT domain_name FROM mandate.domains WHERE organization_id = $1 AND domain_name = $2`,
    [organization_id, domain_name]
  );
  return result.rows.length > 0;
}

/**
 * Resolve or create a scope based on decision scope fields.
 * Respects append-only constraint: queries first, then inserts only if not found.
 * @see RFC-002 Section 5 - Scope attribution
 */
async function resolveOrCreateScopeId(
  scope: Record<string, any>,
  organization_id: string,
  domain_name: string
): Promise<string> {
  const pool = getPool();

  // Extract scope fields, default to null if not provided
  const service = scope.service ?? null;
  const agent = scope.agent ?? null;
  const scopeSystem = scope.system ?? null;
  const environment = scope.environment ?? null;
  const tenant = scope.tenant ?? null;

  // Step 1: Query for existing scope with matching selectors
  const existingResult = await pool.query<{ scope_id: string }>(
    `SELECT scope_id FROM mandate.scopes 
     WHERE organization_id = $1
       AND domain_name = $2
       AND COALESCE(service, '') = COALESCE($3, '')
       AND COALESCE(agent, '') = COALESCE($4, '')
       AND COALESCE(scope_system, '') = COALESCE($5, '')
       AND COALESCE(environment, '') = COALESCE($6, '')
       AND COALESCE(tenant, '') = COALESCE($7, '')
     LIMIT 1`,
    [organization_id, domain_name, service, agent, scopeSystem, environment, tenant]
  );

  if (existingResult.rows.length > 0) {
    return existingResult.rows[0].scope_id;
  }

  // Step 2: Insert new scope (append-only, no UPDATE)
  // RFC-002: scope_id MUST embed domain_name prefix
  const scopeId = [domain_name, service, agent, scopeSystem, environment, tenant]
    .filter(Boolean)
    .join('.');
  
  const insertResult = await pool.query<{ scope_id: string }>(
    `INSERT INTO mandate.scopes (
       scope_id, organization_id, domain_name, service, agent, scope_system, environment, tenant
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING scope_id`,
    [scopeId, organization_id, domain_name, service, agent, scopeSystem, environment, tenant]
  );

  if (insertResult.rows.length === 0) {
    throw new Error('Failed to create scope');
  }

  return insertResult.rows[0].scope_id;
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

      if (!decisionEvent.domain_name) {
        return reply.status(400).send({
          error: 'RFC-002 violation: domain_name is required',
        });
      }

      const domainExists = await resolveDomainName(
        decisionEvent.organization_id,
        decisionEvent.domain_name
      );

      if (!domainExists) {
        return reply.status(400).send({
          error: `RFC-002 violation: domain "${decisionEvent.domain_name}" not found in organization`,
        });
      }

      const ctx = createIsolationContext(decisionEvent.organization_id, decisionEvent.domain_name);
      const pool = getPool();
      const specRepo = new SpecRepository(pool);

      // =========================================================================
      // NEW: Step 1 - Resolve active spec
      // @see RFC-001 Section 11, BUILD-PLAN-v1.2 Section 6
      // =========================================================================
      const spec = await specRepo.resolveActiveSpec(
        decisionEvent.organization_id,
        decisionEvent.domain_name,
        decisionEvent.intent,
        decisionEvent.stage
      );

      if (!spec) {
        return reply.status(400).send({
          error: `No active spec found for intent='${decisionEvent.intent}' stage='${decisionEvent.stage}' in domain='${decisionEvent.domain_name}'`,
        });
      }

      // =========================================================================
      // NEW: Step 2 - Validate signals against spec
      // @see BUILD-PLAN-v1.2 Section 4
      // =========================================================================
      try {
        SignalValidator.validate(spec, decisionEvent);
      } catch (err: any) {
        return reply.status(400).send({
          error: 'Signal validation failed',
          details: err.message,
        });
      }

      // =========================================================================
      // Step 3 - Enrich decision with spec reference
      // @see RFC-001 Section 12
      // =========================================================================
      const enrichedDecision: DecisionEvent = {
        ...decisionEvent,
        spec_id: spec.spec_id,
        spec_version: spec.version,
      };

      const snapshot = await getLatestPolicySnapshot(ctx);
      if (!snapshot) {
        return reply.status(503).send({
          error: 'No policy snapshot available for this domain',
        });
      }

      await insertDecisionEvent(enrichedDecision, ctx);

      const decisionReceivedEntry: TimelineEntry = {
        entry_id: randomUUID(),
        organization_id: enrichedDecision.organization_id,
        domain_name: enrichedDecision.domain_name,
        decision_id: enrichedDecision.decision_id,
        intent: enrichedDecision.intent,
        stage: enrichedDecision.stage,
        actor: enrichedDecision.actor,
        target: enrichedDecision.target,
        summary: `Decision received: ${enrichedDecision.intent}`,
        details: { context: enrichedDecision.context },
        severity: 'info',
        source: 'system',
        authority_level: 'system',
        timestamp: new Date().toISOString(),
      };
      await insertTimelineEntry(decisionReceivedEntry, ctx);

      // =========================================================================
      // Step 4 - Evaluate with spec constraint
      // @see BUILD-PLAN-v1.2 Section 7
      // =========================================================================
      const evaluationResult = evaluateDecision(enrichedDecision, spec, snapshot);

      // =========================================================================
      // Step 5 - Persist verdict with spec and scope reference (RFC-002)
      // @see RFC-001 Section 12, RFC-002 Section 9
      // =========================================================================
      // RFC-002: Resolve scope_id from decision's scope fields
      const scopeId = await resolveOrCreateScopeId(
        enrichedDecision.scope,
        enrichedDecision.organization_id,
        enrichedDecision.domain_name
      );
      const owningTeam = 'TODO_RESOLVE_OWNING_TEAM';

      const enrichedVerdict: VerdictEvent = {
        verdict_id: randomUUID(),
        organization_id: enrichedDecision.organization_id,
        decision_id: enrichedDecision.decision_id,
        snapshot_id: snapshot.snapshot_id,
        verdict: evaluationResult.verdict,
        matched_policy_ids: evaluationResult.matched_policy_ids,
        timestamp: new Date().toISOString(),
        spec_id: spec.spec_id,
        spec_version: spec.version,
        scope_id: scopeId, // RFC-002: Scope used for evaluation
        domain_name: enrichedDecision.domain_name, // RFC-002: Domain for auditability
        owning_team: owningTeam, // RFC-002: Team ownership
      };

      await insertVerdictEvent(enrichedVerdict, ctx);

      const verdictIssuedEntry: TimelineEntry = {
        entry_id: randomUUID(),
        organization_id: enrichedDecision.organization_id,
        domain_name: enrichedDecision.domain_name,
        decision_id: enrichedDecision.decision_id,
        intent: enrichedDecision.intent,
        stage: enrichedDecision.stage,
        actor: enrichedDecision.actor,
        target: enrichedDecision.target,
        summary: `Verdict issued: ${evaluationResult.verdict}`,
        details: {
          verdict: evaluationResult.verdict,
          matched_policy_ids: evaluationResult.matched_policy_ids,
          snapshot_id: snapshot.snapshot_id,
          spec_id: spec.spec_id,
          spec_version: spec.version,
          scope_id: scopeId,
          domain_name: enrichedDecision.domain_name,
          owning_team: owningTeam,
        },
        severity: 'info',
        source: 'system',
        authority_level: 'system',
        timestamp: new Date().toISOString(),
        spec_id: spec.spec_id,
        scope_id: scopeId,
        owning_team: owningTeam,
      };
      await insertTimelineEntry(verdictIssuedEntry, ctx);

      return {
        decision: {
          ...enrichedDecision,
          spec_id: enrichedDecision.spec_id!,
          spec_version: enrichedDecision.spec_version!,
        },
        verdict: enrichedVerdict,
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
        domain_name: string;
      }>(
        `SELECT organization_id, domain_name FROM mandate.decision_events WHERE decision_id = $1`,
        [decision_id]
      );

      if (decisionResult.rows.length === 0) {
        return reply.status(404).send({
          error: 'Decision not found',
        });
      }

      const { organization_id, domain_name } = decisionResult.rows[0];
      const ctx = createIsolationContext(organization_id, domain_name);

      const outcomeEntry: TimelineEntry = {
        entry_id: randomUUID(),
        organization_id,
        domain_name,
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
