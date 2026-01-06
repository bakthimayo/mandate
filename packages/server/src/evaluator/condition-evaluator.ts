/**
 * Condition evaluation logic for policy rules.
 * @internal - Do not import directly. Use index.ts exports.
 *
 * Rules:
 * - No async code
 * - No database access
 * - No Date, Math.random, setTimeout, fetch
 */

import type { DecisionEvent, PolicyCondition, PolicyOperator } from '@mandate/shared';

type PrimitiveValue = string | number | boolean;
type ConditionValue = PrimitiveValue | readonly PrimitiveValue[];

/**
 * Extracts a field value from a DecisionEvent.
 * Supports top-level fields and context fields via "context.fieldName" notation.
 */
function extractFieldValue(decision: DecisionEvent, field: string): unknown {
  if (field.startsWith('context.')) {
    const contextKey = field.slice(8);
    return decision.context[contextKey];
  }

  if (field === 'decision_id') return decision.decision_id;
  if (field === 'intent') return decision.intent;
  if (field === 'stage') return decision.stage;
  if (field === 'actor') return decision.actor;
  if (field === 'target') return decision.target;
  if (field === 'timestamp') return decision.timestamp;

  if (field.startsWith('scope.')) {
    const scopeKey = field.slice(6) as keyof typeof decision.scope;
    return decision.scope[scopeKey];
  }

  return undefined;
}

/**
 * Validates that a value is a primitive type suitable for comparison.
 */
function isPrimitive(value: unknown): value is PrimitiveValue {
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
}

/**
 * Compares two values using the specified operator.
 * Throws on invalid operator or incompatible types.
 */
function compare(
  fieldValue: PrimitiveValue,
  operator: PolicyOperator,
  conditionValue: ConditionValue
): boolean {
  switch (operator) {
    case '==':
      return fieldValue === conditionValue;

    case '!=':
      return fieldValue !== conditionValue;

    case '>':
      if (typeof fieldValue !== 'number' || typeof conditionValue !== 'number') {
        throw new Error(`Operator '>' requires numeric values`);
      }
      return fieldValue > conditionValue;

    case '<':
      if (typeof fieldValue !== 'number' || typeof conditionValue !== 'number') {
        throw new Error(`Operator '<' requires numeric values`);
      }
      return fieldValue < conditionValue;

    case '>=':
      if (typeof fieldValue !== 'number' || typeof conditionValue !== 'number') {
        throw new Error(`Operator '>=' requires numeric values`);
      }
      return fieldValue >= conditionValue;

    case '<=':
      if (typeof fieldValue !== 'number' || typeof conditionValue !== 'number') {
        throw new Error(`Operator '<=' requires numeric values`);
      }
      return fieldValue <= conditionValue;

    case 'in':
      if (!Array.isArray(conditionValue)) {
        throw new Error(`Operator 'in' requires an array value`);
      }
      return conditionValue.includes(fieldValue);

    default: {
      const exhaustiveCheck: never = operator;
      throw new Error(`Unsupported operator: ${exhaustiveCheck}`);
    }
  }
}

/**
 * Evaluates a single PolicyCondition against a DecisionEvent.
 *
 * @param condition - The condition to evaluate
 * @param decision - The decision event to evaluate against
 * @returns true if the condition is satisfied
 * @throws Error if the condition is invalid or unsupported
 */
export function evaluateCondition(condition: PolicyCondition, decision: DecisionEvent): boolean {
  const { field, operator, value } = condition;

  if (!field || typeof field !== 'string') {
    throw new Error('Condition field must be a non-empty string');
  }

  const fieldValue = extractFieldValue(decision, field);

  if (fieldValue === undefined) {
    throw new Error(`Field '${field}' not found in decision`);
  }

  if (!isPrimitive(fieldValue)) {
    throw new Error(`Field '${field}' is not a primitive value`);
  }

  return compare(fieldValue, operator, value);
}
