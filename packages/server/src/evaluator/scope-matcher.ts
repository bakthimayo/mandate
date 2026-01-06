/**
 * Scope matching logic for policy evaluation.
 * @internal - Do not import directly. Use index.ts exports.
 *
 * Rules:
 * - No async code
 * - No database access
 * - No Date, Math.random, setTimeout, fetch
 */

import type { DecisionEvent, Scope } from '@mandate/shared';

const SCOPE_KEYS: readonly (keyof Scope)[] = [
  'domain',
  'service',
  'agent',
  'system',
  'environment',
  'tenant',
];

/**
 * Determines if a DecisionEvent matches a policy's scope selector.
 *
 * Matching rules:
 * - Empty selector matches all decisions (global policy)
 * - Missing selector fields act as wildcards
 * - All present selector fields must match exactly
 * - Deterministic: same inputs always produce same output
 *
 * @param decision - The decision event to match
 * @param selector - The policy's scope selector
 * @returns true if the decision matches the selector
 */
export function matchesScope(decision: DecisionEvent, selector: Scope): boolean {
  for (const key of SCOPE_KEYS) {
    const selectorValue = selector[key];
    if (selectorValue === undefined) {
      continue;
    }
    const decisionValue = decision.scope[key];
    if (decisionValue !== selectorValue) {
      return false;
    }
  }
  return true;
}
