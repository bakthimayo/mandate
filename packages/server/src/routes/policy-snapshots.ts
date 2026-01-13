/**
 * Policy Snapshots API Routes - RFC-003 Read-Only Observability
 * 
 * Responsibilities:
 * 1. Retrieve policy snapshots by ID
 * 2. Fetch individual policy details from snapshots
 * 3. Enforce organization/domain isolation
 * 
 * All endpoints are read-only.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getPolicySnapshotById } from '../repositories/policy-snapshot-repository.js';
import { createIsolationContext } from '../repositories/isolation-context.js';

interface GetPoliciesParams {
  snapshotId: string;
}

interface GetPoliciesQuery {
  organization_id: string;
  domain_name: string;
  policy_id?: string;
}

export async function registerPolicySnapshotRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/v1/policy-snapshots/:snapshotId/policies
   * Fetch policies from a snapshot.
   * - If policy_id query param provided: returns single policy
   * - If policy_id not provided: returns all policies in snapshot
   */
  fastify.get<{
    Params: GetPoliciesParams;
    Querystring: GetPoliciesQuery;
  }>(
    '/api/v1/policy-snapshots/:snapshotId/policies',
    async (request: FastifyRequest<{
      Params: GetPoliciesParams;
      Querystring: GetPoliciesQuery;
    }>, reply: FastifyReply) => {
      const { snapshotId } = request.params;
      const { organization_id, domain_name, policy_id } = request.query;

      // Validate isolation context from query params
      if (!organization_id || !domain_name) {
        return reply.status(400).send({
          error: 'Missing required query parameters: organization_id, domain_name'
        });
      }

      const ctx = createIsolationContext(organization_id, domain_name);

      try {
        // Fetch the snapshot
        const snapshot = await getPolicySnapshotById(snapshotId, ctx);

        if (!snapshot) {
          return reply.status(404).send({
            error: 'Policy snapshot not found'
          });
        }

        // If policy_id specified, return single policy
        if (policy_id) {
          const policy = snapshot.policies.find((p) => p.id === policy_id);

          if (!policy) {
            return reply.status(404).send({
              error: 'Policy not found in snapshot'
            });
          }

          // Transform policy to match UI type expectations
          const responsePolicy = {
            id: policy.id,
            verdict: policy.verdict,
            conditions: policy.conditions.map((cond) => ({
              signal: cond.field,
              operator: cond.operator,
              value: cond.value
            })),
            explanation: policy.description || undefined
          };

          return reply.send({
            policy: responsePolicy
          });
        }

        // Return all policies in snapshot
        const responsePolicies = snapshot.policies.map((policy) => ({
          id: policy.id,
          verdict: policy.verdict,
          conditions: policy.conditions.map((cond) => ({
            signal: cond.field,
            operator: cond.operator,
            value: cond.value
          })),
          explanation: policy.description || undefined
        }));

        reply.send({
          policies: responsePolicies,
          snapshot_id: snapshotId,
          total: responsePolicies.length
        });
      } catch (error) {
        fastify.log.error(error);
        reply.status(500).send({
          error: 'Failed to fetch policies'
        });
      }
    }
  );
}
