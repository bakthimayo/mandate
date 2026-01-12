/**
 * Scope Matcher - Determines if a policy's scope matches a decision's scope
 * @see RFC-002 Section 7 - Scope Isolation and Attribution
 *
 * Matching rules:
 * - Required fields (domain, organization_id) MUST match exactly
 * - Optional fields (service, agent, environment, system) match if:
 *   - Policy field is undefined (wildcard) OR
 *   - Policy field matches decision field exactly
 */

import type { Policy, Scope } from '@mandate/shared';

/**
 * Check if a policy's scope matches a decision's scope.
 * Pure function with no side effects.
 *
 * Scope matching is field-by-field:
 * - domain: MUST match exactly (enforced at evaluator level, not here)
 * - service, agent, system, environment: match if policy field is undefined (wildcard) OR equals decision field
 */
export function scopeMatches(policyScope: Scope, decisionScope: Scope): boolean {
  // Domain MUST match exactly (already verified at evaluator level)
  if (policyScope.domain_name !== decisionScope.domain_name) {
    return false;
  }

  // Optional fields: policy field acts as filter
  // Undefined policy field = wildcard (matches any decision field)
  // Defined policy field must match decision field exactly
  if (policyScope.service !== undefined && policyScope.service !== decisionScope.service) {
    return false;
  }

  if (policyScope.agent !== undefined && policyScope.agent !== decisionScope.agent) {
    return false;
  }

  if (policyScope.system !== undefined && policyScope.system !== decisionScope.system) {
    return false;
  }

  if (
    policyScope.environment !== undefined &&
    policyScope.environment !== decisionScope.environment
  ) {
    return false;
  }

  return true;
}
