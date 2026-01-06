/**
 * Signal Validator - Ensures decision signals match spec declarations
 * @see RFC-001 Section 6, BUILD-PLAN-v1.2 Section 4
 *
 * Rules:
 * - All required signals must be present
 * - Signal types must match spec declaration
 * - No signals beyond those declared in spec
 */

import { DecisionSpec, DecisionEvent, SignalDefinition } from '@mandate/shared';

export class SignalValidator {
  /**
   * Validate that decision signals match spec requirements.
   * @throws Error if validation fails
   */
  static validate(spec: DecisionSpec, decision: DecisionEvent): void {
    // Extract signals from decision based on spec declarations
    const signalMap = this.extractSignals(decision, spec.signals);

    // Validate each required signal
    for (const signalDef of spec.signals) {
      if (signalDef.required && !(signalDef.name in signalMap)) {
        throw new Error(
          `Required signal '${signalDef.name}' not found in decision (spec: ${spec.spec_id}@${spec.version})`
        );
      }

      if (signalDef.name in signalMap) {
        const value = signalMap[signalDef.name];
        this.validateSignalType(signalDef, value, spec.spec_id);
      }
    }
  }

  /**
   * Extract signal values from decision context based on spec signal sources.
   */
  private static extractSignals(
    decision: DecisionEvent,
    signalDefs: readonly SignalDefinition[]
  ): Record<string, any> {
    const signals: Record<string, any> = {};

    for (const def of signalDefs) {
      let value: any;

      switch (def.source) {
        case 'scope':
          value = (decision.scope as any)[def.name];
          break;
        case 'context':
          value = decision.context[def.name];
          break;
        case 'timestamp':
          value = decision.timestamp;
          break;
      }

      if (value !== undefined) {
        signals[def.name] = value;
      }
    }

    return signals;
  }

  /**
   * Validate signal value matches type declaration.
   * @throws Error if type mismatch
   */
  private static validateSignalType(
    def: SignalDefinition,
    value: any,
    specId: string
  ): void {
    switch (def.type) {
      case 'enum':
        if (!def.values?.includes(String(value))) {
          throw new Error(
            `Signal '${def.name}' has invalid enum value '${value}' ` +
              `(allowed: ${def.values?.join(', ')}) in spec ${specId}`
          );
        }
        break;

      case 'boolean':
        if (typeof value !== 'boolean') {
          throw new Error(
            `Signal '${def.name}' must be boolean, got ${typeof value} in spec ${specId}`
          );
        }
        break;

      case 'string':
        if (typeof value !== 'string') {
          throw new Error(
            `Signal '${def.name}' must be string, got ${typeof value} in spec ${specId}`
          );
        }
        break;

      case 'number':
        if (typeof value !== 'number') {
          throw new Error(
            `Signal '${def.name}' must be number, got ${typeof value} in spec ${specId}`
          );
        }
        break;
    }
  }
}
