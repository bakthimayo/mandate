/**
 * Specs API Routes - Read-Only Observability
 *
 * Responsibilities:
 * - Fetch spec by spec_id and version
 * - List all specs for organization (observability)
 * - NO mutations (no POST/PATCH/DELETE for spec management in MVP)
 *
 * @see RFC-001 Section 4, BUILD-PLAN-v1.2 Section 5
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { DecisionSpec } from '@mandate/shared';
import { SpecRepository } from '../repositories/spec-repository.js';
import { getPool } from '../db/connection.js';

interface FetchSpecParams {
  spec_id: string;
}

interface FetchSpecQuery {
  version: string;
}

interface ListSpecsQuery {
  organization_id: string;
}

export async function specsRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * Fetch a specific spec by spec_id and version.
   */
  fastify.get(
    '/api/v1/specs/:spec_id',
    async (
      request: FastifyRequest<{ Params: FetchSpecParams; Querystring: FetchSpecQuery }>,
      reply: FastifyReply
    ): Promise<{ spec: DecisionSpec } | { error: string }> => {
      const { spec_id } = request.params;
      const { version } = request.query;

      if (!spec_id || !version) {
        return reply.status(400).send({
          error: 'spec_id and version are required',
        });
      }

      const pool = getPool();
      const specRepo = new SpecRepository(pool);

      try {
        const spec = await specRepo.fetchSpec(spec_id, version);

        if (!spec) {
          return reply.status(404).send({
            error: `Spec ${spec_id}@${version} not found`,
          });
        }

        return { spec };
      } catch (err: any) {
        return reply.status(500).send({
          error: 'Failed to fetch spec',
          details: err.message,
        });
      }
    }
  );

  /**
   * List all specs for an organization (read-only observability).
   */
  fastify.get(
    '/api/v1/specs',
    async (
      request: FastifyRequest<{ Querystring: Partial<ListSpecsQuery> }>,
      reply: FastifyReply
    ): Promise<{ specs: DecisionSpec[] } | { error: string }> => {
      const { organization_id } = request.query;

      if (!organization_id) {
        return reply.status(400).send({
          error: 'organization_id query parameter is required',
        });
      }

      const pool = getPool();
      const specRepo = new SpecRepository(pool);

      try {
        const specs = await specRepo.listSpecsByOrganization(organization_id);
        return { specs };
      } catch (err: any) {
        return reply.status(500).send({
          error: 'Failed to list specs',
          details: err.message,
        });
      }
    }
  );
}
