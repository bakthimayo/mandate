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
 */

import type { DecisionEvent, PolicySnapshotV1 } from '@mandate/shared';
import type { EvaluationResult } from './__internal__/evaluator-types.js';

export type { EvaluationResult } from './__internal__/evaluator-types.js';

/**
 * Evaluates a DecisionEvent against a PolicySnapshotV1.
 * Pure function - no side effects.
 *
 * @param decision - The decision event to evaluate
 * @param snapshot - The policy snapshot to evaluate against
 * @returns The evaluation result with verdict and matched policy IDs
 */
export function evaluateDecision(
  decision: DecisionEvent,
  snapshot: PolicySnapshotV1
): EvaluationResult {
  const matched_policy_ids: string[] = [];

  // TODO: Implement scope matching via scope-matcher.ts
  // TODO: Implement condition evaluation via condition-evaluator.ts
  // TODO: Implement verdict resolution via verdict-resolver.ts

  // Default verdict when no policies match: ALLOW
  // Resolution precedence: BLOCK > PAUSE > ALLOW > OBSERVE
  return {
    verdict: 'ALLOW',
    matched_policy_ids,
  };
}
