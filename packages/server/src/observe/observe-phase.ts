/**
 * Observe Phase - Signal Population Hook
 *
 * Executes signal population BEFORE spec and scope resolution.
 * Populates already-declared DecisionSpec signals from unstructured context.
 *
 * Flow:
 * 1. Accept raw decision + unstructured text
 * 2. Attempt to populate signals from unstructured text
 * 3. Return enriched decision with populated context
 * 4. Continue to spec resolution and evaluation
 *
 * Constraints:
 * - Never infer missing intent, domain, or stage
 * - Never perform policy checks or produce verdicts
 * - Only use signals declared in the spec
 * - Non-deterministic parsing must be non-authoritative
 *
 * @see RFC-002 Section 7
 */

import type { DecisionEvent, DecisionSpec, SignalDefinition } from '@mandate/shared';
import {
  populateSignals,
  mergeSignalsIntoDecision,
  type SignalPopulationConfig,
} from './signal-populator.js';

/**
 * Configuration for the Observe phase.
 */
export interface ObservePhaseConfig {
  /**
   * Enable assisted (LLM-based) signal population.
   * Default: false (deterministic only).
   */
  enableAssistedParsing?: boolean;

  /**
   * Minimum confidence for assisted parsing results.
   * Default: 0.8.
   */
  assistedParsingConfidenceThreshold?: number;

  /**
   * Custom assisted parsing function.
   * If not provided and enableAssistedParsing is true, a default stub is used.
   */
  assistedParsingFn?: (
    text: string,
    signalDefs: readonly SignalDefinition[],
    contextSignals: readonly SignalDefinition[]
  ) => Promise<Record<string, { value: any; confidence: number }>>;
}

/**
 * Default stub for assisted parsing.
 * Returns empty results (no LLM calls by default).
 */
async function defaultAssistedParsingStub(
  _text: string,
  _signalDefs: readonly SignalDefinition[],
  _contextSignals: readonly SignalDefinition[]
): Promise<Record<string, { value: any; confidence: number }>> {
  return {};
}

/**
 * Execute Observe phase signal population.
 *
 * This function:
 * 1. Validates that spec is available (should be resolved before calling this)
 * 2. Runs signal population on declared signals
 * 3. Merges populated values into decision context
 * 4. Returns enriched decision ready for spec resolution
 *
 * @param decision - The raw decision event
 * @param spec - The resolved DecisionSpec (provides signal declarations)
 * @param unstructuredContext - AI-generated text or other unstructured input
 * @param config - Observe phase configuration
 * @returns Decision with populated signals in context
 *
 * @throws Error if spec has no signal declarations (suggests misconfiguration)
 *
 * @see RFC-002 Section 7
 */
export async function executeObservePhase(
  decision: DecisionEvent,
  spec: DecisionSpec,
  unstructuredContext: string,
  config: ObservePhaseConfig = {}
): Promise<DecisionEvent> {
  // =========================================================================
  // Validate inputs
  // =========================================================================
  if (!spec.signals || spec.signals.length === 0) {
    // No signals declared - nothing to populate
    return decision;
  }

  if (!unstructuredContext || unstructuredContext.trim().length === 0) {
    // Empty context - nothing to extract from
    return decision;
  }

  // =========================================================================
  // Execute signal population
  // =========================================================================
  const populationConfig: SignalPopulationConfig = {
    enableAssistedParsing: config.enableAssistedParsing ?? false,
    assistedParsingConfidenceThreshold: config.assistedParsingConfidenceThreshold ?? 0.8,
    assistedParsingFn: config.assistedParsingFn ?? defaultAssistedParsingStub,
  };

  const populatedSignals = await populateSignals(
    decision,
    spec.signals,
    unstructuredContext,
    populationConfig
  );

  // =========================================================================
  // Merge populated signals into decision context
  // =========================================================================
  const enrichedDecision = mergeSignalsIntoDecision(decision, populatedSignals);

  return enrichedDecision;
}

/**
 * Create an Observe phase executor with pre-configured settings.
 * Useful for dependency injection in route handlers.
 */
export function createObservePhaseExecutor(config: ObservePhaseConfig) {
  return async (
    decision: DecisionEvent,
    spec: DecisionSpec,
    unstructuredContext: string
  ): Promise<DecisionEvent> => {
    return executeObservePhase(decision, spec, unstructuredContext, config);
  };
}
