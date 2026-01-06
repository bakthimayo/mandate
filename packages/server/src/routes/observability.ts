/**
 * Observability API Routes - RFC-003 Read-Only Audit UI
 *
 * GET-only endpoints for retrieving decisions, verdicts, and timeline data.
 * All operations enforce RFC-002 isolation via organization_id and domain (query params).
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getPool } from '../db/connection.js';
import { createIsolationContext } from '../repositories/isolation-context.js';
import {
  getDecisionEventById,
  listDecisionEvents,
} from '../repositories/decision-event-repository.js';
import {
  getVerdictEventByDecisionId,
} from '../repositories/verdict-event-repository.js';
import {
  listTimelineEntriesByDecisionId,
} from '../repositories/audit-timeline-repository.js';

interface DomainsQuery {
  organization_id?: string;
}

interface ListDecisionsQuery {
  organization_id?: string;
  domain?: string;
  limit?: string;
  offset?: string;
  verdict?: string;
  intent?: string;
  agent?: string;
}

interface DecisionQuery {
  organization_id?: string;
  domain?: string;
}

async function resolveDomainId(
  organization_id: string,
  domain: string
): Promise<string | null> {
  const pool = getPool();
  const result = await pool.query<{ domain_id: string }>(
    `SELECT domain_id FROM mandate.domains WHERE organization_id = $1 AND name = $2`,
    [organization_id, domain]
  );
  return result.rows.length > 0 ? result.rows[0].domain_id : null;
}

export async function observabilityRoutes(
  fastify: FastifyInstance
): Promise<void> {
  /**
   * GET /api/v1/domains
   * List domains for an organization (required query param: organization_id)
   */
  fastify.get(
    '/api/v1/domains',
    async (
      request: FastifyRequest<{
        Querystring: DomainsQuery;
      }>,
      reply: FastifyReply
    ) => {
      const { organization_id } = request.query;

      if (!organization_id) {
        return reply.status(400).send({
          error: 'organization_id query parameter is required',
        });
      }

      const pool = getPool();

      try {
        const result = await pool.query<{ domain_id: string; name: string }>(
          `SELECT domain_id, name FROM mandate.domains WHERE organization_id = $1 ORDER BY name`,
          [organization_id]
        );

        return {
          domains: result.rows,
        };
      } catch (err) {
        return reply.status(500).send({
          error: 'Failed to fetch domains',
          details: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }
  );

  /**
   * GET /api/v1/decisions
   * List decisions with required query params: organization_id, domain
   */
  fastify.get(
    '/api/v1/decisions',
    async (
      request: FastifyRequest<{
        Querystring: ListDecisionsQuery;
      }>,
      reply: FastifyReply
    ) => {
      const { organization_id, domain, limit, offset } = request.query;

      if (!organization_id) {
        return reply.status(400).send({
          error: 'organization_id query parameter is required',
        });
      }
      if (!domain) {
        return reply.status(400).send({
          error: 'domain query parameter is required',
        });
      }

      const domain_id = await resolveDomainId(organization_id, domain);
      if (!domain_id) {
        return reply.status(404).send({
          error: 'Domain not found',
        });
      }

      const ctx = createIsolationContext(organization_id, domain_id);

      try {
        const decisions = await listDecisionEvents(ctx, {
          limit: limit ? parseInt(limit, 10) : 100,
          offset: offset ? parseInt(offset, 10) : 0,
        });

        return {
          decisions,
        };
      } catch (err) {
        return reply.status(500).send({
          error: 'Failed to fetch decisions',
          details: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }
  );

  /**
   * GET /api/v1/decisions/:decision_id
   * Get a single decision (requires organization_id and domain query params)
   */
  fastify.get(
    '/api/v1/decisions/:decision_id',
    async (
      request: FastifyRequest<{
        Params: { decision_id: string };
        Querystring: DecisionQuery;
      }>,
      reply: FastifyReply
    ) => {
      const { decision_id } = request.params;
      const { organization_id, domain } = request.query;

      if (!organization_id) {
        return reply.status(400).send({
          error: 'organization_id query parameter is required',
        });
      }
      if (!domain) {
        return reply.status(400).send({
          error: 'domain query parameter is required',
        });
      }

      const domain_id = await resolveDomainId(organization_id, domain);
      if (!domain_id) {
        return reply.status(404).send({
          error: 'Domain not found',
        });
      }

      const ctx = createIsolationContext(organization_id, domain_id);

      try {
        const decision = await getDecisionEventById(decision_id, ctx);

        if (!decision) {
          return reply.status(404).send({
            error: 'Decision not found',
          });
        }

        return decision;
      } catch (err) {
        return reply.status(500).send({
          error: 'Failed to fetch decision',
          details: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }
  );

  /**
   * GET /api/v1/decisions/:decision_id/verdict
   * Get the verdict for a decision (requires organization_id and domain query params)
   */
  fastify.get(
    '/api/v1/decisions/:decision_id/verdict',
    async (
      request: FastifyRequest<{
        Params: { decision_id: string };
        Querystring: DecisionQuery;
      }>,
      reply: FastifyReply
    ) => {
      const { decision_id } = request.params;
      const { organization_id, domain } = request.query;

      if (!organization_id) {
        return reply.status(400).send({
          error: 'organization_id query parameter is required',
        });
      }
      if (!domain) {
        return reply.status(400).send({
          error: 'domain query parameter is required',
        });
      }

      const domain_id = await resolveDomainId(organization_id, domain);
      if (!domain_id) {
        return reply.status(404).send({
          error: 'Domain not found',
        });
      }

      const ctx = createIsolationContext(organization_id, domain_id);

      try {
        const verdict = await getVerdictEventByDecisionId(decision_id, ctx);

        if (!verdict) {
          return reply.status(404).send({
            error: 'Verdict not found for this decision',
          });
        }

        return verdict;
      } catch (err) {
        return reply.status(500).send({
          error: 'Failed to fetch verdict',
          details: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }
  );

  /**
   * GET /api/v1/decisions/:decision_id/timeline
   * Get the full timeline for a decision (requires organization_id and domain query params)
   */
  fastify.get(
    '/api/v1/decisions/:decision_id/timeline',
    async (
      request: FastifyRequest<{
        Params: { decision_id: string };
        Querystring: DecisionQuery;
      }>,
      reply: FastifyReply
    ) => {
      const { decision_id } = request.params;
      let { organization_id, domain } = request.query;

      // Get decision to extract org/domain if not provided
      let organization_id_resolved = organization_id;
      let domain_id_resolved: string | null = null;

      if (!organization_id || !domain) {
        const pool = getPool();
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

        organization_id_resolved = decisionResult.rows[0].organization_id;
        domain_id_resolved = decisionResult.rows[0].domain_id;

        // Verify query params match if provided
        if (organization_id && organization_id !== organization_id_resolved) {
          return reply.status(403).send({
            error: 'Organization ID mismatch',
          });
        }
        if (domain) {
          const domainIdResult = await pool.query<{ domain_id: string }>(
            `SELECT domain_id FROM mandate.domains WHERE organization_id = $1 AND name = $2`,
            [organization_id_resolved, domain]
          );
          if (domainIdResult.rows.length === 0 || domainIdResult.rows[0].domain_id !== domain_id_resolved) {
            return reply.status(403).send({
              error: 'Domain mismatch',
            });
          }
        }
      } else {
        domain_id_resolved = await resolveDomainId(organization_id, domain);
        if (!domain_id_resolved) {
          return reply.status(404).send({
            error: 'Domain not found',
          });
        }
      }

      const ctx = createIsolationContext(organization_id_resolved, domain_id_resolved);

      try {
        // Get decision
        const decision = await getDecisionEventById(decision_id, ctx);
        if (!decision) {
          return reply.status(404).send({
            error: 'Decision not found',
          });
        }

        // Get timeline entries
        const timeline = await listTimelineEntriesByDecisionId(decision_id, ctx);

        // Get verdict (optional)
        const verdict = await getVerdictEventByDecisionId(decision_id, ctx);

        // Add type to timeline entries for UI
        const enrichedTimeline = timeline.map((entry) => ({
          ...entry,
          id: entry.entry_id,
          type: entry.intent === 'verdict' || entry.summary?.includes('Verdict') 
            ? 'verdict' 
            : entry.intent === 'outcome'
            ? 'audit'
            : 'decision',
        }));

        return reply.send({
          decision_id,
          decision_event: decision,
          timeline: enrichedTimeline,
          verdict: verdict ?? null,
        });
      } catch (err) {
        return reply.status(500).send({
          error: 'Failed to fetch timeline',
          details: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }
  );
}
