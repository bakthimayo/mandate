/**
 * Evaluator Module - Public API
 *
 * This is the ONLY public entry point for the evaluator module.
 * All other files are internal implementation details.
 *
 * Rules:
 * - No async code
 * - No database access
 * - No Date, Math.random, setTimeout, fetch
 * - Pure and deterministic
 *
 * @see RFC-001 Section 2, BUILD-PLAN-v1.2 Section 7
 */

import type { DecisionEvent, PolicySnapshotV1, DecisionSpec, Verdict } from '@mandate/shared';
import type { EvaluationResult } from './__internal__/evaluator-types.js';
import { validatePoliciesAgainstSpec } from './__internal__/policy-spec-validator.js';
import { scopeMatches } from './__internal__/scope-matcher.js';
import { evaluateAllConditions } from './__internal__/condition-evaluator.js';
import { resolveVerdict, type PolicyMatch } from './__internal__/verdict-resolver.js';

export type { EvaluationResult } from './__internal__/evaluator-types.js';

/**
 * Evaluates a DecisionEvent against a PolicySnapshotV1 constrained by a DecisionSpec.
 * Pure function - no side effects.
 *
 * RFC-002 Enforcement:
 * - Decision and spec MUST have matching organization_id and domain
 * - Only policies with matching spec_id are considered
 * - Scope matching is performed to filter applicable policies
 * - All matched verdicts must be in spec.allowed_verdicts
 *
 * @param decision - The decision event to evaluate (must have org/domain/intent/stage)
 * @param spec - The decision spec that constrains the evaluation
 * @param snapshot - The policy snapshot to evaluate against
 * @returns The evaluation result with verdict and matched policy IDs
 * @throws Error if policies violate spec constraints or isolation boundaries
 *
 * @see RFC-001 Section 7, Section 12, Section 13
 * @see RFC-002 Section 7, Section 8
 * @see BUILD-PLAN-v1.2 Section 7
 */
export function evaluateDecision(
  decision: DecisionEvent,
  spec: DecisionSpec,
  snapshot: PolicySnapshotV1
): EvaluationResult {
  // =========================================================================
  // RFC-002: Enforce organization_id and domain alignment
  // =========================================================================
  if (decision.organization_id !== spec.organization_id) {
    throw new Error(
      `RFC-002 violation: decision.organization_id "${decision.organization_id}" ` +
        `does not match spec.organization_id "${spec.organization_id}"`
    );
  }

  if (decision.scope.domain_name !== spec.domain_name) {
    throw new Error(
      `RFC-002 violation: decision.scope.domain_name "${decision.scope.domain_name}" ` +
        `does not match spec.domain_name "${spec.domain_name}"`
    );
  }

  // RFC-002: Filter policies by spec_id before validation
  const applicablePolicies = snapshot.policies.filter(
    (policy) => policy.spec_id === spec.spec_id
  );

  console.log(`[EVALUATOR] Spec: ${spec.spec_id}, Applicable policies: ${applicablePolicies.length}`);

  // Validate that policies only reference declared signals and emit allowed verdicts
  validatePoliciesAgainstSpec(applicablePolicies, spec);

  // Evaluate policies: match scope, evaluate conditions, collect verdicts
  const matches: PolicyMatch[] = [];

  for (const policy of applicablePolicies) {
    // Step 1: Check if policy scope matches decision scope
    // Policies are already filtered by organization_id above (spec matches org/domain)
    // So we only check scope fields (domain, service, agent, environment, system)
    const scopeMatch = scopeMatches(policy.scope, decision.scope);
    console.log(
      `[EVALUATOR] Policy ${policy.id}: scope=${scopeMatch}, ` +
        `policyScope=${JSON.stringify(policy.scope)}, ` +
        `decisionScope=${JSON.stringify(decision.scope)}`
    );
    if (!scopeMatch) {
      continue;
    }

    // Step 2: Evaluate all conditions in the policy
    const conditionMatch = evaluateAllConditions(policy.conditions, decision);
    console.log(
      `[EVALUATOR] Policy ${policy.id}: conditions=${conditionMatch}, ` +
        `conditions=${JSON.stringify(policy.conditions)}, ` +
        `context=${JSON.stringify(decision.context)}`
    );
    if (!conditionMatch) {
      continue;
    }

    // Step 3: Policy matched - record policy ID and verdict
    matches.push({
      policy_id: policy.id,
      verdict: policy.verdict,
    });
  }

  // Step 4: Resolve final verdict from matched verdicts
  // Precedence: BLOCK > PAUSE > ALLOW > OBSERVE
  const { verdict, matched_policy_ids } = resolveVerdict(matches);

  return {
    verdict,
    matched_policy_ids,
  };
}
