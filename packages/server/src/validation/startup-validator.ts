/**
 * Startup Validation - RFC-002 Policy Scope Integrity
 *
 * Validates that all policies:
 * - Reference exactly one scope
 * - Scope exists in the scopes table
 * - Scope belongs to one organization and domain
 *
 * Failure prevents server startup.
 */

import { getPool } from '../db/connection.js';

export interface PolicyValidationError {
  readonly policy_id: string;
  readonly policy_name: string;
  readonly reason: string;
}

export interface StartupValidationResult {
  readonly valid: boolean;
  readonly errors: readonly PolicyValidationError[];
}

/**
 * Validates all policies in the latest snapshot for RFC-002 scope integrity.
 * Must be called after database pool is initialized.
 *
 * @throws Error if validation fails (prevents server startup)
 */
export async function validatePolicyScopeIntegrity(): Promise<void> {
  const result = await runPolicyScopeValidation();

  if (!result.valid) {
    const errorMessages = result.errors
      .map((e) => `  - Policy "${e.policy_name}" (${e.policy_id}): ${e.reason}`)
      .join('\n');

    throw new Error(
      `RFC-002 Policy Scope Validation Failed:\n${errorMessages}\n\nServer startup aborted.`
    );
  }
}

/**
 * Runs policy scope validation and returns detailed results.
 */
export async function runPolicyScopeValidation(): Promise<StartupValidationResult> {
  const pool = getPool();
  const errors: PolicyValidationError[] = [];

  const snapshotResult = await pool.query<{
    snapshot_id: string;
    policies: Array<{
      id: string;
      name: string;
      organization_id?: string;
      scope?: {
        organization_id?: string;
        domain?: string;
        service?: string;
        agent?: string;
        system?: string;
        environment?: string;
      };
    }>;
  }>(
    `SELECT snapshot_id, policies 
     FROM mandate.policy_snapshots 
     ORDER BY created_at DESC 
     LIMIT 1`
  );

  if (snapshotResult.rows.length === 0) {
    return { valid: true, errors: [] };
  }

  const policies = snapshotResult.rows[0].policies;

  for (const policy of policies) {
    if (!policy.organization_id) {
      errors.push({
        policy_id: policy.id,
        policy_name: policy.name,
        reason: 'missing organization_id',
      });
      continue;
    }

    if (!policy.scope) {
      errors.push({
        policy_id: policy.id,
        policy_name: policy.name,
        reason: 'missing scope',
      });
      continue;
    }

    if (!policy.scope.domain) {
      errors.push({
        policy_id: policy.id,
        policy_name: policy.name,
        reason: 'scope missing domain',
      });
      continue;
    }

    const orgResult = await pool.query<{ organization_id: string }>(
      `SELECT organization_id FROM mandate.organizations WHERE organization_id = $1`,
      [policy.organization_id]
    );

    if (orgResult.rows.length === 0) {
      errors.push({
        policy_id: policy.id,
        policy_name: policy.name,
        reason: `organization_id "${policy.organization_id}" does not exist`,
      });
      continue;
    }

    const domainResult = await pool.query<{ domain_id: string }>(
      `SELECT domain_id FROM mandate.domains 
       WHERE organization_id = $1 AND name = $2`,
      [policy.organization_id, policy.scope.domain]
    );

    if (domainResult.rows.length === 0) {
      errors.push({
        policy_id: policy.id,
        policy_name: policy.name,
        reason: `domain "${policy.scope.domain}" does not exist in organization "${policy.organization_id}"`,
      });
      continue;
    }

    const scopeResult = await pool.query<{ scope_id: string }>(
      `SELECT scope_id FROM mandate.scopes 
       WHERE organization_id = $1 
         AND domain_id = $2
         AND COALESCE(service, '') = COALESCE($3, '')
         AND COALESCE(agent, '') = COALESCE($4, '')
         AND COALESCE(scope_system, '') = COALESCE($5, '')
         AND COALESCE(environment, '') = COALESCE($6, '')`,
      [
        policy.organization_id,
        domainResult.rows[0].domain_id,
        policy.scope.service ?? null,
        policy.scope.agent ?? null,
        policy.scope.system ?? null,
        policy.scope.environment ?? null,
      ]
    );

    if (scopeResult.rows.length === 0) {
      errors.push({
        policy_id: policy.id,
        policy_name: policy.name,
        reason: `scope does not exist: org="${policy.organization_id}", domain="${policy.scope.domain}"`,
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
