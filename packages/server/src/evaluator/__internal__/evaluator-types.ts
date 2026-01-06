/**
 * Internal types for the evaluator module.
 * @internal - Do not import from outside evaluator module.
 */

import type { Verdict } from '@mandate/shared';

/**
 * Result of evaluating a DecisionEvent against a PolicySnapshotV1.
 * Pure data output - no side effects, no timestamps, no generated IDs.
 */
export interface EvaluationResult {
  readonly verdict: Verdict;
  readonly matched_policy_ids: readonly string[];
}
