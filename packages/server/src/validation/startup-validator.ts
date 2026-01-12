/**
 * Startup Validation - RFC-002 Spec & Scope Binding Integrity
 *
 * Validates that all policies:
 * - MUST have spec_id (RFC-002 Section 5)
 * - MUST have scope_id (RFC-002 Section 5)
 * - spec_id MUST reference an active DecisionSpec (RFC-002 Section 4)
 * - scope_id MUST reference a defined Scope (RFC-002 Section 3)
 * - spec.domain MUST equal scope.domain (RFC-002 Section 3)
 * - spec.organization_id MUST equal scope.organization_id (RFC-002 Section 3)
 *
 * Failure prevents server startup (RFC-002 Section 6).
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
      spec_id?: string; // RFC-002: Must be present
      scope_id?: string; // RFC-002: Must be present
      organization_id?: string;
      scope?: {
        organization_id?: string;
        domain_name?: string;
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
    // RFC-002: Policy MUST have spec_id
    if (!policy.spec_id) {
      errors.push({
        policy_id: policy.id,
        policy_name: policy.name,
        reason: 'RFC-002 violation: missing spec_id',
      });
      continue;
    }

    // RFC-002: Policy MUST have scope_id
    if (!policy.scope_id) {
      errors.push({
        policy_id: policy.id,
        policy_name: policy.name,
        reason: 'RFC-002 violation: missing scope_id',
      });
      continue;
    }

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

    if (!policy.scope.domain_name) {
      errors.push({
        policy_id: policy.id,
        policy_name: policy.name,
        reason: 'scope missing domain_name',
      });
      continue;
    }

    // RFC-002: Verify spec_id references an active DecisionSpec
    const specResult = await pool.query<{
      spec_id: string;
      organization_id: string;
      domain_name: string;
      status: string;
    }>(
      `SELECT spec_id, organization_id, domain_name, status 
       FROM mandate.mandate_specs 
       WHERE spec_id = $1 AND status = 'active'`,
      [policy.spec_id]
    );

    if (specResult.rows.length === 0) {
      errors.push({
        policy_id: policy.id,
        policy_name: policy.name,
        reason: `spec_id "${policy.spec_id}" does not reference an active DecisionSpec`,
      });
      continue;
    }

    const spec = specResult.rows[0];

    // RFC-002: Verify scope_id references a defined Scope
    const scopeCheckResult = await pool.query<{
      scope_id: string;
      organization_id: string;
      domain_name: string;
    }>(
      `SELECT scope_id, organization_id, domain_name FROM mandate.scopes WHERE scope_id = $1`,
      [policy.scope_id]
    );

    if (scopeCheckResult.rows.length === 0) {
      errors.push({
        policy_id: policy.id,
        policy_name: policy.name,
        reason: `scope_id "${policy.scope_id}" does not reference a defined Scope`,
      });
      continue;
    }

    const scope = scopeCheckResult.rows[0];

    // RFC-002: spec.domain_name MUST equal scope.domain_name
    if (spec.domain_name !== policy.scope.domain_name) {
      errors.push({
        policy_id: policy.id,
        policy_name: policy.name,
        reason: `RFC-002 violation: spec domain_name "${spec.domain_name}" does not match scope domain_name "${policy.scope.domain_name}"`,
      });
      continue;
    }

    // RFC-002: spec.organization_id MUST equal scope.organization_id
    if (spec.organization_id !== scope.organization_id) {
      errors.push({
        policy_id: policy.id,
        policy_name: policy.name,
        reason: `RFC-002 violation: spec org "${spec.organization_id}" does not match scope org "${scope.organization_id}"`,
      });
      continue;
    }

    // RFC-002: policy's policy.organization_id MUST match spec
    if (policy.organization_id !== spec.organization_id) {
      errors.push({
        policy_id: policy.id,
        policy_name: policy.name,
        reason: `RFC-002 violation: policy org "${policy.organization_id}" does not match spec org "${spec.organization_id}"`,
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
