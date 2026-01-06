/**
 * Condition Evaluator - Evaluates policy conditions against decision context and scope
 * @see RFC-001 Section 9 - Policy Conditions
 * @see BUILD-PLAN Section 6 - Condition Evaluation
 *
 * Rules:
 * - Conditions reference signals declared in the spec
 * - Signals come from either decision.context or decision.scope
 * - All conditions in a policy must evaluate to true for the policy to match
 * - Evaluation is deterministic and side-effect free
 */

import type { PolicyCondition, DecisionEvent } from '@mandate/shared';

/**
 * Evaluate all conditions in a policy against a decision.
 * Returns true only if ALL conditions match.
 * Pure function with no side effects.
 */
export function evaluateAllConditions(
  conditions: readonly PolicyCondition[],
  decision: DecisionEvent
): boolean {
  // No conditions = matches (empty condition list is always true)
  if (conditions.length === 0) {
    return true;
  }

  // All conditions must evaluate to true
  return conditions.every((condition) => evaluateCondition(condition, decision));
}

/**
 * Evaluate a single condition.
 * Signals are resolved from either decision.context or decision.scope.
 */
function evaluateCondition(condition: PolicyCondition, decision: DecisionEvent): boolean {
  // Extract signal value from decision
  const signalValue = resolveSignal(condition.field, decision);

  // If signal is not found, condition fails
  if (signalValue === undefined) {
    return false;
  }

  // Apply operator
  switch (condition.operator) {
    case '==':
      return signalValue === condition.value;

    case '!=':
      return signalValue !== condition.value;

    case '>':
      return typeof signalValue === 'number' &&
        typeof condition.value === 'number'
        ? signalValue > condition.value
        : false;

    case '<':
      return typeof signalValue === 'number' &&
        typeof condition.value === 'number'
        ? signalValue < condition.value
        : false;

    case '>=':
      return typeof signalValue === 'number' &&
        typeof condition.value === 'number'
        ? signalValue >= condition.value
        : false;

    case '<=':
      return typeof signalValue === 'number' &&
        typeof condition.value === 'number'
        ? signalValue <= condition.value
        : false;

    case 'in':
      // condition.value must be an array
      if (!Array.isArray(condition.value)) {
        return false;
      }
      return condition.value.includes(signalValue as string | number | boolean);

    default:
      return false;
  }
}

/**
 * Resolve a signal value from decision.context or decision.scope.
 * Signal names can be nested: "signal_name.nested.property"
 * Scope fields take precedence in decision.scope.
 */
function resolveSignal(
  fieldPath: string,
  decision: DecisionEvent
): unknown {
  const parts = fieldPath.split('.');
  const topLevel = parts[0];

  // Try to resolve from context first (most common)
  if (topLevel in decision.context) {
    return getNestedProperty(decision.context, parts);
  }

  // Try to resolve from scope fields
  if (topLevel in decision.scope) {
    return getNestedProperty(decision.scope as Record<string, unknown>, parts);
  }

  // Signal not found
  return undefined;
}

/**
 * Get nested property from object using dot notation.
 * e.g., getNestedProperty(obj, ['a', 'b', 'c']) returns obj.a.b.c
 */
function getNestedProperty(obj: Record<string, unknown>, parts: string[]): unknown {
  let current: unknown = obj;

  for (const part of parts) {
    if (typeof current !== 'object' || current === null) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}
