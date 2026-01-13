/**
 * Observability API Routes - RFC-003 Read-Only Audit UI
 *
 * GET-only endpoints for retrieving decisions, verdicts, and timeline data.
 * All operations enforce RFC-002 isolation via organization_id and domain_name (query params).
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getPool } from '../db/connection.js';
import { createIsolationContext } from '../repositories/isolation-context.js';
import {
  getDecisionEventById,
  listDecisionEvents,
  listDecisionEventsWithVerdicts,
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
  domain_name?: string;
  limit?: string;
  offset?: string;
  verdict?: string;
  intent?: string;
  agent?: string;
  startTime?: string;
  endTime?: string;
}

interface DecisionQuery {
  organization_id?: string;
  domain_name?: string;
}

async function domainExists(
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
        const result = await pool.query<{ domain_name: string }>(
          `SELECT domain_name FROM mandate.domains WHERE organization_id = $1 ORDER BY domain_name`,
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
   * List decisions with required query params: organization_id, domain_name
   */
  fastify.get(
    '/api/v1/decisions',
    async (
      request: FastifyRequest<{
        Querystring: ListDecisionsQuery;
      }>,
      reply: FastifyReply
    ) => {
      const { organization_id, domain_name, limit, offset, verdict, startTime, endTime } = request.query;

       if (!organization_id) {
         return reply.status(400).send({
           error: 'organization_id query parameter is required',
         });
       }
       if (!domain_name) {
         return reply.status(400).send({
           error: 'domain_name query parameter is required',
         });
       }

       const exists = await domainExists(organization_id, domain_name);
       if (!exists) {
         return reply.status(404).send({
           error: 'Domain not found',
         });
       }

       const ctx = createIsolationContext(organization_id, domain_name);

       try {
         const decisions = await listDecisionEventsWithVerdicts(ctx, {
           limit: limit ? parseInt(limit, 10) : 100,
           offset: offset ? parseInt(offset, 10) : 0,
           verdict: verdict,
           startTime: startTime ? new Date(startTime) : undefined,
           endTime: endTime ? new Date(endTime) : undefined,
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
   * Get a single decision (requires organization_id and domain_name query params)
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
      const { organization_id, domain_name } = request.query;

      if (!organization_id) {
        return reply.status(400).send({
          error: 'organization_id query parameter is required',
        });
      }
      if (!domain_name) {
        return reply.status(400).send({
          error: 'domain_name query parameter is required',
        });
      }

      const exists = await domainExists(organization_id, domain_name);
      if (!exists) {
        return reply.status(404).send({
          error: 'Domain not found',
        });
      }

      const ctx = createIsolationContext(organization_id, domain_name);

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
   * Get the verdict for a decision (requires organization_id and domain_name query params)
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
      const { organization_id, domain_name } = request.query;

      if (!organization_id) {
        return reply.status(400).send({
          error: 'organization_id query parameter is required',
        });
      }
      if (!domain_name) {
        return reply.status(400).send({
          error: 'domain_name query parameter is required',
        });
      }

      const exists = await domainExists(organization_id, domain_name);
      if (!exists) {
        return reply.status(404).send({
          error: 'Domain not found',
        });
      }

      const ctx = createIsolationContext(organization_id, domain_name);

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
   * Get the full timeline for a decision (requires organization_id and domain_name query params)
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
      let { organization_id, domain_name } = request.query;

      // Get decision to extract org/domain_name if not provided
      let organization_id_resolved: string | undefined = organization_id;
      let domain_name_resolved: string | undefined = undefined;

      if (!organization_id || !domain_name) {
        const pool = getPool();
        const decisionResult = await pool.query<{
           organization_id: string;
           domain_name: string;
         }>(
           `SELECT organization_id, d.domain_name FROM mandate.decision_events de 
            JOIN mandate.domains d ON de.organization_id = d.organization_id AND de.domain_name = d.domain_name
            WHERE de.decision_id = $1`,
           [decision_id]
         );

        if (decisionResult.rows.length === 0) {
          return reply.status(404).send({
            error: 'Decision not found',
          });
        }

        organization_id_resolved = decisionResult.rows[0].organization_id;
        domain_name_resolved = decisionResult.rows[0].domain_name;

        // Verify query params match if provided
        if (organization_id && organization_id !== organization_id_resolved) {
          return reply.status(403).send({
            error: 'Organization ID mismatch',
          });
        }
        if (domain_name && domain_name !== domain_name_resolved) {
          return reply.status(403).send({
            error: 'Domain mismatch',
          });
        }
      } else {
        const exists = await domainExists(organization_id, domain_name);
        if (!exists) {
          return reply.status(404).send({
            error: 'Domain not found',
          });
        }
        domain_name_resolved = domain_name;
      }

      if (!organization_id_resolved || !domain_name_resolved) {
        return reply.status(400).send({
          error: 'Missing organization_id or domain_name',
        });
      }

      const ctx = createIsolationContext(organization_id_resolved, domain_name_resolved);

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
