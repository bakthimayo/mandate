/**
 * Policy-Spec Validator - Ensures policies conform to spec constraints
 * @see RFC-001 Section 8, Section 13, BUILD-PLAN-v1.2 Section 8
 *
 * Rules:
 * - Policies MUST reference spec_id
 * - Policies MAY ONLY reference declared signals
 * - Policies MAY ONLY emit allowed verdicts
 * - Invalid policy → evaluation failure
 *
 * This is a pure function with no side effects or async operations.
 */

import { DecisionSpec, Policy } from '@mandate/shared';

/**
 * Validate that all policies conform to spec constraints.
 * @throws Error if any policy violates spec constraints
 */
export function validatePoliciesAgainstSpec(
  policies: readonly Policy[],
  spec: DecisionSpec
): void {
  for (const policy of policies) {
    validatePolicyAgainstSpec(policy, spec);
  }
}

/**
 * Validate a single policy against a spec.
 * RFC-002: Enforces spec binding and domain consistency.
 * @throws Error if policy violates spec constraints or RFC-002 isolation rules
 */
function validatePolicyAgainstSpec(policy: Policy, spec: DecisionSpec): void {
  // Rule 1: Policy MUST reference spec_id (RFC-002)
  if (!policy.spec_id) {
    throw new Error(
      `RFC-002 violation: Policy '${policy.id}' missing required spec_id ` +
        `(spec: ${spec.spec_id}@${spec.version})`
    );
  }

  // Rule 2: Policy MUST reference scope_id (RFC-002)
  if (!policy.scope_id) {
    throw new Error(
      `RFC-002 violation: Policy '${policy.id}' missing required scope_id ` +
        `(spec: ${spec.spec_id}@${spec.version})`
    );
  }

  // Rule 3: Policy's spec_id MUST match the evaluating spec (RFC-002)
  if (policy.spec_id !== spec.spec_id) {
    throw new Error(
      `RFC-002 violation: Policy '${policy.id}' bound to spec '${policy.spec_id}' ` +
        `cannot be evaluated with spec '${spec.spec_id}@${spec.version}'`
    );
  }

  // Rule 4: Policy's scope domain_name MUST match spec domain_name (RFC-002)
  if (policy.scope.domain_name !== spec.domain_name) {
    throw new Error(
      `RFC-002 violation: Policy '${policy.id}' scope domain_name '${policy.scope.domain_name}' ` +
        `does not match spec domain_name '${spec.domain_name}' ` +
        `(spec: ${spec.spec_id}@${spec.version})`
    );
  }

  // Rule 5: Policy verdict MUST be in spec.allowed_verdicts
  if (!spec.allowed_verdicts.includes(policy.verdict)) {
    throw new Error(
      `Policy '${policy.id}' emits forbidden verdict '${policy.verdict}' ` +
        `(allowed: ${spec.allowed_verdicts.join(', ')}) ` +
        `(spec: ${spec.spec_id}@${spec.version})`
    );
  }

  // Rule 6: All signal references in conditions MUST be declared in spec
  const declaredSignalNames = new Set(spec.signals.map((s) => s.name));

  for (const condition of policy.conditions) {
    // Extract signal name from condition field
    // Field format: "signal_name" or "signal_name.nested.property"
    const signalName = condition.field.split('.')[0];

    if (!declaredSignalNames.has(signalName)) {
      throw new Error(
        `Policy '${policy.id}' references undeclared signal '${signalName}' ` +
          `(declared: ${Array.from(declaredSignalNames).join(', ')}) ` +
          `(spec: ${spec.spec_id}@${spec.version})`
      );
    }
  }
}
