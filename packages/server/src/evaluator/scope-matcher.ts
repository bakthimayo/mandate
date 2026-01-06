/**
 * Scope matching logic for policy evaluation.
 * @internal - Do not import directly. Use index.ts exports.
 *
 * Rules:
 * - No async code
 * - No database access
 * - No Date, Math.random, setTimeout, fetch
 *
 * RFC-002 Enforcement:
 * - organization_id must match exactly (required)
 * - domain must match exactly (required)
 * - No fallback behavior
 * - Fail safely if attribution is missing
 */

import type { DecisionEvent, Scope } from '@mandate/shared';

const OPTIONAL_SCOPE_KEYS: readonly (keyof Scope)[] = [
  'service',
  'agent',
  'system',
  'environment',
];

export interface ScopeMatchResult {
  readonly matches: boolean;
  readonly reason?: string;
}

/**
 * Determines if a DecisionEvent matches a policy's scope selector.
 *
 * RFC-002 Matching rules:
 * - organization_id must be present and match exactly
 * - domain must be present and match exactly
 * - Missing required fields fail safely (no match)
 * - Optional selector fields (service, agent, system, environment) act as wildcards when undefined
 * - All present optional selector fields must match exactly
 * - Deterministic: same inputs always produce same output
 *
 * @param decision - The decision event to match
 * @param selector - The policy's scope selector
 * @returns ScopeMatchResult with match status and optional reason
 */
export function matchesScope(decision: DecisionEvent, selector: Scope): ScopeMatchResult {
  if (!decision.organization_id) {
    return { matches: false, reason: 'decision missing organization_id' };
  }
  if (!selector.organization_id) {
    return { matches: false, reason: 'selector missing organization_id' };
  }
  if (decision.organization_id !== selector.organization_id) {
    return { matches: false, reason: 'organization_id mismatch' };
  }

  if (!decision.scope.domain) {
    return { matches: false, reason: 'decision scope missing domain' };
  }
  if (!selector.domain) {
    return { matches: false, reason: 'selector missing domain' };
  }
  if (decision.scope.domain !== selector.domain) {
    return { matches: false, reason: 'domain mismatch' };
  }

  for (const key of OPTIONAL_SCOPE_KEYS) {
    const selectorValue = selector[key];
    if (selectorValue === undefined) {
      continue;
    }
    const decisionValue = decision.scope[key];
    if (decisionValue !== selectorValue) {
      return { matches: false, reason: `${key} mismatch` };
    }
  }

  return { matches: true };
}

/**
 * Simplified boolean matcher for backward compatibility.
 * Uses matchesScope internally.
 *
 * @param decision - The decision event to match
 * @param selector - The policy's scope selector
 * @returns true if the decision matches the selector
 */
export function matchesScopeStrict(decision: DecisionEvent, selector: Scope): boolean {
  return matchesScope(decision, selector).matches;
}
