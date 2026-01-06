/**
 * Verdict resolution logic - determines final verdict from matched rules.
 * @internal - Do not import directly. Use index.ts exports.
 *
 * Rules:
 * - No async code
 * - No database access
 * - No Date, Math.random, setTimeout, fetch
 */

import type { Verdict } from '@mandate/shared';
import type { EvaluationResult } from './__internal__/evaluator-types.js';

/**
 * A single policy match result.
 */
export interface PolicyMatch {
  readonly policy_id: string;
  readonly verdict: Verdict;
}

/**
 * Verdict precedence order (highest to lowest).
 * BLOCK > PAUSE > ALLOW > OBSERVE
 */
const VERDICT_PRECEDENCE: Record<Verdict, number> = {
  BLOCK: 3,
  PAUSE: 2,
  ALLOW: 1,
  OBSERVE: 0,
};

/**
 * Default verdict when no policies match.
 */
const DEFAULT_VERDICT: Verdict = 'ALLOW';

/**
 * Resolves multiple policy matches into a single EvaluationResult.
 *
 * Resolution rules:
 * - Precedence: BLOCK > PAUSE > ALLOW > OBSERVE
 * - All matched policy IDs are collected
 * - Empty matches returns ALLOW with empty policy list
 * - Deterministic: same inputs always produce same output
 *
 * @param matches - Array of policy match results
 * @returns Resolved evaluation result
 */
export function resolveVerdict(matches: readonly PolicyMatch[]): EvaluationResult {
  if (matches.length === 0) {
    return {
      verdict: DEFAULT_VERDICT,
      matched_policy_ids: [],
    };
  }

  let highestVerdict: Verdict = DEFAULT_VERDICT;
  let highestPrecedence = -1;
  const matched_policy_ids: string[] = [];

  for (const match of matches) {
    matched_policy_ids.push(match.policy_id);

    const precedence = VERDICT_PRECEDENCE[match.verdict];
    if (precedence > highestPrecedence) {
      highestPrecedence = precedence;
      highestVerdict = match.verdict;
    }
  }

  return {
    verdict: highestVerdict,
    matched_policy_ids,
  };
}
